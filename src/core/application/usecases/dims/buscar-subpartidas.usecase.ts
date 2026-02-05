import { Injectable, Inject } from '@nestjs/common';
import { AI_SERVICE, AIService } from '../../../../core/domain/ports/outbound/ai.service';
import { Subpartida } from '../../../../core/domain/models/subpartida';

@Injectable()
export class BuscarSubpartidasUseCase {
  constructor(
    @Inject(AI_SERVICE)
    private readonly aiService: AIService,
  ) {}

  async execute(termino: string, linea?: string): Promise<Subpartida[]> {
    return this.aiService.buscarSubpartidas(termino, { linea });
  }
}
