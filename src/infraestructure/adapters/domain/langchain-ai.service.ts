import { Injectable, Inject } from '@nestjs/common';
import { AIService } from 'src/core/domain/ports/outbound/ai.service';
import { Factura } from 'src/core/domain/models/factura';
import { SubpartidaRepository, SUBPARTIDA_REPOSITORY } from 'src/core/domain/ports/outbound/subpartida.repository';
// import { ChatOpenAI } from '@langchain/openai'; // Sería lo ideal con API Key
const pdf = require('pdf-parse');

@Injectable()
export class LangChainAIService implements AIService {
  constructor(
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
  ) {}

  async buscarSubpartidas(descripcion: string, contexto?: { linea?: string }): Promise<any[]> {
    // En una implementación real, aquí usaríamos embeddings o un LLM para mejorar la búsqueda semántica.
    // Por ahora, simulamos la "inteligencia" buscando en nuestro repositorio mock.
    console.log(`[AI Search] Buscando: ${descripcion} con linea: ${contexto?.linea}`);
    return this.subpartidaRepository.search(descripcion, contexto?.linea);
  }

  async extraerDatosFactura(fileBuffer: Buffer, mimeType: string): Promise<Partial<Factura>> {
    let text = '';
    if (mimeType === 'application/pdf') {
      const data = await pdf(fileBuffer);
      text = data.text;
    } else {
      text = fileBuffer.toString('utf-8'); // Fallback para archivos de texto/simulados
    }

    console.log(`[AI Extraction] Procesando texto de factura de longitud: ${text.length}`);

    // Simulación de extracción con LLM basada en patrones simples para el ejemplo
    // En producción, aquí se pasaría 'text' a un modelo como GPT-4o o Claude con un prompt estructurado
    
    const lines = text.split('\n');
    const proveedor = this.findValue(text, /Proveedor:\s*(.*)/i) || 'Proveedor Desconocido';
    const total = parseFloat(this.findValue(text, /Total:\s*([\d.]+)/i) || '0');

    return {
      proveedor,
      valorTotal: total,
      productos: [
        {
          descripcion: 'Producto extraído automáticamente',
          cantidad: 1,
          valorUnitario: total,
          valorTotal: total,
        }
      ],
      moneda: 'USD',
      fecha: new Date().toISOString(),
    };
  }

  private findValue(text: string, regex: RegExp): string | null {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  }
}
