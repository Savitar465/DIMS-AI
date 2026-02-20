import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from 'src/core/domain/ports/outbound/ai.service';
import { Factura } from 'src/core/domain/models/factura';
import { SubpartidaRepository, SUBPARTIDA_REPOSITORY } from 'src/core/domain/ports/outbound/subpartida.repository';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
const pdf = require('pdf-parse');

@Injectable()
export class LangChainAIService implements AIService {
  private readonly model: ChatOpenAI;

  constructor(
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.model = new ChatOpenAI({
      openAIApiKey: apiKey,
      temperature: 0,
    });
  }

  async buscarSubpartidas(descripcion: string, contexto?: { linea?: string }): Promise<any[]> {
    console.log(`[AI Search] Buscando: ${descripcion} con linea: ${contexto?.linea}`);
    
    // Obtener todas las subpartidas disponibles para que el LLM decida
    const subpartidasDisponibles = await this.subpartidaRepository.findAll();
    
    const parser = StructuredOutputParser.fromZodSchema(
      z.array(z.object({
        id: z.string(),
        razon: z.string().describe('Razón por la cual esta subpartida es relevante')
      }))
    );

    const prompt = new PromptTemplate({
      template: `Eres un experto en comercio exterior. Tu tarea es encontrar las subpartidas arancelarias más adecuadas para el siguiente producto:
      Producto: "{descripcion}"
      Línea de negocio (opcional): "{linea}"

      Subpartidas disponibles:
      {subpartidas}

      {format_instructions}
      
      Si no encuentras una coincidencia exacta, devuelve las más cercanas.`,
      inputVariables: ['descripcion', 'linea', 'subpartidas'],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    const input = await prompt.format({
      descripcion,
      linea: contexto?.linea || 'No especificada',
      subpartidas: JSON.stringify(subpartidasDisponibles),
    });

    try {
      const response = await this.model.invoke(input);
      const output = await parser.parse(response.content.toString());
      
      // Mapear los resultados del LLM de vuelta a los objetos completos de subpartida
      return output.map(match => {
        const sub = subpartidasDisponibles.find(s => s.id === match.id);
        return sub ? { ...sub, razon: match.razon } : null;
      }).filter(s => s !== null);
    } catch (error) {
      console.error('[AI Search] Error calling LLM:', error);
      // Fallback a búsqueda simple si el LLM falla
      return this.subpartidaRepository.search(descripcion, contexto?.linea);
    }
  }

  async extraerDatosFactura(fileBuffer: Buffer, mimeType: string): Promise<Partial<Factura>> {
    let text = '';
    if (mimeType === 'application/pdf') {
      const data = await pdf(fileBuffer);
      text = data.text;
    } else {
      text = fileBuffer.toString('utf-8');
    }

    console.log(`[AI Extraction] Procesando texto de factura de longitud: ${text.length}`);

    const parser = StructuredOutputParser.fromZodSchema(
      z.object({
        proveedor: z.string().describe('Nombre de la empresa proveedora'),
        valorTotal: z.number().describe('Valor total de la factura'),
        moneda: z.string().describe('Código de moneda (ej: USD, EUR)'),
        fecha: z.string().describe('Fecha de la factura en formato ISO'),
        productos: z.array(z.object({
          descripcion: z.string().describe('Descripción clara del producto'),
          cantidad: z.number().describe('Cantidad de unidades'),
          valorUnitario: z.number().describe('Valor por unidad'),
          valorTotal: z.number().describe('Valor total del ítem')
        }))
      })
    );

    const prompt = new PromptTemplate({
      template: `Extrae la información estructurada de la siguiente factura:
      Texto de la factura:
      {text}

      {format_instructions}`,
      inputVariables: ['text'],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    const input = await prompt.format({ text });

    try {
      const response = await this.model.invoke(input);
      const output = await parser.parse(response.content.toString());
      return output as Partial<Factura>;
    } catch (error) {
      console.error('[AI Extraction] Error calling LLM:', error);
      // Fallback simulado (el que teníamos antes pero un poco más robusto)
      return {
        proveedor: 'Error en extracción',
        valorTotal: 0,
        productos: [{ descripcion: 'No se pudo extraer data', cantidad: 0, valorUnitario: 0, valorTotal: 0 }]
      };
    }
  }
}
