import { Injectable } from '@nestjs/common';
import { EmbeddingService } from '../../../core/domain/ports/outbound/embedding.service';

const MODELO = 'gemini-embedding-001';
const DIMENSIONES = 768;
const API = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:embedContent`;

/** Tope del cache de consultas. Cada vector son ~3 KB. */
const MAX_CACHE = 500;

@Injectable()
export class GeminiEmbeddingService implements EmbeddingService {
  private readonly apiKey = process.env.GEMINI_API_KEY ?? '';

  /**
   * Cache de consultas ya embebidas, con desalojo del más viejo.
   *
   * Los usuarios repiten búsquedas todo el tiempo (y el frontend dispara la
   * misma consulta al abrir el buscador de cada ítem). Sin esto, cada
   * repetición gasta una llamada de una cuota que ya es ajustada.
   */
  private readonly cache = new Map<string, number[]>();

  estaDisponible(): boolean {
    return this.apiKey.length > 0;
  }

  async embedConsulta(texto: string): Promise<number[] | null> {
    const clave = (texto ?? '').trim().toLowerCase();
    if (!clave || !this.estaDisponible()) return null;

    const enCache = this.cache.get(clave);
    if (enCache) {
      // Reinsertar para que el más usado no sea el primero en caer.
      this.cache.delete(clave);
      this.cache.set(clave, enCache);
      return enCache;
    }

    try {
      const res = await fetch(`${API}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${MODELO}`,
          content: { parts: [{ text: clave.slice(0, 2000) }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: DIMENSIONES,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.warn(
          `[Embedding] ${res.status} al embeber la consulta: ${txt.slice(0, 200)}`,
        );
        return null;
      }

      const json: any = await res.json();
      const valores: number[] | undefined = json?.embedding?.values;
      if (!Array.isArray(valores) || valores.length !== DIMENSIONES) {
        console.warn('[Embedding] respuesta sin vector utilizable');
        return null;
      }

      if (this.cache.size >= MAX_CACHE) {
        this.cache.delete(this.cache.keys().next().value as string);
      }
      this.cache.set(clave, valores);
      return valores;
    } catch (err) {
      // Sin semántica se sigue con lo léxico; no vale romper la búsqueda.
      console.warn('[Embedding] error de red:', err);
      return null;
    }
  }
}
