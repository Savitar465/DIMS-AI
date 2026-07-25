import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  DIMS_REPOSITORY,
  DimsRepository,
} from '../../../domain/ports/outbound/dims.repository';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../../../domain/ports/outbound/subpartida.repository';
import { DimsEntity } from '../../../../infraestructure/persistance/entities/dims.entity';
import { FacturaItem } from '../../../domain/models/aduana';
import {
  fleteIncluidoEnPrecio,
  seguroIncluidoEnPrecio,
} from '../facturas/upload-factura.usecase';

export interface CreateDimsInput {
  facturaId?: string;
  subpartida?: string;
}

@Injectable()
export class CreateDimsUseCase {
  constructor(
    @Inject(DIMS_REPOSITORY) private readonly dimsRepository: DimsRepository,
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
  ) {}

  async execute(input: CreateDimsInput): Promise<DimsEntity> {
    if (!input?.facturaId && !input?.subpartida) {
      throw new BadRequestException({
        error: {
          code: 'bad_request',
          message: 'Debe indicar facturaId o subpartida para crear la DIMS.',
        },
      });
    }

    const dims = new DimsEntity();
    // `id` es una referencia interna del borrador, NO el código DIMS oficial:
    // ese lo asigna SUMA al transmitir la declaración (ver submit-dims).
    dims.id = this.generateDraftRef();
    dims.estado = 'borrador';
    dims.modalidad = '4101';
    dims.regimen = '41';
    dims.tipoUsuario = 'general';
    dims.parteRecepcionSiNo = true;
    dims.requiereInfAdicional = false;
    // Vacío a propósito: qué documentos va a presentar lo decide el usuario, y
    // marcarle uno por defecto es firmarle algo que no eligió.
    dims.documentosSoporte = [];
    dims.fecha = new Date().toISOString().slice(0, 10);
    dims.items = [];

    if (input.facturaId) {
      const factura = await this.facturaRepository.findById(input.facturaId);
      if (!factura) {
        throw new BadRequestException({
          error: {
            code: 'bad_request',
            message: 'La factura indicada no existe.',
          },
        });
      }
      dims.facturaId = factura.id;
      dims.confianzas = this.confianzasDelFormulario(factura.confianzas);
      dims.proveedor = factura.proveedor?.nombre ?? '';
      if (factura.factura?.fecha) dims.fecha = factura.factura.fecha;
      dims.items = (factura.items || []).map((it) => ({ ...it }));

      // Todo lo que la IA sacó de los documentos viaja a la DIMS. Lo que no se
      // pudo extraer queda vacío y el formulario lo marca como pendiente: es
      // preferible un campo en blanco a un valor por defecto que nadie revisa.
      const imp = factura.importador ?? {};
      if (imp.nombreRazonSocial || imp.numeroDocumento || imp.domicilio) {
        dims.importador = {
          tipoDocumento: this.tipoDocumentoDe(imp.numeroDocumento),
          numeroDocumento: imp.numeroDocumento,
          nombreRazonSocial: imp.nombreRazonSocial,
          domicilio: imp.domicilio,
        };
        if (imp.numeroDocumento) dims.nit = imp.numeroDocumento;
      }
      if (imp.departamentoDestino) {
        dims.departamentoDestino = imp.departamentoDestino;
      }

      const log = factura.logistica ?? {};
      if (log.paisUltimaProcedencia) {
        dims.paisUltimaProcedencia = log.paisUltimaProcedencia;
      }
      if (log.manifiesto) dims.manifiesto = log.manifiesto;
      if (log.medioTransporte) {
        dims.transporteHastaFrontera = log.medioTransporte;
      }

      // El Incoterm dice si el precio ya cubría flete y seguro; es más fiable
      // que inferirlo de que el monto venga en cero.
      const totales = factura.totales ?? {};
      const incoterm = factura.factura?.incoterm;
      dims.transaccion = {
        valorFobUsd: totales.subtotal ?? 0,
        fleteDeclaradoSiNo:
          fleteIncluidoEnPrecio(incoterm) ?? (totales.flete ?? 0) > 0,
        fleteUsd: totales.flete ?? 0,
        seguroDeclaradoSiNo:
          seguroIncluidoEnPrecio(incoterm) ?? (totales.seguro ?? 0) > 0,
        seguroUsd: totales.seguro ?? 0,
        cantidadBultos: log.cantidadBultos ?? 0,
        pesoBruto: log.pesoBrutoKg ?? 0,
        pesoNeto: log.pesoNetoKg ?? 0,
      };
    } else if (input.subpartida) {
      const sub = await this.subpartidaRepository.findByCode(input.subpartida);
      const item: FacturaItem = {
        id: 'i1',
        descripcion: sub?.desc ?? '',
        cantidad: 0,
        unidad: 'UND',
        precioUnit: 0,
        subtotal: 0,
        subpartida: input.subpartida,
        confidence: 100,
        aiSuggested: false,
        clasificada: true,
      };
      dims.items = [item];
      dims.proveedor = '';
    }

    return this.dimsRepository.save(dims);
  }

  /**
   * La factura guarda la confianza con sus propias rutas de campo; el
   * formulario de la DIMS pregunta por otras. Esta tabla es el mismo mapeo que
   * hace `execute` con los valores, aplicado a su confianza: si un dato viaja
   * de `logistica.pesoBrutoKg` a `transaccion.pesoBruto`, su confianza también.
   */
  private static readonly CAMPO_DIMS_DE: Record<string, string> = {
    'proveedor.nombre': 'proveedor.nombre',
    'proveedor.direccion': 'proveedor.direccion',
    'proveedor.pais': 'proveedor.pais',
    'proveedor.rfc': 'proveedor.rfc',
    'importador.nombreRazonSocial': 'importador.nombreRazonSocial',
    'importador.numeroDocumento': 'importador.numeroDocumento',
    'importador.domicilio': 'importador.domicilio',
    'importador.departamentoDestino': 'importador.departamentoDestino',
    'logistica.paisUltimaProcedencia': 'transporte.paisUltimaProcedencia',
    'logistica.medioTransporte': 'transporte.medioHastaFrontera',
    'logistica.manifiesto': 'transporte.manifiesto',
    'logistica.cantidadBultos': 'transaccion.cantidadBultos',
    'logistica.pesoBrutoKg': 'transaccion.pesoBruto',
    'logistica.pesoNetoKg': 'transaccion.pesoNeto',
    'totales.subtotal': 'transaccion.valorFobUsd',
    'totales.flete': 'transaccion.fleteUsd',
    'totales.seguro': 'transaccion.seguroUsd',
  };

  private confianzasDelFormulario(
    deLaFactura?: Record<string, number>,
  ): Record<string, number> | undefined {
    if (!deLaFactura) return undefined;
    const out: Record<string, number> = {};
    for (const [origen, valor] of Object.entries(deLaFactura)) {
      const destino = CreateDimsUseCase.CAMPO_DIMS_DE[origen];
      if (destino) out[destino] = valor;
    }
    // El tipo de documento no lo declara ningún papel: lo adivina
    // `tipoDocumentoDe` mirando cuántos dígitos tiene el número. Es una
    // deducción, y se marca más baja que el dato del que salió.
    if (out['importador.numeroDocumento'] !== undefined) {
      out['importador.tipoDocumento'] = Math.min(
        out['importador.numeroDocumento'],
        60,
      );
    }
    return out;
  }

  // Un NIT boliviano es puramente numérico y largo; una cédula es más corta.
  // Solo se usa como sugerencia: el usuario puede corregirlo en el formulario.
  private tipoDocumentoDe(numero?: string): string | undefined {
    if (!numero) return undefined;
    const limpio = numero.replace(/\D/g, '');
    if (limpio.length === 0) return undefined;
    return limpio.length >= 10 ? 'NIT' : 'CI - Cédula de Identidad';
  }

  // Referencia interna del borrador. Deliberadamente NO tiene formato de código
  // DIMS oficial: ese número lo emite SUMA, no esta plataforma.
  private generateDraftRef(): string {
    const year = new Date().getFullYear();
    const seq = Math.floor(10000 + Math.random() * 89999);
    return `BORRADOR-${year}-${seq}`;
  }
}
