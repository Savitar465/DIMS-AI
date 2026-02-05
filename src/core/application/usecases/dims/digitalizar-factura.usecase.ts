import { Injectable, Inject } from '@nestjs/common';
import { AI_SERVICE, AIService } from '../../../../core/domain/ports/outbound/ai.service';
import { Factura } from '../../../../core/domain/models/factura';

@Injectable()
export class DigitalizarFacturaUseCase {
  constructor(
    @Inject(AI_SERVICE)
    private readonly aiService: AIService,
  ) {}

  async execute(fileBuffer: Buffer, mimeType: string): Promise<Partial<Factura>> {
    return this.aiService.extraerDatosFactura(fileBuffer, mimeType);
  }
}
