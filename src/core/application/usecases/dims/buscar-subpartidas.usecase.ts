import { Injectable, Inject } from '@nestjs/common';
import { AI_SERVICE, AIService } from '../../../domain/ports/outbound/ai.service';
import { Subpartida } from '../../../domain/models/subpartida';

@Injectable()
export class BuscarSubpartidasUseCase {
  constructor(
    @Inject(AI_SERVICE)
    private readonly aiService: AIService,
  ) {}

  async execute(termino: string, linea?: string): Promise<Subpartida[]> {
    try {
      const result = await this.aiService.buscarSubpartidas(termino, { linea });
      if (Array.isArray(result)) return result as Subpartida[];
      return [];
    } catch (err) {
      console.error('[BuscarSubpartidasUseCase] Error calling AI service:', err);
      return [];
    }
  }
}
