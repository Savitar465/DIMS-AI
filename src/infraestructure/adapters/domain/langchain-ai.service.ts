import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService } from 'src/core/domain/ports/outbound/ai.service';
import { Factura } from 'src/core/domain/models/factura';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from 'src/core/domain/ports/outbound/subpartida.repository';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';

const pdf = require('pdf-parse');
// No local OCR: images will be sent base64 to the Gemini client for analysis

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

  async invoke(
    prompt: string,
    inlineData?: { mime_type: string; data: string },
  ): Promise<{ content: string }> {
    // Prefer the v1beta generateContent endpoint used by newer Gemini models.
    const tryRequest = async (
      url: string,
      bodyObj: any,
      headersObj: Record<string, string>,
    ) => {
      return await fetch(url, {
        method: 'POST',
        headers: headersObj,
        body: JSON.stringify(bodyObj),
      });
    };

    // Build headers: use X-goog-api-key for Google API key usage (matches your curl), otherwise use Bearer.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
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
      attempts.push({
        url: v1beta2Text,
        body: { prompt: { text: prompt }, temperature: 0 },
        desc: 'v1beta2 generateText (bison model)',
      });
    } else {
      // 1) Preferred current: v1beta path with generateContent (matches your curl for Gemini models)
      const pathUrl = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent`;
      // Build parts array: if inlineData provided, include it as the first part (mime + base64)
      const parts: any[] = [];
      if (inlineData && inlineData.data) {
        parts.push({
          inline_data: {
            mime_type: inlineData.mime_type,
            data: inlineData.data,
          },
        });
      }
      parts.push({ text: prompt });
      attempts.push({
        url: pathUrl,
        body: { contents: [{ parts }] },
        desc: 'v1beta path generateContent',
      });
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
        console.debug(
          `GeminiClient: attempting ${attempt.desc} -> ${attempt.url}`,
        );
        const res = await tryRequest(attempt.url, attempt.body, headers);
        if (!res.ok) {
          const txt = await res.text().catch(() => '<unreadable response>');
          console.warn(
            `GeminiClient: attempt ${attempt.desc} failed with ${res.status}: ${txt}`,
          );
          lastErr = new Error(`Gemini API error ${res.status}: ${txt}`);

          // If v1beta generateContent reports the model is not supported for v1beta, try common Gemini model names
          if (
            res.status === 404 &&
            typeof txt === 'string' &&
            txt.includes('is not found for API version v1beta')
          ) {
            console.info(
              'GeminiClient: detected v1beta model mismatch; trying common Gemini model names as fallbacks',
            );
            // First try programmatically listing available v1beta models and prefer those that contain 'gemini'
            try {
              const listUrl = `https://generativelanguage.googleapis.com/v1beta/models`;
              console.debug(`GeminiClient: querying ListModels at ${listUrl}`);
              const listRes = await fetch(listUrl, { method: 'GET', headers });
              if (listRes.ok) {
                const listJson = await listRes.json().catch(() => ({}));
                const models = Array.isArray(listJson?.models)
                  ? listJson.models
                      .map((m: any) => {
                        // Model payload may include name like 'models/gemini-2.0-flash' or 'gemini-2.0-flash'
                        const full = m?.name || m;
                        return typeof full === 'string'
                          ? full.split('/').pop()
                          : undefined;
                      })
                      .filter(Boolean)
                  : [];

                const geminiCandidates = models.filter((m: string) =>
                  /gemini/i.test(m),
                );
                if (geminiCandidates.length > 0) {
                  console.info(
                    `GeminiClient: ListModels returned candidates: ${geminiCandidates.join(', ')}`,
                  );
                  for (const fm of geminiCandidates) {
                    try {
                      const fmUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fm}:generateContent`;
                      console.debug(
                        `GeminiClient: retrying with model from ListModels ${fm} -> ${fmUrl}`,
                      );
                      // For retries, include inline_data if present
                      const fmParts: any[] = [];
                      if (inlineData && inlineData.data)
                        fmParts.push({
                          inline_data: {
                            mime_type: inlineData.mime_type,
                            data: inlineData.data,
                          },
                        });
                      fmParts.push({ text: prompt });
                      const fmRes = await tryRequest(
                        fmUrl,
                        { contents: [{ parts: fmParts }] },
                        headers,
                      );
                      if (!fmRes.ok) {
                        const fmTxt = await fmRes
                          .text()
                          .catch(() => '<unreadable response>');
                        console.warn(
                          `GeminiClient: model ${fm} from ListModels failed ${fmRes.status}: ${fmTxt}`,
                        );
                        lastErr = new Error(
                          `Gemini API error ${fmRes.status}: ${fmTxt}`,
                        );
                        continue;
                      }
                      const fmJson = await fmRes.json().catch(() => ({}));
                      const fmCandidate =
                        fmJson?.candidates?.[0]?.content ??
                        (fmJson?.candidates?.[0]?.parts
                          ? fmJson.candidates[0].parts
                              .map((p: any) => p.text)
                              .join('')
                          : undefined) ??
                        fmJson?.content ??
                        '';
                      if (fmCandidate) return { content: fmCandidate };
                    } catch (e: any) {
                      console.warn(
                        `GeminiClient: error while trying model ${fm} from ListModels: ${e?.message ?? e}`,
                      );
                      lastErr = e;
                    }
                  }
                }
              } else {
                const listTxt = await listRes
                  .text()
                  .catch(() => '<unreadable response>');
                console.warn(
                  `GeminiClient: ListModels request failed ${listRes.status}: ${listTxt}`,
                );
              }
            } catch (e) {
              console.warn(
                `GeminiClient: error calling ListModels: ${e?.message ?? e}`,
              );
            }

            const fallbackModels = ['gemini-2.5-flash'];
            for (const fm of fallbackModels) {
              try {
                const fmUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fm}:generateContent`;
                console.debug(
                  `GeminiClient: retrying with fallback model ${fm} -> ${fmUrl}`,
                );
                // For fallback model calls include inline_data if available
                const fmParts2: any[] = [];
                if (inlineData && inlineData.data)
                  fmParts2.push({
                    inline_data: {
                      mime_type: inlineData.mime_type,
                      data: inlineData.data,
                    },
                  });
                fmParts2.push({ text: prompt });
                const fmRes = await tryRequest(
                  fmUrl,
                  { contents: [{ parts: fmParts2 }] },
                  headers,
                );
                if (!fmRes.ok) {
                  const fmTxt = await fmRes
                    .text()
                    .catch(() => '<unreadable response>');
                  console.warn(
                    `GeminiClient: fallback model ${fm} failed ${fmRes.status}: ${fmTxt}`,
                  );
                  lastErr = new Error(
                    `Gemini API error ${fmRes.status}: ${fmTxt}`,
                  );
                  continue;
                }
                const fmJson = await fmRes.json().catch(() => ({}));
                const fmCandidate =
                  fmJson?.candidates?.[0]?.content ??
                  (fmJson?.candidates?.[0]?.parts
                    ? fmJson.candidates[0].parts
                        .map((p: any) => p.text)
                        .join('')
                    : undefined) ??
                  fmJson?.content ??
                  '';
                if (fmCandidate) return { content: fmCandidate };
              } catch (e: any) {
                console.warn(
                  `GeminiClient: error while trying fallback model ${fm}: ${e?.message ?? e}`,
                );
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
          (json?.candidates?.[0]?.parts
            ? json.candidates[0].parts.map((p: any) => p.text).join('')
            : undefined) ??
          json?.output?.[0]?.content ??
          // v1beta2 text shapes
          json?.content ??
          '';

        return { content: candidate };
      } catch (err: any) {
        console.warn(
          `GeminiClient: network/parse error on attempt ${attempt.desc}: ${err?.message ?? err}`,
        );
        lastErr = err;
      }
    }

    // Instead of throwing, log the error and return an empty content result so
    // higher-level code can perform graceful fallbacks without causing unhandled exceptions.
    console.error('GeminiClient: all attempts failed', lastErr);
    return { content: '' };
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
      if (
        maybeOpenAI &&
        (maybeOpenAI.startsWith('AIza') || maybeOpenAI.length < 60)
      ) {
        geminiKey = maybeOpenAI;
      }
    }

    if (geminiKey) {
      // Default to a Gemini model that supports v1beta generateContent (matches common public models)
      const geminiModel =
        this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
      this.model = new GeminiClient(geminiKey, geminiModel);
    } else {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      this.model = new ChatOpenAI({
        openAIApiKey: apiKey,
        temperature: 0,
      });
    }
  }

  async buscarSubpartidas(
    descripcion: string,
    contexto?: { linea?: string },
  ): Promise<any[]> {
    console.log(
      `[AI Search] Buscando: ${descripcion} con linea: ${contexto?.linea}`,
    );

    // Obtener todas las subpartidas disponibles para que el LLM decida
    const subpartidasDisponibles = await this.subpartidaRepository.findAll();

    const parser = StructuredOutputParser.fromZodSchema(
      z.array(
        z.object({
          id: z.string(),
          razon: z
            .string()
            .describe('Razón por la cual esta subpartida es relevante'),
        }),
      ),
    );

    const prompt = new PromptTemplate({
      template: `Eres un experto en comercio exterior. Tu tarea es encontrar las subpartidas arancelarias más adecuadas para el siguiente producto.
Producto: "{descripcion}"

Subpartidas disponibles:
{subpartidas}

INSTRUCCIONES IMPORTANTES:
- Devuelve ÚNICAMENTE un JSON válido y nada más.
- El JSON debe ser un ARRAY de objetos con la siguiente forma: [{{ "id": "123456", "razon": "Texto explicativo de por qué aplica" }} , ...]
- Si no hay coincidencias exactas, incluye las subpartidas más cercanas.

Usa las siguientes instrucciones de formato para asegurar la salida JSON:
{format_instructions}
`,
      inputVariables: ['descripcion', 'linea', 'subpartidas'],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    const input = await prompt.format({
      descripcion,
      linea: contexto?.linea || 'No especificada',
      subpartidas: JSON.stringify(subpartidasDisponibles),
    });

    try {
      // Call the model (no inline image for this use-case)
      const response = await this.model.invoke(input);
      const contentStr = this.normalizeModelResponse(response);
      console.log(`[AI Search] Normalized LLM response length: ${contentStr?.length}`);
      console.log(`[AI Search] Normalized LLM response (truncated): ${contentStr?.slice(0, 1000)}`);

      // Try to parse the response using the StructuredOutputParser (preferred)
      let parsed: any = null;
      try {
        const sanitized = this.sanitizeModelJSONArray(contentStr);
        parsed = await parser.parse(sanitized);
      } catch (parseErr) {
        console.warn('[AI Search] StructuredOutputParser.parse failed, attempting JSON-extraction fallback');
        try {
          // Sanitize the model response first (removes code fences, unescapes sequences)
          const sanitized = this.sanitizeModelJSONArray(contentStr);

          // If sanitized already looks like a JSON array, try parsing directly
          const sTrim = (sanitized ?? '').trim();
          if (sTrim.startsWith('[')) {
            try {
              const parsedArray = JSON.parse(sTrim);
              if (Array.isArray(parsedArray)) parsed = parsedArray;
            } catch (e) {
              // fallthrough to bracket-extraction below
            }
          }

          if (!parsed) {
            // Find first '[' and last ']' in sanitized and try to extract
            const first = sanitized.indexOf('[');
            const last = sanitized.lastIndexOf(']');
            if (first !== -1 && last !== -1 && last > first) {
              let arrCandidate = sanitized.slice(first, last + 1).trim();

              // Remove surrounding quotes if present
              if ((arrCandidate.startsWith('"') && arrCandidate.endsWith('"')) || (arrCandidate.startsWith("'") && arrCandidate.endsWith("'"))) {
                arrCandidate = arrCandidate.slice(1, -1).trim();
              }

              // Repeatedly unescape common sequences to handle double-escaped JSON
              let prev: string | null = null;
              let attempts = 0;
              while (arrCandidate !== prev && attempts < 6) {
                prev = arrCandidate;
                arrCandidate = arrCandidate
                  .replace(/\\r/g, '')
                  .replace(/\\n/g, '\n')
                  .replace(/\\t/g, ' ')
                  .replace(/\\"/g, '"')
                  .replace(/\\'/g, "'")
                  .replace(/\\\\/g, '\\')
                  .trim();
                attempts++;
              }

              try {
                const parsedArray = JSON.parse(arrCandidate);
                if (Array.isArray(parsedArray)) parsed = parsedArray;
              } catch (e) {
                console.warn('[AI Search] JSON-extraction fallback failed parsing array candidate:', e);
              }
            }
          }
        } catch (e) {
          console.warn('[AI Search] JSON-extraction fallback failed:', e);
        }
      }

      if (Array.isArray(parsed)) {
        // Ensure result is a plain array of objects that can be serialized as JSON
        return parsed;
      }

      // Fallback: return repository search results if LLM parsing failed
      return this.subpartidaRepository.search(descripcion, contexto?.linea);
    } catch (error) {
      console.error('[AI Search] Error calling LLM:', error);
      // Fallback a búsqueda simple si el LLM falla
      return this.subpartidaRepository.search(descripcion, contexto?.linea);
    }
  }

  async extraerDatosFactura(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<Partial<Factura>> {
    let text: string | undefined;
    let imageBase64: string | undefined;

    if (mimeType === 'application/pdf') {
      const data = await pdf(fileBuffer);
      text = data.text;
    } else if (/^image\//.test(mimeType)) {
      // Convert image buffer to base64 and send it inside the prompt so the Gemini client can analyze it
      imageBase64 = fileBuffer.toString('base64');
      text = undefined;
    } else {
      text = fileBuffer.toString('utf-8');
    }

    console.log(
      `[AI Extraction] Procesando texto de factura de longitud: ${(text ?? '').length}`,
    );

    const parser = StructuredOutputParser.fromZodSchema(
      z.object({
        proveedor: z.string().describe('Nombre de la empresa proveedora'),
        valorTotal: z.number().describe('Valor total de la factura'),
        moneda: z.string().describe('Código de moneda (ej: USD, EUR)'),
        fecha: z.string().describe('Fecha de la factura en formato ISO'),
        productos: z.array(
          z.object({
            descripcion: z.string().describe('Descripción clara del producto'),
            cantidad: z.number().describe('Cantidad de unidades'),
            valorUnitario: z.number().describe('Valor por unidad'),
            valorTotal: z.number().describe('Valor total del ítem'),
          }),
        ),
      }),
    );

    // Build the prompt. For images we will NOT embed base64 in the prompt; the image will be sent via inline_data.
    const templateForImage = `Eres un modelo experto. A continuación recibirás una imagen de una factura (imagen adjunta).
Por favor, analiza la imagen y extrae la información solicitada.

INSTRUCCIÓN IMPORTANTE: Genera únicamente un JSON válido con la siguiente estructura y sin texto adicional con la información obtenida de la imagen:
{{
  "proveedor": "string",
  "fecha": "string (formato ISO)",
  "moneda": "string (ej: \"USD\")",
  "valorTotal": number,
  "productos": [{{ "descripcion": "string", "cantidad": number, "valorUnitario": number, "valorTotal": number }}]
}}
`;

    const prompt = new PromptTemplate({
      template: templateForImage,
      inputVariables: [],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    // Format the prompt (no image content embedded)
    const input = await prompt.format({});

    try {
      // If we have an image, send it as inline_data to GeminiClient (mime_type + base64); otherwise invoke normally
      let response: any;
      if (imageBase64 && typeof this.model.invoke === 'function') {
        response = await this.model.invoke(input, {
          mime_type: mimeType,
          data: imageBase64,
        });
      } else {
        response = await this.model.invoke(input);
      }
      const contentStr = this.normalizeModelResponse(response);
      console.log(
        `[AI Extraction] Normalized LLM response length: ${contentStr?.length}`,
      );
      console.log(
        `[AI Extraction] Normalized LLM response (truncated): ${contentStr?.slice(0, 1000)}`,
      );
      let output: any;
      let sanitized: string = contentStr;
      try {
        // Preprocess the model response to handle escaped JSON (e.g. "\n{\n...}\n")
        sanitized = this.sanitizeModelJSON(contentStr);
        output = await parser.parse(sanitized);
      } catch (parseErr) {
        console.warn(
          '[AI Extraction] StructuredOutputParser.parse failed, attempting JSON-extraction fallback',
        );
        try {
          // First try a direct JSON.parse of the sanitized string
          try {
            const parsed = JSON.parse(sanitized);
            if (parsed && typeof parsed === 'object') {
              output = parsed;
            }
          } catch (e) {
            // ignore, will try other fallbacks
          }

          if (output) {
            // Already recovered via JSON.parse(sanitized)
          } else {
            // Find the first opening brace and the last closing brace to extract the JSON object part
            const firstBrace = contentStr.indexOf('{');
            const lastBrace = contentStr.lastIndexOf('}');
            if (
              firstBrace !== -1 &&
              lastBrace !== -1 &&
              lastBrace > firstBrace
            ) {
              let jsonCandidate = contentStr
                .slice(firstBrace, lastBrace + 1)
                .trim();

              // If wrapped in quotes, remove them
              if (
                (jsonCandidate.startsWith('"') &&
                  jsonCandidate.endsWith('"')) ||
                (jsonCandidate.startsWith("'") && jsonCandidate.endsWith("'"))
              ) {
                jsonCandidate = jsonCandidate.slice(1, -1).trim();
              }

              // Repeatedly unescape common sequences to handle double-escaped JSON (LLM sometimes returns escaped JSON)
              let prev: string | null = null;
              let attempts = 0;
              while (jsonCandidate !== prev && attempts < 5) {
                prev = jsonCandidate;
                jsonCandidate = jsonCandidate
                  .replace(/\\r/g, '')
                  .replace(/\\n/g, '\n')
                  .replace(/\\t/g, ' ')
                  .replace(/\\"/g, '"')
                  .replace(/\\'/g, "'")
                  .replace(/\\\\/g, '\\')
                  .trim();
                attempts++;
              }

              // Final trim and attempt parse
              jsonCandidate = jsonCandidate.trim();
              const parsedObj = JSON.parse(jsonCandidate);
              if (parsedObj && typeof parsedObj === 'object')
                output = parsedObj;
            }
          }
        } catch (e) {
          console.warn('[AI Extraction] JSON-extraction fallback failed:', e);
        }

        // Try a final JSON.parse of the sanitized string
        if (!output) {
          try {
            const finalParsed = JSON.parse(sanitized);
            if (finalParsed && typeof finalParsed === 'object') {
              output = finalParsed;
            }
          } catch (e) {
            // ignore
          }
        }

        // If still no output, return a safe, best-effort fallback so the HTTP layer receives JSON instead of a 500
        if (!output) {
          console.warn(
            '[AI Extraction] Could not parse LLM response; returning best-effort fallback with raw sanitized content',
          );
          return {
            proveedor: 'Error en extracción',
            valorTotal: 0,
            productos: [
              {
                descripcion: (sanitized ?? 'No parseable content').slice(
                  0,
                  1000,
                ),
                cantidad: 0,
                valorUnitario: 0,
                valorTotal: 0,
              },
            ],
          } as Partial<Factura>;
        }
      }

      return output as Partial<Factura>;
    } catch (error) {
      console.error('[AI Extraction] Error calling LLM:', error);
      // Fallback simulado (el que teníamos antes pero un poco más robusto)
      return {
        proveedor: 'Error en extracción',
        valorTotal: 0,
        productos: [
          {
            descripcion: 'No se pudo extraer data',
            cantidad: 0,
            valorUnitario: 0,
            valorTotal: 0,
          },
        ],
      };
    }
  }

  // Normalize and extract plain text from various LLM client response shapes.
  // Handles strings, objects with `content`, `parts`, `candidates`, `choices`, and markdown code fences containing JSON.
  private normalizeModelResponse(response: any): string {
    const extractFromObject = (obj: any): string | null => {
      if (!obj) return null;
      if (typeof obj === 'string') return obj;
      if (typeof obj.content === 'string') return obj.content;
      if (typeof obj.output === 'string') return obj.output;
      if (typeof obj.output_text === 'string') return obj.output_text;
      if (typeof obj.text === 'string') return obj.text;
      if (Array.isArray(obj.parts))
        return obj.parts.map((p: any) => p?.text ?? '').join('');
      if (Array.isArray(obj.candidates) && obj.candidates[0]) {
        const c = obj.candidates[0];
        if (typeof c.content === 'string') return c.content;
        if (Array.isArray(c.parts))
          return c.parts.map((p: any) => p?.text ?? '').join('');
        if (typeof c.output === 'string') return c.output;
      }
      if (
        Array.isArray(obj.output) &&
        typeof obj.output[0]?.content === 'string'
      )
        return obj.output[0].content;
      if (
        Array.isArray(obj.generations) &&
        typeof obj.generations[0]?.text === 'string'
      )
        return obj.generations[0].text;
      if (
        Array.isArray(obj.choices) &&
        typeof obj.choices[0]?.message?.content === 'string'
      )
        return obj.choices[0].message.content;
      return null;
    };

    let candidate: string | null;

    if (typeof response === 'string') {
      // The response may itself be a JSON string containing nested shapes (e.g. { parts: [...] }) so try parsing.
      try {
        const parsed = JSON.parse(response);
        candidate = extractFromObject(parsed) ?? response;
      } catch {
        candidate = response;
      }
    } else {
      candidate =
        extractFromObject(response) ??
        (() => {
          try {
            return JSON.stringify(response);
          } catch {
            return String(response);
          }
        })();
    }

    // If the LLM wrapped the JSON inside markdown code fences, extract the inner block.
    const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch && fenceMatch[1]) {
      candidate = fenceMatch[1].trim();
    }

    // If the candidate is a quoted JSON string (e.g. "[...]"), try to unquote/unescape it.
    if (
      (candidate.startsWith('"') && candidate.endsWith('"')) ||
      (candidate.startsWith("'") && candidate.endsWith("'"))
    ) {
      try {
        candidate = JSON.parse(candidate);
      } catch {
        candidate = candidate.slice(1, -1);
      }
    }

    // Ensure we always return a string. If candidate is an object/array, stringify it.
    if (candidate === null || candidate === undefined) return '';
    if (typeof candidate !== 'string') {
      try {
        return JSON.stringify(candidate);
      } catch {
        return String(candidate);
      }
    }

    return candidate;
  }

  // Sanitize raw LLM output into a JSON string: extract braces, unescape common sequences, remove fences/quotes.
  private sanitizeModelJSON(raw: string): string {
    if (!raw || typeof raw !== 'string') return raw;

    // If wrapped in markdown code fences, extract inner content
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    let candidate = fenceMatch && fenceMatch[1] ? fenceMatch[1] : raw;

    // Find first '{' and last '}' to extract object
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      candidate = candidate.slice(first, last + 1);
    }

    candidate = candidate.trim();

    // Remove surrounding quotes
    if (
      (candidate.startsWith('"') && candidate.endsWith('"')) ||
      (candidate.startsWith("'") && candidate.endsWith("'"))
    ) {
      candidate = candidate.slice(1, -1).trim();
    }

    // Unescape common sequences repeatedly in case of double-escaping
    let prev: string | null = null;
    let attempts = 0;
    while (candidate !== prev && attempts < 6) {
      prev = candidate;
      // Normalize double-escaped sequences by collapsing double backslashes to single
      candidate = candidate
        .replace(/\\r/g, '')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, ' ')
        // Do NOT replace escaped quotes (\") -> '"' here; keep escapes for valid JSON
        .replace(/\\\\/g, '\\')
        .trim();
      attempts++;
    }

    return candidate;
  }

  // Sanitize raw LLM output but preserve JSON arrays when present.
  private sanitizeModelJSONArray(raw: string): string {
    if (!raw || typeof raw !== 'string') return raw;

    // If wrapped in markdown code fences, extract inner content
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    let candidate = fenceMatch && fenceMatch[1] ? fenceMatch[1] : raw;

    // Try to extract a full array first
    const firstArr = candidate.indexOf('[');
    const lastArr = candidate.lastIndexOf(']');
    if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
      let arr = candidate.slice(firstArr, lastArr + 1).trim();

      // Remove surrounding quotes
      if ((arr.startsWith('"') && arr.endsWith('"')) || (arr.startsWith("'") && arr.endsWith("'"))) {
        arr = arr.slice(1, -1).trim();
      }

      // Unescape common sequences repeatedly
      let prev: string | null = null;
      let attempts = 0;
      while (arr !== prev && attempts < 6) {
        prev = arr;
        arr = arr
          .replace(/\\r/g, '')
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, ' ')
          // Keep escaped quotes intact; only collapse double backslashes
          .replace(/\\\\/g, '\\')
          .trim();
        attempts++;
      }

      return arr;
    }

    // Fallback to object-sanitizer
    return this.sanitizeModelJSON(raw);
  }
}
