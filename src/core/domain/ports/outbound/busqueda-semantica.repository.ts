export interface HitSemantico {
  codigo: string;
  /** 0–1; 1 es idéntico. Derivada de la distancia coseno. */
  similitud: number;
}

export interface BusquedaSemanticaRepository {
  /** Vecinos más cercanos al vector de la consulta. */
  buscar(embedding: number[], limit?: number): Promise<HitSemantico[]>;

  /** Cuántas subpartidas tienen embedding. 0 = backfill sin correr. */
  contarEmbeddings(): Promise<number>;
}

export const BUSQUEDA_SEMANTICA_REPOSITORY = 'BUSQUEDA_SEMANTICA_REPOSITORY';
