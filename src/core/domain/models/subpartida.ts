export type LineaId = 'blanca' | 'negra' | 'electronica';

export class Subpartida {
  code: string;
  desc: string;
  /**
   * Categoría comercial del seed de demo. El Arancel 2026 no tiene un campo
   * equivalente, así que viene `null` para todo código que salga del arancel
   * real. Se mantiene por compatibilidad del contrato con el frontend.
   */
  linea: LineaId | null;
  arancel: number; // Gravamen Arancelario (%)
  iva: number; // IVA efectivo (%)
  ice: number; // ICE (%)
  gravamen: string; // Resumen de carga tributaria

  // ── Datos del Arancel 2026 ────────────────────────────────────────────────
  /** Ruta jerárquica completa, con acentos: "Café... > Café tostado: > Molido". */
  ruta?: string;
  /** Texto legal propio de la hoja. Suele ser residual ("- - - Los demás"). */
  descHoja?: string;
  capitulo?: string;
  descCapitulo?: string;
  seccion?: string;
  /** Unidad de medida declarable (kg, u, l...). */
  unidad?: string;
  /** Descripciones mínimas exigidas por aduana para esta subpartida. */
  descripcionesMinimas?: string;
  /** No nulo si la mercancía está prohibida de importación. */
  prohibida?: string;

  constructor(partial: Partial<Subpartida>) {
    Object.assign(this, partial);
  }
}

export interface SubpartidaMatch extends Subpartida {
  /** Normalizado 0–1 contra el mejor de la tanda. Para mostrar. */
  score: number;
  /**
   * Score sin normalizar. Es el que sirve para juzgar si la búsqueda léxica
   * encontró algo bueno o si conviene complementar con la semántica: el
   * normalizado siempre da 1 en el primer puesto, aunque sea malo.
   */
  scoreRaw?: number;
  bestMatch: boolean;
  /** Entró por similitud semántica y no por coincidencia de palabras. */
  origenSemantico?: boolean;
}

/**
 * Candidato para el rerank del LLM. No es lo mismo que un resultado de
 * búsqueda: acá interesan la ruta completa y el capítulo (para traer sus notas
 * legales), no una descripción linda para mostrar.
 */
export interface CandidatoSubpartida {
  code: string;
  capitulo: string;
  subpartida6: string;
  descCapitulo: string | null;
  ruta: string | null;
  descHoja: string | null;
  descripcionesMinimas: string | null;
  unidad: string | null;
  ga: number;
  iva: number;
  prohibida: string | null;
  score: number;
  /**
   * Entró por ser hermano de un candidato bien rankeado, no por mérito propio.
   * La RGI 6 exige comparar entre subpartidas del mismo nivel.
   */
  esHermano: boolean;
}

/** Nota legal de capítulo o de sección del Arancel. */
export interface NotaLegal {
  tipo: 'capitulo' | 'seccion';
  clave: string;
  titulo: string | null;
  nota: string;
}
