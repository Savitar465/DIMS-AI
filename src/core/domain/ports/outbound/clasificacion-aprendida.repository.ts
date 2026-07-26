export interface ClasificacionAprendida {
  hash: string;
  descripcion: string;
  subpartida: string;
  capitulo: string;
  veces: number;
}

export interface ClasificacionAprendidaRepository {
  /** Registra una confirmación humana. Si ya existía, incrementa `veces`. */
  registrar(entrada: {
    hash: string;
    descripcion: string;
    subpartida: string;
    confirmadoPor?: string;
  }): Promise<void>;

  /** Camino rápido: resuelve sin LLM cuando vuelve la misma mercancía. */
  findByHashes(hashes: string[]): Promise<ClasificacionAprendida[]>;

  /**
   * Ejemplos confirmados dentro de los capítulos dados, para el prompt.
   * Acotado a los capítulos de los candidatos: ejemplos de otro capítulo son
   * ruido y empujan al modelo hacia donde no corresponde.
   */
  ejemplosPorCapitulo(
    capitulos: string[],
    limite?: number,
  ): Promise<ClasificacionAprendida[]>;
}

export const CLASIFICACION_APRENDIDA_REPOSITORY =
  'CLASIFICACION_APRENDIDA_REPOSITORY';
