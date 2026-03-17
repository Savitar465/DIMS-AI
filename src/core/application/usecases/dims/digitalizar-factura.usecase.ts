import { Injectable, Inject } from '@nestjs/common';
import { AI_SERVICE, AIService } from '../../../domain/ports/outbound/ai.service';
import { Factura } from '../../../domain/models/factura';

@Injectable()
export class DigitalizarFacturaUseCase {
  constructor(
    @Inject(AI_SERVICE)
    private readonly aiService: AIService,
  ) {}

  async execute(fileBuffer: Buffer, mimeType: string, debug?: boolean): Promise<Partial<Factura>> {
    return this.aiService.extraerDatosFactura(fileBuffer, mimeType, debug);
  }
}
