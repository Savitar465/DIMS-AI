import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join, resolve } from 'path';
import {
  AI_SERVICE,
  AIService,
  ExtraccionFactura,
} from '../../../domain/ports/outbound/ai.service';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import { FacturaEntity } from '../../../../infraestructure/persistance/entities/factura.entity';
import {
  FacturaDocumento,
  FacturaDocumentoTipo,
  FacturaItem,
} from '../../../domain/models/aduana';

export interface ArchivoCargado {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
}

// Ciudades bolivianas más frecuentes como destino → departamento de la DIMS.
// Evita preguntar algo que la dirección de entrega ya dice.
const CIUDAD_A_DEPARTAMENTO: Record<string, string> = {
  'la paz': 'La Paz',
  'el alto': 'La Paz',
  'santa cruz': 'Santa Cruz',
  'santa cruz de la sierra': 'Santa Cruz',
  montero: 'Santa Cruz',
  cochabamba: 'Cochabamba',
  quillacollo: 'Cochabamba',
  sacaba: 'Cochabamba',
  oruro: 'Oruro',
  potosi: 'Potosí',
  potosí: 'Potosí',
  sucre: 'Chuquisaca',
  chuquisaca: 'Chuquisaca',
  tarija: 'Tarija',
  yacuiba: 'Tarija',
  trinidad: 'Beni',
  beni: 'Beni',
  cobija: 'Pando',
  pando: 'Pando',
};

// Incoterms en los que el precio ya cubre el traslado / el seguro hasta destino.
const INCOTERMS_CON_FLETE = ['CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const INCOTERMS_CON_SEGURO = ['CIF', 'CIP'];

/** ¿El Incoterm indica que el precio ya cubría el flete? */
export function fleteIncluidoEnPrecio(incoterm?: string): boolean | undefined {
  if (!incoterm) return undefined;
  return INCOTERMS_CON_FLETE.includes(incoterm.toUpperCase());
}

export function seguroIncluidoEnPrecio(incoterm?: string): boolean | undefined {
  if (!incoterm) return undefined;
  return INCOTERMS_CON_SEGURO.includes(incoterm.toUpperCase());
}

interface Lectura {
  extraccion: ExtraccionFactura;
  documento: FacturaDocumento;
}

/**
 * Confianza de un campo según la evidencia que lo respalda. No es una opinión
 * del modelo sobre sí mismo: sale de cuántos documentos declararon el dato y de
 * si coincidieron. Un valor que aparece en dos papeles y dice lo mismo se
 * revisa distinto que uno que aparece en dos papeles y se contradice.
 */
const CONFIANZA = {
  /** Lo dicen dos o más documentos y coinciden. */
  confirmado: 95,
  /** Lo dice un solo documento. */
  unicaFuente: 80,
  /** No lo declara nadie: lo dedujimos de otro campo. */
  deducido: 60,
  /** Dos documentos lo declaran distinto: alguien tiene que decidir cuál vale. */
  enConflicto: 45,
} as const;

/**
 * Dónde quedan los archivos originales. Se guardan porque revisar un dato que
 * leyó la IA sin poder mirar el papel al lado obliga a abrir el PDF por fuera
 * de la aplicación — y ahí se pierde la mitad de la ventaja de extraerlo.
 */
export const ARCHIVOS_DIR = resolve(
  process.env.ARCHIVOS_DIR ?? join(process.cwd(), 'data', 'facturas'),
);

/** Nombre de archivo seguro: nada que pueda escaparse del directorio. */
function nombreSeguro(nombre: string): string {
  const base = nombre.replace(/[^\w.\- ]+/g, '_').slice(-80);
  return base.trim() || 'documento';
}

@Injectable()
export class UploadFacturaUseCase {
  constructor(
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
  ) {}

  /**
   * Acepta uno o varios documentos. La factura comercial aporta proveedor,
   * ítems y montos; el packing list y la guía de transporte aportan bultos,
   * pesos y nº de guía — justamente los campos obligatorios de la DIMS que una
   * factura sola nunca trae.
   */
  async execute(archivos: ArchivoCargado[]): Promise<FacturaEntity> {
    const factura = new FacturaEntity();
    factura.id = `fac_${randomBytes(4).toString('hex')}`;

    const lecturas = await Promise.all(
      archivos.map((a, idx) => this.leer(a, factura.id, idx)),
    );
    factura.documentos = lecturas.map((l) => l.documento);

    const utiles = lecturas.filter((l) => l.documento.aporto);
    if (utiles.length === 0) {
      factura.estado = 'error';
      factura.proveedor = {};
      factura.factura = {};
      factura.importador = {};
      factura.logistica = {};
      factura.items = [];
      factura.totales = {};
      return this.facturaRepository.save(factura);
    }

    // Para los datos comerciales manda la factura; para los de carga, la guía
    // o el packing list. Dentro de cada orden gana el primer valor no vacío.
    const comerciales = this.ordenarPor(utiles, ['factura']);
    const logisticos = this.ordenarPor(utiles, [
      'guiaTransporte',
      'packingList',
    ]);

    // El detalle se toma del documento que más ítems reconoció: un packing list
    // lista bultos sin precio y ensuciaría el detalle de la factura.
    const productos = comerciales
      .map((l) => l.extraccion.productos ?? [])
      .reduce((mejor, actual) => (actual.length > mejor.length ? actual : mejor), []);

    const items: FacturaItem[] = productos.map((p, idx) => this.mapItem(p, idx));
    const subtotalItems = items.reduce((acc, it) => acc + (it.subtotal || 0), 0);

    // Se anota la confianza del campo en el mismo lugar donde se decide su
    // valor: es ahí, y solo ahí, donde se sabe cuántos documentos lo dijeron.
    const confianzas: Record<string, number> = {};
    const leer = <T>(
      lecturas: Lectura[],
      campo: string,
      pick: (e: ExtraccionFactura) => T | null | undefined,
    ): T | null => {
      const { valor, confianza } = this.consenso(lecturas, pick);
      if (confianza !== undefined) confianzas[campo] = confianza;
      return valor;
    };

    const subtotal =
      leer(comerciales, 'totales.subtotal', (e) => e.totales?.subtotal) ??
      subtotalItems;
    const flete = leer(comerciales, 'totales.flete', (e) => e.totales?.flete) ?? 0;
    const seguro =
      leer(comerciales, 'totales.seguro', (e) => e.totales?.seguro) ?? 0;

    const nombreProveedor = leer(
      comerciales,
      'proveedor.nombre',
      (e) => e.proveedor?.nombre,
    );
    const numeroFactura = leer(
      comerciales,
      'factura.numero',
      (e) => e.factura?.numero,
    );
    const puertoEmbarque = leer(
      comerciales,
      'factura.puertoEmbarque',
      (e) => e.factura?.puertoEmbarque,
    );
    const nombreImportador = leer(
      comerciales,
      'importador.nombreRazonSocial',
      (e) => e.importador?.nombreRazonSocial,
    );
    const ciudad = this.primero(comerciales, (e) => e.importador?.ciudad);
    const pesoBruto = leer(
      logisticos,
      'logistica.pesoBrutoKg',
      (e) => e.logistica?.pesoBrutoKg,
    );

    // El departamento no lo declara ningún documento: sale de mapear la ciudad
    // de entrega. Es una deducción nuestra y se marca como tal.
    const departamentoDestino = this.departamentoDe(ciudad);
    if (departamentoDestino) {
      confianzas['importador.departamentoDestino'] = CONFIANZA.deducido;
    }

    const paisProcedencia = leer(
      logisticos,
      'logistica.paisUltimaProcedencia',
      (e) => e.logistica?.paisUltimaProcedencia,
    );
    // Si nadie lo declaró, se saca del puerto de embarque ("Shenzhen, China").
    const paisDelPuerto = paisProcedencia
      ? null
      : this.paisDelPuerto(puertoEmbarque);
    if (paisDelPuerto) {
      confianzas['logistica.paisUltimaProcedencia'] = CONFIANZA.deducido;
    }

    factura.estado = 'extraida';
    factura.proveedor = {
      nombre: nombreProveedor ?? undefined,
      direccion:
        leer(comerciales, 'proveedor.direccion', (e) => e.proveedor?.direccion) ??
        undefined,
      pais: leer(comerciales, 'proveedor.pais', (e) => e.proveedor?.pais) ?? undefined,
      rfc: leer(comerciales, 'proveedor.rfc', (e) => e.proveedor?.rfc) ?? undefined,
      confidence: nombreProveedor ? 90 : 0,
    };
    factura.factura = {
      numero: numeroFactura ?? undefined,
      fecha: leer(comerciales, 'factura.fecha', (e) => e.factura?.fecha) ?? undefined,
      moneda: this.primero(comerciales, (e) => e.factura?.moneda) ?? 'USD',
      incoterm:
        leer(comerciales, 'factura.incoterm', (e) => e.factura?.incoterm) ??
        undefined,
      puertoEmbarque: puertoEmbarque ?? undefined,
      confidence: numeroFactura ? 90 : 60,
    };
    factura.importador = {
      nombreRazonSocial: nombreImportador ?? undefined,
      numeroDocumento:
        leer(
          comerciales,
          'importador.numeroDocumento',
          (e) => e.importador?.numeroDocumento,
        ) ?? undefined,
      domicilio:
        leer(comerciales, 'importador.domicilio', (e) => e.importador?.domicilio) ??
        undefined,
      departamentoDestino,
      confidence: nombreImportador ? 85 : 0,
    };
    factura.logistica = {
      cantidadBultos:
        leer(
          logisticos,
          'logistica.cantidadBultos',
          (e) => e.logistica?.cantidadBultos,
        ) ?? undefined,
      pesoBrutoKg: pesoBruto ?? undefined,
      pesoNetoKg:
        leer(logisticos, 'logistica.pesoNetoKg', (e) => e.logistica?.pesoNetoKg) ??
        undefined,
      manifiesto:
        leer(logisticos, 'logistica.manifiesto', (e) => e.logistica?.manifiesto) ??
        undefined,
      paisUltimaProcedencia: paisProcedencia ?? paisDelPuerto ?? undefined,
      medioTransporte:
        leer(
          logisticos,
          'logistica.medioTransporte',
          (e) => e.logistica?.medioTransporte,
        ) ?? undefined,
      confidence: pesoBruto ? 85 : 0,
    };
    factura.items = items;
    factura.totales = {
      subtotal,
      flete,
      seguro,
      cif: +(subtotal + flete + seguro).toFixed(2),
    };
    factura.confianzas = confianzas;

    return this.facturaRepository.save(factura);
  }

  private async leer(
    archivo: ArchivoCargado,
    facturaId: string,
    indice: number,
  ): Promise<Lectura> {
    const nombre = archivo.originalname ?? 'documento';
    const id = `doc${indice + 1}`;
    // El archivo se guarda aunque la extracción falle: justamente cuando la IA
    // no pudo leer nada es cuando el usuario más necesita ver el original.
    const guardado = await this.guardar(archivo, facturaId, id, nombre);
    const base: FacturaDocumento = {
      id,
      nombre,
      mimeType: archivo.mimetype,
      tipo: 'otro',
      aporto: false,
      archivo: guardado,
      tamanoBytes: archivo.buffer.byteLength,
    };
    try {
      const extraccion = await this.aiService.extraerDatosFactura(
        archivo.buffer,
        archivo.mimetype,
      );
      return {
        extraccion,
        documento: {
          ...base,
          tipo: this.tipoDocumento(extraccion, nombre),
          aporto: this.aportoAlgo(extraccion),
        },
      };
    } catch {
      return { extraccion: {}, documento: base };
    }
  }

  private async guardar(
    archivo: ArchivoCargado,
    facturaId: string,
    id: string,
    nombre: string,
  ): Promise<string | undefined> {
    try {
      const carpeta = join(ARCHIVOS_DIR, facturaId);
      await mkdir(carpeta, { recursive: true });
      // El nombre lo componemos nosotros a partir del id: el original solo
      // aporta la extensión, así que nada que venga del cliente llega al disco.
      const archivoGuardado = `${id}${extname(nombreSeguro(nombre))}`;
      await writeFile(join(carpeta, archivoGuardado), archivo.buffer);
      return archivoGuardado;
    } catch (e) {
      // Que no se pueda archivar el original no invalida la extracción: la
      // factura sigue procesándose, solo se pierde la vista del documento.
      console.warn(`[Upload] No se pudo guardar "${nombre}":`, e);
      return undefined;
    }
  }

  private aportoAlgo(e: ExtraccionFactura): boolean {
    return Boolean(
      e.proveedor?.nombre ||
        e.factura?.numero ||
        e.importador?.nombreRazonSocial ||
        e.logistica?.pesoBrutoKg ||
        e.logistica?.cantidadBultos ||
        e.logistica?.manifiesto ||
        (e.productos?.length ?? 0) > 0,
    );
  }

  private tipoDocumento(
    e: ExtraccionFactura,
    nombre: string,
  ): FacturaDocumentoTipo {
    if (e.tipoDocumento) return e.tipoDocumento;
    const n = nombre.toLowerCase();
    if (n.includes('packing')) return 'packingList';
    if (n.includes('awb') || n.includes('guia') || n.includes('guía'))
      return 'guiaTransporte';
    if (n.includes('factura') || n.includes('invoice')) return 'factura';
    return 'otro';
  }

  /** Ordena las lecturas poniendo primero los tipos de documento indicados. */
  private ordenarPor(
    lecturas: Lectura[],
    prioridad: FacturaDocumentoTipo[],
  ): Lectura[] {
    const peso = (t: FacturaDocumentoTipo) => {
      const i = prioridad.indexOf(t);
      return i === -1 ? prioridad.length : i;
    };
    return [...lecturas].sort(
      (a, b) => peso(a.documento.tipo) - peso(b.documento.tipo),
    );
  }

  private primero<T>(
    lecturas: Lectura[],
    pick: (e: ExtraccionFactura) => T | null | undefined,
  ): T | null {
    return this.consenso(lecturas, pick).valor;
  }

  /**
   * El primer valor no vacío, igual que antes, más cuánto lo respalda el resto
   * de los documentos. `primero` se queda con el primero y descarta en silencio
   * que otro papel dijera otra cosa; eso es justamente lo que hay que mostrar.
   */
  private consenso<T>(
    lecturas: Lectura[],
    pick: (e: ExtraccionFactura) => T | null | undefined,
  ): { valor: T | null; confianza?: number } {
    const valores: T[] = [];
    for (const l of lecturas) {
      const v = pick(l.extraccion);
      if (v !== null && v !== undefined && (v as unknown) !== '') valores.push(v);
    }
    if (valores.length === 0) return { valor: null };
    if (valores.length === 1) {
      return { valor: valores[0], confianza: CONFIANZA.unicaFuente };
    }
    const coinciden = valores.every((v) => this.mismoValor(v, valores[0]));
    return {
      valor: valores[0],
      confianza: coinciden ? CONFIANZA.confirmado : CONFIANZA.enConflicto,
    };
  }

  private mismoValor(a: unknown, b: unknown): boolean {
    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < 0.01;
    }
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  // Cuando ningún documento declara el país de procedencia, el puerto de
  // embarque suele traerlo pegado ("Shenzhen, China").
  private paisDelPuerto(puertoEmbarque?: string | null): string | null {
    if (!puertoEmbarque?.includes(',')) return null;
    return puertoEmbarque.split(',').pop()?.trim() || null;
  }

  private departamentoDe(ciudad?: string | null): string | undefined {
    if (!ciudad) return undefined;
    return CIUDAD_A_DEPARTAMENTO[ciudad.trim().toLowerCase()];
  }

  private mapItem(p: any, idx: number): FacturaItem {
    const cantidad = Number(p?.cantidad) || 0;
    const precioUnit = Number(p?.valorUnitario) || 0;
    const subtotal = Number(p?.valorTotal) || cantidad * precioUnit;
    return {
      id: `i${idx + 1}`,
      descripcion: p?.descripcion ?? '',
      cantidad,
      unidad: 'UND',
      precioUnit,
      subtotal,
      subpartida: null,
      confidence: 90,
      aiSuggested: false,
      clasificada: false,
    };
  }
}
