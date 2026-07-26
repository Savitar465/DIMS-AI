import { Inject, Injectable } from '@nestjs/common';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../../domain/ports/outbound/subpartida.repository';
import {
  EMBEDDING_SERVICE,
  EmbeddingService,
} from '../../domain/ports/outbound/embedding.service';
import {
  BUSQUEDA_SEMANTICA_REPOSITORY,
  BusquedaSemanticaRepository,
} from '../../domain/ports/outbound/busqueda-semantica.repository';
import {
  CandidatoSubpartida,
  SubpartidaMatch,
} from '../../domain/models/subpartida';

/**
 * Score léxico crudo por debajo del cual se considera que la búsqueda de
 * palabras no encontró nada convincente.
 *
 * Calibrado sobre esta base: una consulta que matchea bien saca 2–5; los
 * fallos medidos ("SHAMPOO ANTICASPA", "DISCO CORTE METAL") quedan abajo de 1
 * o directamente sin resultados.
 */
const UMBRAL_LEXICO_DEBIL = 1.2;

/** Mínimo de resultados para no considerar pobre a la búsqueda léxica. */
const MINIMO_RESULTADOS = 5;

/**
 * Fracción del arancel que tiene que estar embebida para usar la semántica.
 *
 * Un índice vectorial a medio poblar es PEOR que no tenerlo: siempre devuelve
 * el vecino más cercano, así que con el 11% del arancel cargado contesta con
 * total confianza la mejor opción de un subconjunto arbitrario, y esa opción
 * puede ser de otro capítulo. El fallo es silencioso — no hay error, solo
 * resultados sutilmente equivocados. Mejor no usarla hasta que esté completa.
 */
const COBERTURA_MINIMA = 0.98;

/** Cada cuánto se revisa la cobertura. El backfill corre fuera del proceso. */
const TTL_COBERTURA_MS = 5 * 60 * 1000;

@Injectable()
export class BusquedaHibridaService {
  constructor(
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidas: SubpartidaRepository,
    @Inject(EMBEDDING_SERVICE)
    private readonly embeddings: EmbeddingService,
    @Inject(BUSQUEDA_SEMANTICA_REPOSITORY)
    private readonly semantica: BusquedaSemanticaRepository,
  ) {}

  /**
   * Búsqueda léxica, completada con semántica solo cuando hace falta.
   *
   * El orden importa por costo: lo léxico son 35 ms y cero llamadas a la API;
   * lo semántico agrega una llamada de embedding (~300 ms) y consume una cuota
   * ajustada. Gastarla en toda búsqueda —la mayoría de las cuales lo léxico ya
   * resuelve bien— sería pagar latencia y cuota para no cambiar el resultado.
   */
  async buscar(query: string, limit = 20): Promise<SubpartidaMatch[]> {
    const q = (query ?? '').trim();
    if (!q) return [];

    const lexicos = await this.subpartidas.searchRanked(q, limit);
    if (!this.esDebil(lexicos)) return lexicos;

    const semanticos = await this.buscarSemantico(q, limit);
    if (semanticos.length === 0) return lexicos;

    return this.fusionar(lexicos, semanticos, limit);
  }

  /**
   * Candidatos para el rerank del LLM. Acá la semántica se usa SIEMPRE, no
   * solo como respaldo: la llamada de embedding es despreciable frente a la de
   * clasificación que viene después, y un capítulo que no entra en los
   * candidatos es un error que el modelo ya no puede corregir.
   */
  async candidatos(query: string, limit = 40): Promise<CandidatoSubpartida[]> {
    const q = (query ?? '').trim();
    if (!q) return [];

    const lexicos = await this.subpartidas.buscarCandidatos(q, limit);
    const semanticos = await this.buscarSemantico(q, Math.ceil(limit / 2));
    if (semanticos.length === 0) return lexicos;

    const yaEstan = new Set(lexicos.map((c) => c.code));
    const faltantes = semanticos
      .map((s) => s.codigo)
      .filter((c) => !yaEstan.has(this.formatear(c)));
    if (faltantes.length === 0) return lexicos;

    const extra = await this.subpartidas.candidatosPorCodigos(faltantes);
    // Los semánticos van después de los léxicos: el orden del prompt sigue
    // reflejando la confianza de la recuperación.
    return [...lexicos, ...extra].slice(0, limit + extra.length);
  }

  private cobertura: { ok: boolean; vence: number } = { ok: false, vence: 0 };

  /**
   * Si la búsqueda semántica está lista: hay API key y el backfill cubre casi
   * todo el arancel. Se cachea porque, si no, cada búsqueda haría dos COUNT
   * contra dos bases distintas.
   */
  async estaDisponible(): Promise<boolean> {
    if (!this.embeddings.estaDisponible()) return false;

    const ahora = Date.now();
    if (ahora < this.cobertura.vence) return this.cobertura.ok;

    try {
      const [embebidas, hojas] = await Promise.all([
        this.semantica.contarEmbeddings(),
        this.subpartidas.contarHojas(),
      ]);
      const ok = hojas > 0 && embebidas / hojas >= COBERTURA_MINIMA;
      if (!ok) {
        console.warn(
          `[Búsqueda] semántica desactivada: ${embebidas}/${hojas} subpartidas embebidas ` +
            `(hace falta ${Math.round(COBERTURA_MINIMA * 100)}%). Correr "npm run embeddings:backfill".`,
        );
      }
      this.cobertura = { ok, vence: ahora + TTL_COBERTURA_MS };
      return ok;
    } catch (err) {
      console.warn('[Búsqueda] no se pudo medir la cobertura de embeddings:', err);
      this.cobertura = { ok: false, vence: ahora + TTL_COBERTURA_MS };
      return false;
    }
  }

  // ── Interno ──────────────────────────────────────────────────────────────

  private esDebil(resultados: SubpartidaMatch[]): boolean {
    if (resultados.length < MINIMO_RESULTADOS) return true;
    const mejor = resultados[0]?.scoreRaw ?? 0;
    return mejor < UMBRAL_LEXICO_DEBIL;
  }

  private async buscarSemantico(q: string, limit: number) {
    if (!(await this.estaDisponible())) return [];
    const vector = await this.embeddings.embedConsulta(q);
    if (!vector) return [];
    try {
      return await this.semantica.buscar(vector, limit);
    } catch (err) {
      console.warn('[Búsqueda] falló la parte semántica:', err);
      return [];
    }
  }

  /** El código viene sin puntos desde pgvector; el resto del sistema los usa. */
  private formatear(codigo: string): string {
    const d = (codigo ?? '').replace(/\D/g, '');
    if (d.length !== 10) return codigo;
    return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}.${d.slice(8, 10)}`;
  }

  /**
   * Fusión por rango recíproco (RRF).
   *
   * Se fusiona por posición y no por score porque los dos puntajes no son
   * comparables: el léxico es una suma sin tope y la similitud coseno está
   * entre 0 y 1. Normalizarlos para sumarlos requeriría calibrar una escala
   * que cambia con cada consulta; el rango, en cambio, siempre significa lo
   * mismo. La constante 60 es la habitual: amortigua las primeras posiciones
   * para que un solo motor no domine.
   */
  private async fusionar(
    lexicos: SubpartidaMatch[],
    semanticos: Array<{ codigo: string; similitud: number }>,
    limit: number,
  ): Promise<SubpartidaMatch[]> {
    const K = 60;
    const puntos = new Map<string, number>();
    const sumar = (code: string, rango: number) =>
      puntos.set(code, (puntos.get(code) ?? 0) + 1 / (K + rango));

    lexicos.forEach((m, i) => sumar(m.code, i + 1));

    const codigosSem = semanticos.map((s) => this.formatear(s.codigo));
    codigosSem.forEach((code, i) => sumar(code, i + 1));

    // Hidratar solo los semánticos que no estaban ya en la lista léxica.
    const porCodigo = new Map(lexicos.map((m) => [m.code, m]));
    const faltantes = codigosSem.filter((c) => !porCodigo.has(c));
    if (faltantes.length > 0) {
      const hidratados = await this.subpartidas.findByCodes(faltantes);
      for (const s of hidratados) {
        porCodigo.set(s.code, {
          ...s,
          score: 0,
          bestMatch: false,
          origenSemantico: true,
        });
      }
    }

    const ordenados = [...puntos.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => porCodigo.get(code))
      .filter((m): m is SubpartidaMatch => Boolean(m))
      .slice(0, limit);

    const max = Math.max(...ordenados.map((_, i) => 1 / (K + i + 1)), 1e-9);
    return ordenados.map((m, i) => ({
      ...m,
      score: 1 / (K + i + 1) / max,
      bestMatch: i === 0,
    }));
  }
}
