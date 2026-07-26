import {
  CandidatoSubpartida,
  LineaId,
  NotaLegal,
  Subpartida,
  SubpartidaMatch,
} from '../../models/subpartida';

export interface SubpartidaRepository {
  /**
   * Candidatos para el rerank del LLM. A diferencia de `searchRanked`,
   * garantiza diversidad de capítulos y arrastra los hermanos de los mejores
   * candidatos (sin ellos no se puede aplicar la RGI 6).
   */
  buscarCandidatos(
    termino: string,
    limit?: number,
  ): Promise<CandidatoSubpartida[]>;

  /** Notas legales de capítulo y sección, para aplicar la RGI 1. */
  notasDeCapitulos(capitulos: string[]): Promise<NotaLegal[]>;

  /**
   * Hidrata códigos sueltos. Lo usa la búsqueda semántica: pgvector vive en la
   * base de la app y solo devuelve códigos, los datos están en la del arancel.
   */
  findByCodes(codigos: string[]): Promise<Subpartida[]>;

  /** Igual que `findByCodes` pero con la forma que necesita el rerank. */
  candidatosPorCodigos(codigos: string[]): Promise<CandidatoSubpartida[]>;

  /** Total de hojas declarables. Sirve para medir cobertura de embeddings. */
  contarHojas(): Promise<number>;

  /**
   * Búsqueda rankeada. El ranking lo resuelve el motor de persistencia
   * (FTS español + trigram + prefijo de código), no la capa de aplicación:
   * tokenizar en Node y hacer una consulta por token era N+1 y no podía
   * ordenar por relevancia.
   */
  searchRanked(termino: string, limit?: number): Promise<SubpartidaMatch[]>;
  search(termino: string, linea?: string): Promise<Subpartida[]>;
  findAll(): Promise<Subpartida[]>;
  findByCode(code: string): Promise<Subpartida | null>;
  findByLinea(linea: LineaId): Promise<Subpartida[]>;
}

export const SUBPARTIDA_REPOSITORY = 'SUBPARTIDA_REPOSITORY';
