import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIService,
  ClasificacionItemInput,
  ClasificacionItemOutput,
} from 'src/core/domain/ports/outbound/ai.service';
import { Factura } from 'src/core/domain/models/factura';
import { Subpartida } from 'src/core/domain/models/subpartida';

// Stopwords cortas para el tokenizador del pre-filtro. No es exhaustiva — solo
// filtra ruido evidente que no aporta a buscar candidatos arancelarios.
const STOPWORDS = new Set([
  'para', 'con', 'sin', 'del', 'los', 'las', 'una', 'uno', 'unos', 'unas',
  'que', 'por', 'mas', 'pero', 'como', 'este', 'esta', 'estos', 'estas',
  'and', 'the', 'for', 'with', 'from', 'pcs', 'und', 'unit', 'units',
]);
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
  // Two clients with different cost/capability profiles:
  //   `model`     → multimodal (image+text). Used para extracción visual de la factura.
  //   `textModel` → solo texto, modelo más barato. Used para clasificación de subpartidas
  //                 y búsqueda manual, donde no se necesita visión.
  // En el típico Gemini 2.5: flash (multimodal) vs flash-lite (~5× más barato, solo texto).
  // Si solo hay un OPENAI_API_KEY clásico se reusa la misma instancia para ambos.
  private readonly model: any;
  private readonly textModel: any;

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
      const visionModel =
        this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
      const textModel =
        this.configService.get<string>('GEMINI_TEXT_MODEL') ||
        'gemini-2.5-flash-lite';
      this.model = new GeminiClient(geminiKey, visionModel);
      this.textModel =
        textModel === visionModel
          ? this.model
          : new GeminiClient(geminiKey, textModel);
    } else {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      this.model = new ChatOpenAI({
        openAIApiKey: apiKey,
        temperature: 0,
      });
      // OpenAI: reusamos el mismo cliente; el ahorro por modelo no aplica aquí.
      this.textModel = this.model;
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

  async clasificarSubpartidasBatch(
    items: ClasificacionItemInput[],
  ): Promise<ClasificacionItemOutput[]> {
    if (!items || items.length === 0) return [];

    // OPTIMIZACIÓN #2 — Pre-filtro top-K:
    // En vez de mandar el catálogo completo (~miles de subpartidas) en cada
    // llamada, hacemos una búsqueda local por ítem y mandamos solo los K
    // candidatos más probables. El LLM elige entre esos o "ninguno".
    // Reduce el input de ~50 k tokens a ~2 k.
    const K = 8;
    const candidatesByItem = await this.getCandidatesPorItem(items, K);

    const sinCandidatos: ClasificacionItemOutput[] = [];
    const itemsAClasificar = items.filter((it) => {
      const cs = candidatesByItem.get(it.id) || [];
      if (cs.length === 0) {
        sinCandidatos.push({
          id: it.id,
          subpartida: null,
          confidence: 0,
          razon: 'Sin candidatos en el catálogo para esta descripción',
        });
        return false;
      }
      return true;
    });

    if (itemsAClasificar.length === 0) return sinCandidatos;

    const parser = StructuredOutputParser.fromZodSchema(
      z.array(
        z.object({
          id: z.string(),
          subpartida: z.string().nullable(),
          confidence: z.number(),
          razon: z.string().optional(),
        }),
      ),
    );

    // Render compacto: por ítem, su descripción + sus K candidatos.
    const renderProductos = itemsAClasificar
      .map((it) => {
        const cands = (candidatesByItem.get(it.id) || [])
          .map((c) => `  • ${c.code} — ${c.desc}`)
          .join('\n');
        return `PRODUCTO id="${it.id}"\nDescripción: ${it.descripcion}\nCandidatos:\n${cands}`;
      })
      .join('\n\n');

    const template = `Eres un experto en clasificación arancelaria NANDINA (Bolivia). Para cada producto elige UNA subpartida de SU lista de candidatos. Si ninguno corresponde, usa null.

{productos}

INSTRUCCIONES CRÍTICAS:
- Devuelve ÚNICAMENTE un JSON válido (array), sin texto adicional, sin markdown, sin code fences.
- Devuelve EXACTAMENTE una entrada por cada producto recibido, preservando su "id".
- "subpartida" DEBE ser uno de los códigos listados como candidatos para ese ítem, o null.
- "confidence" es un entero entre 0 y 100.
- "razon" es opcional, breve justificación en español.

Formato de salida:
[
  {{ "id": "i1", "subpartida": "8471.30.00.00", "confidence": 92, "razon": "Laptop portátil" }},
  {{ "id": "i2", "subpartida": null, "confidence": 0, "razon": "Ningún candidato corresponde" }}
]

{format_instructions}`;

    const prompt = new PromptTemplate({
      template,
      inputVariables: ['productos'],
      partialVariables: { format_instructions: parser.getFormatInstructions() },
    });

    const input = await prompt.format({ productos: renderProductos });

    const emptyResult = (): ClasificacionItemOutput[] => [
      ...sinCandidatos,
      ...itemsAClasificar.map((it) => ({
        id: it.id,
        subpartida: null as string | null,
        confidence: 0,
      })),
    ];

    try {
      // Clasificación = solo texto → modelo barato.
      const response = await this.textModel.invoke(input);
      const contentStr = this.unwrapTextEnvelope(
        this.normalizeModelResponse(response),
      );
      console.log(
        `[AI Classify] Normalized LLM response length: ${contentStr?.length}`,
      );

      let parsed: any = this.tryParseJSON(contentStr);
      // Defensive: if the parser returned the [{text:"..."}] envelope, drill in.
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (p) => p && typeof p === 'object' && typeof p.text === 'string',
        )
      ) {
        const joined = parsed.map((p) => p.text).join('');
        parsed = this.tryParseJSON(joined);
      }
      if (!Array.isArray(parsed)) {
        try {
          const sanitized = this.sanitizeModelJSONArray(contentStr);
          parsed = await parser.parse(sanitized);
        } catch (e) {
          console.warn('[AI Classify] StructuredOutputParser failed:', e);
        }
      }

      if (!Array.isArray(parsed)) {
        console.warn('[AI Classify] Could not parse response — returning empty classifications');
        return emptyResult();
      }

      const byId = new Map<string, any>();
      for (const r of parsed) {
        if (r && typeof r === 'object' && typeof r.id === 'string') {
          byId.set(r.id, r);
        }
      }
      // Validar que la subpartida elegida esté en los candidatos del ítem
      // (defiende contra alucinaciones del LLM).
      const aiResults: ClasificacionItemOutput[] = itemsAClasificar.map(
        (it) => {
          const r = byId.get(it.id);
          if (!r) return { id: it.id, subpartida: null, confidence: 0 };
          const candCodes = new Set(
            (candidatesByItem.get(it.id) || []).map((c) => c.code),
          );
          const raw =
            typeof r.subpartida === 'string' && r.subpartida.trim() !== ''
              ? r.subpartida
              : null;
          const sub = raw && candCodes.has(raw) ? raw : null;
          const conf = Number(r.confidence);
          return {
            id: it.id,
            subpartida: sub,
            confidence: Number.isFinite(conf)
              ? Math.max(0, Math.min(100, conf))
              : 0,
            razon: typeof r.razon === 'string' ? r.razon : undefined,
          };
        },
      );
      // Mantener el orden de la entrada original.
      const merged = new Map<string, ClasificacionItemOutput>();
      for (const r of [...sinCandidatos, ...aiResults]) merged.set(r.id, r);
      return items.map(
        (it) =>
          merged.get(it.id) || { id: it.id, subpartida: null, confidence: 0 },
      );
    } catch (err) {
      console.error('[AI Classify] Error calling LLM:', err);
      return emptyResult();
    }
  }

  // Clean a JSON-like string to increase the chance JSON.parse will succeed.
  // - normalize smart quotes to straight quotes
  // - remove control characters except newlines
  // - collapse repeated backslashes
  // - remove trailing commas before } or ]
  // - handle escaped newlines and quotes in JSON strings
  private cleanJSONString(raw: string): string {
    if (!raw || typeof raw !== 'string') return raw;
    let s = raw;
    
    // Normalize smart quotes
    s = s.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
    s = s.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
    
    // Remove control chars except newline and tab
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    
    // Handle literal newlines in JSON strings: replace actual newlines with spaces
    s = s.replace(/[\r\n]+/g, ' ');
    
    // Handle double-escaped sequences carefully: \\n -> \n in raw form
    // But we need JSON-valid escape sequences in the final string
    let prev: string | null = null;
    let attempts = 0;
    while (s !== prev && attempts < 4) {
      prev = s;
      // Collapse excessive backslashes: \\\\ -> \\
      s = s.replace(/\\\\\\\\/g, '\\\\');  
      attempts++;
    }
    
    // Remove trailing commas before } or ]
    s = s.replace(/,\s*(?=[}\]])/g, '');
    
    // Fix common JSON syntax issues
    // Remove multiple spaces between tokens but preserve single spaces
    s = s.replace(/\s{2,}/g, ' ');
    
    return s.trim();
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

    // Remove surrounding quotes (handles both single and double)
    if (
      (candidate.startsWith('"') && candidate.endsWith('"')) ||
      (candidate.startsWith("'") && candidate.endsWith("'"))
    ) {
      candidate = candidate.slice(1, -1).trim();
    }

    // Handle escaped newlines: convert \\n to actual newlines 
    // But be careful with backslashes - only convert the standard JSON escape sequences
    candidate = candidate
      .replace(/\\n/g, ' ')    // Replace \n with space to avoid newlines in JSON
      .replace(/\\r/g, ' ')    // Replace \r with space
      .replace(/\\t/g, ' ');   // Replace \t with space

    // Collapse consecutive spaces created by the above replacements
    candidate = candidate.replace(/\s{2,}/g, ' ');

    // Unescape double-escaped quotes in case of \\\" -> \"
    let prev: string | null = null;
    let attempts = 0;
    while (candidate !== prev && attempts < 5) {
      prev = candidate;
      // Unescape double backslashes but preserve single backslashes before quotes
      // Pattern: \\\\ -> \\ (reduce quadruple backslash to double)
      candidate = candidate.replace(/\\\\\\\\/g, '\\\\').trim();
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

  // Robust JSON parser that tries multiple strategies
  private tryParseJSON(text: string): any {
    if (!text || typeof text !== 'string') return null;
    
    // Strategy 1: Direct parse
    try {
      return JSON.parse(text);
    } catch (e) {
      // Continue to next strategy
    }

    // Strategy 2: Clean and parse
    try {
      const cleaned = this.cleanJSONString(text);
      return JSON.parse(cleaned);
    } catch (e) {
      // Continue to next strategy
    }

    // Strategy 3: Extract object using braces and clean
    if (text.trim().startsWith('{')) {
      try {
        const firstIdx = text.indexOf('{');
        const lastIdx = text.lastIndexOf('}');
        if (firstIdx >= 0 && lastIdx > firstIdx) {
          const extracted = text.substring(firstIdx, lastIdx + 1);
          const cleaned = this.cleanJSONString(extracted);
          return JSON.parse(cleaned);
        }
      } catch (e) {
        // Continue to next strategy
      }
    }

    // Strategy 4: Extract array using brackets and clean
    if (text.trim().startsWith('[')) {
      try {
        const firstIdx = text.indexOf('[');
        const lastIdx = text.lastIndexOf(']');
        if (firstIdx >= 0 && lastIdx > firstIdx) {
          const extracted = text.substring(firstIdx, lastIdx + 1);
          const cleaned = this.cleanJSONString(extracted);
          return JSON.parse(cleaned);
        }
      } catch (e) {
        // Continue to next strategy
      }
    }

    // Strategy 5: Try unescaping one level and parse
    try {
      // Single level unescape: \" -> ", \\ -> \, etc.
      const unescaped = text
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .trim();
      
      if ((unescaped.startsWith('{') && unescaped.endsWith('}')) ||
          (unescaped.startsWith('[') && unescaped.endsWith(']'))) {
        return JSON.parse(unescaped);
      }
    } catch (e) {
      // Continue to next strategy
    }

    return null;
  }

  // OPTIMIZACIÓN #2 — Tokeniza la descripción para buscar candidatos vía LIKE.
  // Normaliza acentos, baja a minúsculas, descarta tokens cortos y stopwords.
  private tokenizar(text: string): string[] {
    if (!text) return [];
    const norm = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of norm.split(/[^a-z0-9]+/)) {
      if (t.length < 3 || STOPWORDS.has(t) || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out;
  }

  // OPTIMIZACIÓN #2 — Para cada ítem, encuentra los top-K candidatos
  // arancelarios usando el repositorio local. Score = nº de tokens que
  // matchean la descripción del candidato.
  private async getCandidatesPorItem(
    items: ClasificacionItemInput[],
    k: number,
  ): Promise<Map<string, Subpartida[]>> {
    const result = new Map<string, Subpartida[]>();
    for (const item of items) {
      const tokens = this.tokenizar(item.descripcion);
      const scored = new Map<string, { sub: Subpartida; score: number }>();
      for (const t of tokens) {
        const hits = await this.subpartidaRepository.search(t);
        for (const h of hits) {
          const prev = scored.get(h.code);
          if (prev) prev.score += 1;
          else scored.set(h.code, { sub: h, score: 1 });
        }
      }
      const ranked = [...scored.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map((x) => x.sub);
      result.set(item.id, ranked);
    }
    return result;
  }

  // Some LLM clients (notably the Gemini wrapper here) return the JSON answer
  // wrapped as `[{"text":"<actual json>"}]`. Drill through that envelope so
  // downstream parsers see the actual JSON the model produced.
  private unwrapTextEnvelope(raw: string): string {
    if (!raw || typeof raw !== 'string') return raw;
    const trimmed = raw.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return raw;
    try {
      const parsed = JSON.parse(trimmed);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (p) => p && typeof p === 'object' && typeof p.text === 'string',
        )
      ) {
        return parsed.map((p: any) => p.text).join('');
      }
      if (
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.text === 'string'
      ) {
        return parsed.text;
      }
    } catch {
      // not JSON — leave as-is
    }
    return raw;
  }
}
