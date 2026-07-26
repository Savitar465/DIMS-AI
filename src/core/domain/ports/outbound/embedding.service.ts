export interface EmbeddingService {
  /**
   * Vector de una consulta de búsqueda.
   *
   * Los modelos de embedding proyectan consultas y documentos en espacios
   * distintos según el `taskType`, así que esto NO sirve para embeber el
   * catálogo: para eso está `scripts/backfill-embeddings.ts`, que usa
   * RETRIEVAL_DOCUMENT. Mezclar los dos degrada la recuperación en silencio.
   *
   * Devuelve `null` si el servicio no está disponible o falla: la búsqueda
   * semántica es un complemento, y quedarse sin ella no debe romper la
   * búsqueda léxica.
   */
  embedConsulta(texto: string): Promise<number[] | null>;

  /** false si falta la API key: permite saltear el camino semántico sin costo. */
  estaDisponible(): boolean;
}

export const EMBEDDING_SERVICE = 'EMBEDDING_SERVICE';
