import { Injectable, Inject } from '@nestjs/common';
import { DigitalizarFacturaUseCase } from './digitalizar-factura.usecase';
import { BuscarSubpartidasUseCase } from './buscar-subpartidas.usecase';
import { Factura } from '../../../domain/models/factura';
import { AIService, AI_SERVICE } from '../../../domain/ports/outbound/ai.service';

@Injectable()
export class ClasificarFacturaUseCase {
  constructor(
    private readonly digitalizarFacturaUseCase: DigitalizarFacturaUseCase,
    private readonly buscarSubpartidasUseCase: BuscarSubpartidasUseCase,
    @Inject(AI_SERVICE) private readonly aiService: AIService,
  ) {}

  async execute(fileBuffer: Buffer, mimeType: string, debug?: boolean): Promise<Partial<Factura> & { debug?: any }> {
    // If the AI service supports one-shot classification, use it to save tokens/time
    if (this.aiService && typeof this.aiService['clasificarProductosDesdeFactura'] === 'function') {
      try {
        const res = await (this.aiService as any).clasificarProductosDesdeFactura(fileBuffer, mimeType, debug);
        return res as Partial<Factura> & { debug?: any };
      } catch (e) {
        console.warn('[ClasificarFacturaUseCase] one-shot classify failed, falling back:', e);
      }
    }

    // Fallback: digitalize first then classify each product individually
    const factura = await this.digitalizarFacturaUseCase.execute(fileBuffer, mimeType, debug);
    const productos = (factura?.productos ?? []) as any[];
    const classified: any[] = [];
    for (const p of productos) {
      const descripcion = (p?.descripcion || '').toString();
      let suggestions: any[] = [];
      try {
        suggestions = await this.buscarSubpartidasUseCase.execute(descripcion);
      } catch (e) {
        suggestions = [];
      }

      if (!suggestions || suggestions.length === 0) {
        classified.push({ ...p, subpartidas: [{ codigo: 'sin clasificacion', descripcion: 'sin clasificacion' }] });
      } else {
        const mapped = suggestions.map((s: any) => ({ id: s.id, codigo: s.codigo ?? s.id, descripcion: s.razon ?? s.descripcion ?? '' }));
        classified.push({ ...p, subpartidas: mapped });
      }
    }

    const result: Partial<Factura> & { debug?: any } = { ...factura, productos: classified };
    if (debug) result.debug = { original: factura };
    return result;
  }
}



