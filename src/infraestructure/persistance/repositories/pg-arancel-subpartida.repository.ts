import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CandidatoSubpartida,
  LineaId,
  NotaLegal,
  Subpartida,
  SubpartidaMatch,
} from '../../../core/domain/models/subpartida';
import { SubpartidaRepository } from '../../../core/domain/ports/outbound/subpartida.repository';
import { ARANCEL_DATA_SOURCE } from '../arancel.datasource';

/** Fila cruda de `buscador_arancelario.arancel_busqueda`. */
interface FilaArancel {
  codigo: string;
  codigo_fmt: string;
  capitulo: string;
  partida: string;
  subpartida6: string;
  seccion: string | null;
  desc_capitulo: string | null;
  desc_hoja: string | null;
  ruta: string | null;
  ruta_legible: string | null;
  desc_minimas: string | null;
  unidad: string | null;
  ga: string | null;
  iva: string | null;
  prohibida: string | null;
  score?: number;
}

const COLUMNAS = `
  codigo, codigo_fmt, capitulo, partida, subpartida6, seccion, desc_capitulo,
  desc_hoja, ruta, ruta_legible, desc_minimas, unidad, ga, iva, prohibida`;

@Injectable()
export class PgArancelSubpartidaRepository implements SubpartidaRepository {
  constructor(
    @Inject(ARANCEL_DATA_SOURCE) private readonly ds: DataSource,
  ) {}

  // ── Mapeo ────────────────────────────────────────────────────────────────

  private toModel(f: FilaArancel): Subpartida {
    const ga = this.num(f.ga);
    const iva = this.num(f.iva);
    return new Subpartida({
      code: f.codigo_fmt,
      desc: this.descripcionVisible(f),
      // El arancel real no tiene el concepto de "línea" del seed de demo.
      linea: null,
      arancel: ga,
      iva,
      ice: 0, // El ICE del arancel es por régimen (cigarros, vehículos, etc.), no un % único.
      gravamen: this.resumenGravamen(ga, iva),
      ruta: f.ruta_legible ?? undefined,
      descHoja: this.limpiarGuiones(f.desc_hoja) || undefined,
      capitulo: f.capitulo,
      descCapitulo: f.desc_capitulo ?? undefined,
      seccion: f.seccion ?? undefined,
      unidad: f.unidad ?? undefined,
      descripcionesMinimas: f.desc_minimas ?? undefined,
      prohibida: f.prohibida ?? undefined,
    });
  }

  private num(v: string | null): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * El texto legal de la hoja arranca con los guiones del nivel jerárquico
   * ("- - - Los demás"). Sirven para leer el arancel en papel, no en pantalla.
   */
  private limpiarGuiones(desc: string | null): string {
    return (desc ?? '').replace(/^[\s-]+/, '').trim();
  }

  /**
   * La hoja sola casi nunca se entiende: buena parte del arancel dice "Los
   * demás". Se arma con el primer tramo de la ruta (el encabezado de partida,
   * que es el que nombra la mercancía) más el último (lo que distingue a esta
   * hoja de sus hermanas).
   *
   * Los dos últimos tramos no sirven: cuando el padre también es residual
   * queda "Los demás > De absorción, eléctricos", que no dice qué es.
   * La ruta completa va aparte, en el campo `ruta`.
   */
  private descripcionVisible(f: FilaArancel): string {
    const tramos = (f.ruta_legible ?? '')
      .split('>')
      .map((t) => t.replace(/[\s:.]+$/, '').trim())
      .filter(Boolean);

    if (tramos.length === 0) {
      return this.limpiarGuiones(f.desc_hoja) || f.codigo_fmt;
    }
    if (tramos.length === 1) return tramos[0];

    const encabezado = this.acortar(tramos[0], 70);
    const hoja = this.acortar(tramos[tramos.length - 1], 90);
    return `${encabezado} > ${hoja}`;
  }

  /** Corta en el último espacio antes del tope, para no partir una palabra. */
  private acortar(texto: string, max: number): string {
    if (texto.length <= max) return texto;
    const corte = texto.lastIndexOf(' ', max);
    return `${texto.slice(0, corte > max * 0.6 ? corte : max).trimEnd()}…`;
  }

  private resumenGravamen(ga: number, iva: number): string {
    return `GA ${ga}% · IVA ${iva}%`;
  }

  // ── Consultas ────────────────────────────────────────────────────────────

  async searchRanked(termino: string, limit = 20): Promise<SubpartidaMatch[]> {
    const q = (termino ?? '').trim();
    if (!q) return [];

    const filas: FilaArancel[] = await this.ds.query(
      `SELECT ${COLUMNAS}, score
         FROM buscador_arancelario.buscar_subpartidas($1, $2)`,
      [q, limit],
    );
    if (filas.length === 0) return [];

    // El score de la función no está acotado (una coincidencia por código suma
    // 20). Se normaliza contra el mejor de la tanda para que el frontend reciba
    // siempre 0–1.
    const max = Math.max(...filas.map((f) => Number(f.score) || 0), 1);

    return filas.map((f, i) => ({
      ...this.toModel(f),
      score: (Number(f.score) || 0) / max,
      scoreRaw: Number(f.score) || 0,
      bestMatch: i === 0,
    }));
  }

  async findByCodes(codigos: string[]): Promise<Subpartida[]> {
    const digitos = [...new Set((codigos ?? []).map((c) => (c ?? '').replace(/\D/g, '')))]
      .filter(Boolean);
    if (digitos.length === 0) return [];

    const filas: FilaArancel[] = await this.ds.query(
      `SELECT ${COLUMNAS}
         FROM buscador_arancelario.arancel_busqueda
        WHERE codigo = ANY($1)`,
      [digitos],
    );
    return filas.map((f) => this.toModel(f));
  }

  async candidatosPorCodigos(codigos: string[]): Promise<CandidatoSubpartida[]> {
    const digitos = [...new Set((codigos ?? []).map((c) => (c ?? '').replace(/\D/g, '')))]
      .filter(Boolean);
    if (digitos.length === 0) return [];

    const filas: FilaArancel[] = await this.ds.query(
      `SELECT codigo_fmt, capitulo, subpartida6, desc_capitulo, ruta_legible,
              desc_hoja, desc_minimas, unidad, ga, iva, prohibida
         FROM buscador_arancelario.arancel_busqueda
        WHERE codigo = ANY($1)`,
      [digitos],
    );

    return filas.map((f) => ({
      code: f.codigo_fmt,
      capitulo: f.capitulo,
      subpartida6: f.subpartida6,
      descCapitulo: f.desc_capitulo,
      ruta: f.ruta_legible,
      descHoja: this.limpiarGuiones(f.desc_hoja) || null,
      descripcionesMinimas: f.desc_minimas,
      unidad: f.unidad,
      ga: this.num(f.ga),
      iva: this.num(f.iva),
      prohibida: f.prohibida,
      score: 0,
      esHermano: false,
    }));
  }

  async search(termino: string): Promise<Subpartida[]> {
    return this.searchRanked(termino, 20);
  }

  async buscarCandidatos(
    termino: string,
    limit = 24,
  ): Promise<CandidatoSubpartida[]> {
    const q = (termino ?? '').trim();
    if (!q) return [];

    // Tope por capítulo proporcional al total, para que al bajar el límite no
    // se coma la diversidad: con 24 y 8 por capítulo entran al menos tres
    // capítulos, que es lo que le permite al modelo corregir un error del
    // motor léxico.
    const porCapitulo = Math.max(6, Math.ceil(limit / 3));

    const filas: Array<FilaArancel & { es_hermano: boolean }> =
      await this.ds.query(
        `SELECT codigo_fmt, capitulo, subpartida6, desc_capitulo, ruta_legible,
                desc_hoja, desc_minimas, unidad, ga, iva, prohibida, score, es_hermano
           FROM buscador_arancelario.candidatos_clasificacion(
                  $1, $2, p_por_capitulo => $3)`,
        [q, limit, porCapitulo],
      );

    return filas.map((f) => ({
      code: f.codigo_fmt,
      capitulo: f.capitulo,
      subpartida6: f.subpartida6,
      descCapitulo: f.desc_capitulo,
      ruta: f.ruta_legible,
      descHoja: this.limpiarGuiones(f.desc_hoja) || null,
      descripcionesMinimas: f.desc_minimas,
      unidad: f.unidad,
      ga: this.num(f.ga),
      iva: this.num(f.iva),
      prohibida: f.prohibida,
      score: Number(f.score) || 0,
      esHermano: !!f.es_hermano,
    }));
  }

  async notasDeCapitulos(capitulos: string[]): Promise<NotaLegal[]> {
    const caps = [...new Set((capitulos ?? []).filter(Boolean))];
    if (caps.length === 0) return [];

    const filas: Array<{
      tipo: string;
      clave: string;
      titulo: string | null;
      nota: string;
    }> = await this.ds.query(
      `SELECT tipo, clave, titulo, nota
         FROM buscador_arancelario.notas_para_prompt($1)`,
      [caps],
    );

    return filas.map((f) => ({
      tipo: f.tipo === 'seccion' ? 'seccion' : 'capitulo',
      clave: f.clave,
      titulo: f.titulo,
      nota: f.nota,
    }));
  }

  async findByCode(code: string): Promise<Subpartida | null> {
    // Se busca por dígitos: así "8471.60.20.00", "8471602000" y "8471 60 20 00"
    // resuelven al mismo registro.
    const digitos = (code ?? '').replace(/\D/g, '');
    if (!digitos) return null;

    const filas: FilaArancel[] = await this.ds.query(
      `SELECT ${COLUMNAS}
         FROM buscador_arancelario.arancel_busqueda
        WHERE codigo = $1
        LIMIT 1`,
      [digitos],
    );
    return filas.length ? this.toModel(filas[0]) : null;
  }

  async contarHojas(): Promise<number> {
    const [{ n }] = await this.ds.query(
      `SELECT count(*)::int AS n FROM buscador_arancelario.arancel_busqueda`,
    );
    return Number(n) || 0;
  }

  async findAll(): Promise<Subpartida[]> {
    // 8.139 hojas. Se expone acotado a propósito: devolver el arancel entero
    // por HTTP no tiene ningún consumidor real y son varios MB.
    const filas: FilaArancel[] = await this.ds.query(
      `SELECT ${COLUMNAS}
         FROM buscador_arancelario.arancel_busqueda
        ORDER BY nc_order
        LIMIT 500`,
    );
    return filas.map((f) => this.toModel(f));
  }

  /**
   * El Arancel 2026 no tiene el concepto de "línea" (blanca/negra/electrónica):
   * era metadata del seed de demo. Se conserva en el port por compatibilidad.
   */
  async findByLinea(_linea: LineaId): Promise<Subpartida[]> {
    return [];
  }
}
