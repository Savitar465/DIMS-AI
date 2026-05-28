import { Inject, Injectable } from '@nestjs/common';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../../../domain/ports/outbound/subpartida.repository';
import { Subpartida, SubpartidaMatch } from '../../../domain/models/subpartida';

export interface SearchSubpartidasResult {
  query: string;
  resultados: SubpartidaMatch[];
}

// Stopwords cortas para tokenización del query.
const STOPWORDS = new Set([
  'para', 'con', 'sin', 'del', 'los', 'las', 'una', 'uno', 'unos', 'unas',
  'que', 'por', 'mas', 'pero', 'como', 'este', 'esta', 'estos', 'estas',
  'and', 'the', 'for', 'with', 'from',
]);

const MAX_RESULTS = 20;

@Injectable()
export class SearchSubpartidasUseCase {
  constructor(
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
  ) {}

  async execute(
    query: string,
    linea?: string,
  ): Promise<SearchSubpartidasResult> {
    const q = (query ?? '').trim();
    if (!q) return { query: q, resultados: [] };

    // Búsqueda directa en DB (sin IA): tokeniza el query, busca cada token
    // en el repo, agrega por código sumando el número de tokens que matchean.
    const tokens = this.tokenizar(q);
    // Si no quedan tokens significativos, cae a búsqueda literal con el query.
    const terms = tokens.length > 0 ? tokens : [q];

    const scored = new Map<string, { sub: Subpartida; score: number }>();
    for (const t of terms) {
      const hits = await this.subpartidaRepository.search(t, linea);
      for (const h of hits) {
        const prev = scored.get(h.code);
        if (prev) prev.score += 1;
        else scored.set(h.code, { sub: h, score: 1 });
      }
    }

    const max = Math.max(1, ...[...scored.values()].map((s) => s.score));
    const resolved: SubpartidaMatch[] = [...scored.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((x) => ({
        ...x.sub,
        score: x.score / max, // normalizado 0–1
        bestMatch: false,
      }));

    if (resolved.length > 0) resolved[0].bestMatch = true;
    return { query: q, resultados: resolved };
  }

  private tokenizar(text: string): string[] {
    const norm = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of norm.split(/[^a-z0-9]+/)) {
      if (t.length < 3 || STOPWORDS.has(t) || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }
}
