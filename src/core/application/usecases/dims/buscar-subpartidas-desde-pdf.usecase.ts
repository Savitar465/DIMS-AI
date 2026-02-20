import { Injectable, Inject } from '@nestjs/common';
import { AI_SERVICE, AIService } from '../../../../core/domain/ports/outbound/ai.service';
import { Subpartida } from '../../../../core/domain/models/subpartida';

@Injectable()
export class BuscarSubpartidasDesdePdfUseCase {
  constructor(
    @Inject(AI_SERVICE)
    private readonly aiService: AIService,
  ) {}

  async execute(fileBuffer: Buffer, mimeType: string): Promise<any[]> {
    // 1. Extraer datos de la factura (productos)
    const datosFactura = await this.aiService.extraerDatosFactura(fileBuffer, mimeType);
    
    if (!datosFactura.productos || datosFactura.productos.length === 0) {
      return [];
    }

    // 2. Para cada producto, buscar su subpartida sugerida
    const resultados = await Promise.all(
      datosFactura.productos.map(async (producto) => {
        const subpartidas = await this.aiService.buscarSubpartidas(producto.descripcion);
        return {
          producto: producto.descripcion,
          cantidad: producto.cantidad,
          sugerencias: subpartidas,
        };
      })
    );

    return resultados;
  }
}
