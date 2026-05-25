import { Inject, Injectable } from '@nestjs/common';
import {
  AI_SERVICE,
  AIService,
} from '../../../domain/ports/outbound/ai.service';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../../../domain/ports/outbound/subpartida.repository';
import { Subpartida, SubpartidaMatch } from '../../../domain/models/subpartida';

export interface SearchSubpartidasResult {
  query: string;
  resultados: SubpartidaMatch[];
}

@Injectable()
export class SearchSubpartidasUseCase {
  constructor(
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
  ) {}

  async execute(
    query: string,
    linea?: string,
  ): Promise<SearchSubpartidasResult> {
    if (!query || !query.trim()) {
      return { query: query ?? '', resultados: [] };
    }

    let matches: any[] = [];
    try {
      matches = await this.aiService.buscarSubpartidas(query, { linea });
    } catch {
      matches = [];
    }

    const resolved: SubpartidaMatch[] = [];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const code = m?.code ?? m?.codigo;
      if (!code) continue;
      const sub = await this.subpartidaRepository.findByCode(code);
      if (!sub) continue;
      if (linea && sub.linea !== linea) continue;
      resolved.push({
        ...sub,
        score: typeof m?.score === 'number' ? m.score : Math.max(0.5, 1 - i * 0.1),
        bestMatch: false,
      });
    }

    // Fallback to plain repository search if the AI returned nothing usable.
    if (resolved.length === 0) {
      const found = await this.subpartidaRepository.search(query, linea);
      found.forEach((sub: Subpartida, i: number) =>
        resolved.push({ ...sub, score: Math.max(0.4, 0.9 - i * 0.1), bestMatch: false }),
      );
    }

    resolved.sort((a, b) => b.score - a.score);
    if (resolved.length > 0) resolved[0].bestMatch = true;

    return { query, resultados: resolved };
  }
}
