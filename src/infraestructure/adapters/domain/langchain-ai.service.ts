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

// Small Gemini client wrapper that provides an `invoke` method compatible with LangChain usage in this service.
// It uses the Google Generative API (v1beta2) directly via fetch. It expects a server-side API key or bearer token.
class GeminiClient {
  private apiKey: string;
  private modelName: string;

  // Default model set to a Gemini model that supports v1beta generateContent
  constructor(apiKey: string, modelName = 'gemini-2.5-flash') {
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  // invoke(prompt: string) -> returns { content: string }
  async invoke(prompt: string): Promise<{ content: string }> {
    // Prefer the v1beta generateContent endpoint used by newer Gemini models.
    const tryRequest = async (url: string, bodyObj: any, headersObj: Record<string, string>) => {
      return await fetch(url, { method: 'POST', headers: headersObj, body: JSON.stringify(bodyObj) });
    };

    // Build headers: use X-goog-api-key for Google API key usage (matches your curl), otherwise use Bearer.
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey.startsWith('AIza') || this.apiKey.length < 60) {
      headers['X-goog-api-key'] = this.apiKey;
    } else {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // Normalize model name: allow both `gemini-2.0-flash` and `models/gemini-2.0-flash` inputs.
    const normalizedModel = this.modelName.replace(/^\/*models\/*/i, '');

    const attempts: Array<{ url: string; body: any; desc: string }> = [];

    // If the model looks like a Bison/text model (e.g. contains 'text-bison' or 'bison'), prefer the v1beta2 generateText endpoint.
    const isBison = /bison|text-bison/i.test(normalizedModel);
    if (isBison) {
      // Prefer v1beta2 text endpoint for Bison models
      const v1beta2Text = `https://generativelanguage.googleapis.com/v1beta2/models/${normalizedModel}:generateText`;
      attempts.push({ url: v1beta2Text, body: { prompt: { text: prompt }, temperature: 0 }, desc: 'v1beta2 generateText (bison model)' });
    } else {
      // 1) Preferred current: v1beta path with generateContent (matches your curl for Gemini models)
      const pathUrl = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent`;
      attempts.push({ url: pathUrl, body: { contents: [{ parts: [{ text: prompt }] }] }, desc: 'v1beta path generateContent' });
    }

    // // 2) Generic endpoint with model in body (some setups expect model in body)
    // const genericUrl = `https://generativelanguage.googleapis.com/v1beta/models:generateContent`;
    // attempts.push({ url: genericUrl, body: { model: normalizedModel, contents: [{ parts: [{ text: prompt }] }] }, desc: 'v1beta generic model in body' });

    // // 3) Backwards-compat: v1beta2 generateText / generateMessage shapes (text-oriented)
    // const v1beta2Text = `https://generativelanguage.googleapis.com/v1beta2/models/${normalizedModel}:generateText`;
    // attempts.push({ url: v1beta2Text, body: { prompt: { text: prompt }, temperature: 0 }, desc: 'v1beta2 generateText' });

    let lastErr: Error | null = null;
    for (const attempt of attempts) {
      try {
        console.debug(`GeminiClient: attempting ${attempt.desc} -> ${attempt.url}`);
        const res = await tryRequest(attempt.url, attempt.body, headers);
        if (!res.ok) {
          const txt = await res.text().catch(() => '<unreadable response>');
          console.warn(`GeminiClient: attempt ${attempt.desc} failed with ${res.status}: ${txt}`);
          lastErr = new Error(`Gemini API error ${res.status}: ${txt}`);

          // If v1beta generateContent reports the model is not supported for v1beta, try common Gemini model names
          if (res.status === 404 && typeof txt === 'string' && txt.includes('is not found for API version v1beta')) {
            console.info('GeminiClient: detected v1beta model mismatch; trying common Gemini model names as fallbacks');
            // First try programmatically listing available v1beta models and prefer those that contain 'gemini'
            try {
              const listUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
              console.debug(`GeminiClient: querying ListModels at ${listUrl}`);
              const listRes = await fetch(listUrl, { method: 'GET', headers });
              if (listRes.ok) {
                const listJson = await listRes.json().catch(() => ({}));
                const models = Array.isArray(listJson?.models) ? listJson.models.map((m: any) => {
                  // Model payload may include name like 'models/gemini-2.0-flash' or 'gemini-2.0-flash'
                  const full = m?.name || m;
                  return typeof full === 'string' ? full.split('/').pop() : undefined;
                }).filter(Boolean) : [];

                const geminiCandidates = models.filter((m: string) => /gemini/i.test(m));
                if (geminiCandidates.length > 0) {
                  console.info(`GeminiClient: ListModels returned candidates: ${geminiCandidates.join(', ')}`);
                  for (const fm of geminiCandidates) {
                    try {
                      const fmUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fm}:generateContent`;
                      console.debug(`GeminiClient: retrying with model from ListModels ${fm} -> ${fmUrl}`);
                      const fmRes = await tryRequest(fmUrl, { contents: [{ parts: [{ text: prompt }] }] }, headers);
                      if (!fmRes.ok) {
                        const fmTxt = await fmRes.text().catch(() => '<unreadable response>');
                        console.warn(`GeminiClient: model ${fm} from ListModels failed ${fmRes.status}: ${fmTxt}`);
                        lastErr = new Error(`Gemini API error ${fmRes.status}: ${fmTxt}`);
                        continue;
                      }
                      const fmJson = await fmRes.json().catch(() => ({}));
                      const fmCandidate =
                        fmJson?.candidates?.[0]?.content ??
                        (fmJson?.candidates?.[0]?.parts ? fmJson.candidates[0].parts.map((p: any) => p.text).join('') : undefined) ??
                        fmJson?.content ??
                        '';
                      if (fmCandidate) return { content: fmCandidate };
                    } catch (e: any) {
                      console.warn(`GeminiClient: error while trying model ${fm} from ListModels: ${e?.message ?? e}`);
                      lastErr = e;
                    }
                  }
                }
              } else {
                const listTxt = await listRes.text().catch(() => '<unreadable response>');
                console.warn(`GeminiClient: ListModels request failed ${listRes.status}: ${listTxt}`);
              }
            } catch (e) {
              console.warn(`GeminiClient: error calling ListModels: ${e?.message ?? e}`);
            }

            const fallbackModels = ['gemini-2.5-flash'];
            for (const fm of fallbackModels) {
              try {
                const fmUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fm}:generateContent`;
                console.debug(`GeminiClient: retrying with fallback model ${fm} -> ${fmUrl}`);
                const fmRes = await tryRequest(fmUrl, { contents: [{ parts: [{ text: prompt }] }] }, headers);
                if (!fmRes.ok) {
                  const fmTxt = await fmRes.text().catch(() => '<unreadable response>');
                  console.warn(`GeminiClient: fallback model ${fm} failed ${fmRes.status}: ${fmTxt}`);
                  lastErr = new Error(`Gemini API error ${fmRes.status}: ${fmTxt}`);
                  continue;
                }
                const fmJson = await fmRes.json().catch(() => ({}));
                const fmCandidate =
                  fmJson?.candidates?.[0]?.content ??
                  (fmJson?.candidates?.[0]?.parts ? fmJson.candidates[0].parts.map((p: any) => p.text).join('') : undefined) ??
                  fmJson?.content ??
                  '';
                if (fmCandidate) return { content: fmCandidate };
              } catch (e: any) {
                console.warn(`GeminiClient: error while trying fallback model ${fm}: ${e?.message ?? e}`);
                lastErr = e;
              }
            }
          }

           continue;
         }

        const json = await res.json().catch(() => ({}));
        // Parse common shapes from generateContent / generateText / generateMessage
        const candidate =
          json?.candidates?.[0]?.content ??
          json?.candidates?.[0]?.output ??
          // generateContent often returns `candidates[0].content` or `candidates[0].mimeType/parts`
          (json?.candidates?.[0]?.parts ? json.candidates[0].parts.map((p: any) => p.text).join('') : undefined) ??
          json?.output?.[0]?.content ??
          // v1beta2 text shapes
          json?.content ??
          '';

        return { content: candidate };
      } catch (err: any) {
        console.warn(`GeminiClient: network/parse error on attempt ${attempt.desc}: ${err?.message ?? err}`);
        lastErr = err;
      }
    }

    throw lastErr ?? new Error('Gemini API: all attempts failed');
  }
}

@Injectable()
export class LangChainAIService implements AIService {
  // Use a loose type so we can support multiple client shapes (LangChain ChatOpenAI or our Gemini wrapper)
  private readonly model: any;

  constructor(
    @Inject(SUBPARTIDA_REPOSITORY)
    private readonly subpartidaRepository: SubpartidaRepository,
    private readonly configService: ConfigService,
  ) {
    // Prefer GEMINI_API_KEY if present (Google Generative API / Gemini). Falls back to OPENAI_API_KEY + ChatOpenAI.
    let geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    // If GEMINI_API_KEY isn't provided, but OPENAI_API_KEY looks like a Google API key, use it for Gemini.
    if (!geminiKey) {
      const maybeOpenAI = this.configService.get<string>('OPENAI_API_KEY');
      if (maybeOpenAI && (maybeOpenAI.startsWith('AIza') || maybeOpenAI.length < 60)) {
        geminiKey = maybeOpenAI;
      }
    }

    if (geminiKey) {
      // Default to a Gemini model that supports v1beta generateContent (matches common public models)
      const geminiModel = this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
      this.model = new GeminiClient(geminiKey, geminiModel);
    } else {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      this.model = new ChatOpenAI({
        openAIApiKey: apiKey,
        temperature: 0,
      });
    }
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
      // Support both LangChain response shape and our Gemini wrapper which returns { content: string }
      const content = typeof response === 'string' ? response : (response?.content ?? response?.output ?? '');
      console.log(`[AI Search] LLM response: ${content}`);
      const output = await parser.parse(content.toString());

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
    let text: string;
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
      const content = typeof response === 'string' ? response : (response?.content ?? response?.output ?? '');
      const output = await parser.parse(content.toString());
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
