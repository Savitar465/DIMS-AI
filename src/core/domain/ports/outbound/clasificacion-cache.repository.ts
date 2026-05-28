export interface ClasificacionCacheEntry {
  hash: string;
  subpartida: string | null;
  confidence: number;
  razon?: string;
  descripcionMuestra: string;
}

export interface ClasificacionCacheRepository {
  findByHashes(hashes: string[]): Promise<ClasificacionCacheEntry[]>;
  saveMany(entries: ClasificacionCacheEntry[]): Promise<void>;
}

export const CLASIFICACION_CACHE_REPOSITORY = 'CLASIFICACION_CACHE_REPOSITORY';
