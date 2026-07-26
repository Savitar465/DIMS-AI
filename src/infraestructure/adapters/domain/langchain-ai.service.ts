import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIService,
  ClasificacionItemInput,
  ClasificacionItemOutput,
  ExtraccionFactura,
} from 'src/core/domain/ports/outbound/ai.service';
import {
  CandidatoSubpartida,
  NotaLegal,
} from 'src/core/domain/models/subpartida';
import {
  CLASIFICACION_APRENDIDA_REPOSITORY,
  ClasificacionAprendida,
  ClasificacionAprendidaRepository,
} from 'src/core/domain/ports/outbound/clasificacion-aprendida.repository';
import { BusquedaHibridaService } from 'src/core/application/services/busqueda-hibrida.service';
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

// ── Extracción de documentos de importación ─────────────────────────────────
// El objetivo es sacar del papel la mayor cantidad posible de campos
// obligatorios de la DIMS. Todo es nullable a propósito: el modelo debe decir
// "no está" en vez de inventar, porque después el usuario firma la declaración.

const nullableString = () => z.string().nullable().optional();
const nullableNumber = () => z.number().nullable().optional();

const EXTRACCION_SCHEMA = z.object({
  tipoDocumento: z
    .enum(['factura', 'packingList', 'guiaTransporte', 'otro'])
    .nullable()
    .optional(),
  proveedor: z
    .object({
      nombre: nullableString(),
      direccion: nullableString(),
      pais: nullableString(),
      rfc: nullableString(),
    })
    .nullable()
    .optional(),
  factura: z
    .object({
      numero: nullableString(),
      fecha: nullableString(),
      moneda: nullableString(),
      incoterm: nullableString(),
      puertoEmbarque: nullableString(),
    })
    .nullable()
    .optional(),
  importador: z
    .object({
      nombreRazonSocial: nullableString(),
      numeroDocumento: nullableString(),
      domicilio: nullableString(),
      ciudad: nullableString(),
    })
    .nullable()
    .optional(),
  logistica: z
    .object({
      cantidadBultos: nullableNumber(),
      pesoBrutoKg: nullableNumber(),
      pesoNetoKg: nullableNumber(),
      manifiesto: nullableString(),
      paisUltimaProcedencia: nullableString(),
      medioTransporte: nullableString(),
    })
    .nullable()
    .optional(),
  totales: z
    .object({
      subtotal: nullableNumber(),
      flete: nullableNumber(),
      seguro: nullableNumber(),
    })
    .nullable()
    .optional(),
  productos: z
    .array(
      z.object({
        descripcion: z.string(),
        cantidad: z.number(),
        valorUnitario: z.number(),
        valorTotal: z.number(),
      }),
    )
    .nullable()
    .optional(),
});

const EXTRACCION_INSTRUCCIONES = `Sos un especialista en comercio exterior boliviano. Vas a leer un documento de importación (factura comercial, packing list o guía de transporte) y extraer los datos que se necesitan para llenar una DIMS de la Aduana Nacional.

Devolvé ÚNICAMENTE un JSON válido, sin texto antes ni después, sin bloques de código markdown, con esta estructura exacta:

{
  "tipoDocumento": "factura" | "packingList" | "guiaTransporte" | "otro",
  "proveedor":   { "nombre": string|null, "direccion": string|null, "pais": string|null, "rfc": string|null },
  "factura":     { "numero": string|null, "fecha": string|null, "moneda": string|null, "incoterm": string|null, "puertoEmbarque": string|null },
  "importador":  { "nombreRazonSocial": string|null, "numeroDocumento": string|null, "domicilio": string|null, "ciudad": string|null },
  "logistica":   { "cantidadBultos": number|null, "pesoBrutoKg": number|null, "pesoNetoKg": number|null, "manifiesto": string|null, "paisUltimaProcedencia": string|null, "medioTransporte": string|null },
  "totales":     { "subtotal": number|null, "flete": number|null, "seguro": number|null },
  "productos":   [ { "descripcion": string, "cantidad": number, "valorUnitario": number, "valorTotal": number } ]
}

REGLA PRINCIPAL: si un dato NO está en el documento, poné null. No lo deduzcas, no lo estimes y no lo inventes. Un campo vacío se corrige después; un dato falso en una declaración aduanera es una infracción.

Cómo identificar cada dato:

- proveedor: quien VENDE o EMITE. Buscá "Seller", "Shipper", "Exporter", "Vendedor", "From", o el membrete del encabezado.
- importador: a quién va DIRIGIDA la mercadería. Buscá "Bill To", "Sold To", "Consignee", "Ship To", "Destinatario", "Importador", "Cliente". NO lo confundas con el proveedor.
- importador.numeroDocumento: NIT, RUC, Tax ID o CI del destinatario, si figura.
- importador.ciudad: la ciudad del destinatario (ej: "Santa Cruz", "La Paz", "Cochabamba").
- factura.fecha: en formato ISO (YYYY-MM-DD).
- factura.incoterm: FOB, EXW, CIF, CFR, CPT, DAP, DDP, etc.
- factura.puertoEmbarque: "Port of Loading", "Puerto de embarque", "Ship From".
- totales.subtotal: el valor de la mercadería SIN flete ni seguro. Si el documento solo trae un total que ya los incluye, poné el subtotal en null.
- totales.flete: "Freight", "Shipping", "Flete". totales.seguro: "Insurance", "Seguro".
- logistica.cantidadBultos: cantidad de PAQUETES, no de unidades de producto. Buscá "Packages", "Cartons", "CTNS", "Colli", "Bultos", "Pieces".
- logistica.pesoBrutoKg: "Gross Weight", "G.W.", "Peso bruto". logistica.pesoNetoKg: "Net Weight", "N.W.", "Peso neto".
- Convertí SIEMPRE los pesos a kilogramos. Si vienen en libras (lb/lbs), multiplicá por 0.4536. Si vienen en toneladas, multiplicá por 1000.
- logistica.manifiesto: nº de guía aérea (AWB), conocimiento de embarque (B/L), carta de porte, tracking del courier o nº de manifiesto.
- logistica.paisUltimaProcedencia: el país DESDE DONDE SALIÓ FÍSICAMENTE la carga (puerto o aeropuerto de embarque). Puede no coincidir con el país del proveedor.
- logistica.medioTransporte: "1" si es marítimo (B/L, vessel), "3" si es carretero (camión, carta de porte), "4" si es aéreo (AWB, flight), "5" si es courier o correo (DHL, FedEx, UPS, EMS).
- productos: una entrada por línea del detalle. Números sin separadores de miles y con punto decimal.

Si el documento es un packing list o una guía de transporte, es normal que "productos" y "totales" vengan vacíos o incompletos: llená solo lo que realmente figure.`;

/** Convierte lo que devolvió el modelo al contrato del puerto, sin confiar en los tipos. */
function normalizarExtraccion(raw: any): ExtraccionFactura {
  const num = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: any): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s.length > 0 && s.toLowerCase() !== 'null' ? s : null;
  };
  const obj = (v: any) => (v && typeof v === 'object' ? v : {});

  const p = obj(raw?.proveedor);
  const f = obj(raw?.factura);
  const i = obj(raw?.importador);
  const l = obj(raw?.logistica);
  const t = obj(raw?.totales);

  const productos = (Array.isArray(raw?.productos) ? raw.productos : [])
    .map((prod: any) => {
      const cantidad = num(prod?.cantidad) ?? 0;
      const valorUnitario = num(prod?.valorUnitario) ?? 0;
      return {
        descripcion: str(prod?.descripcion) ?? '',
        cantidad,
        valorUnitario,
        valorTotal: num(prod?.valorTotal) ?? cantidad * valorUnitario,
      };
    })
    .filter((prod) => prod.descripcion.length > 0);

  return {
    tipoDocumento: raw?.tipoDocumento ?? null,
    proveedor: {
      nombre: str(p.nombre),
      direccion: str(p.direccion),
      pais: str(p.pais),
      rfc: str(p.rfc),
    },
    factura: {
      numero: str(f.numero),
      fecha: str(f.fecha),
      moneda: str(f.moneda),
      incoterm: str(f.incoterm)?.toUpperCase() ?? null,
      puertoEmbarque: str(f.puertoEmbarque),
    },
    importador: {
      nombreRazonSocial: str(i.nombreRazonSocial),
      numeroDocumento: str(i.numeroDocumento),
      domicilio: str(i.domicilio),
      ciudad: str(i.ciudad),
    },
    logistica: {
      cantidadBultos: num(l.cantidadBultos),
      pesoBrutoKg: num(l.pesoBrutoKg),
      pesoNetoKg: num(l.pesoNetoKg),
      manifiesto: str(l.manifiesto),
      paisUltimaProcedencia: str(l.paisUltimaProcedencia),
      medioTransporte: str(l.medioTransporte),
    },
    totales: {
      subtotal: num(t.subtotal),
      flete: num(t.flete),
      seguro: num(t.seguro),
    },
    productos,
  };
}

// Consumo de tokens de una llamada al LLM. Gemini lo devuelve en `usageMetadata`;
// `thinkingTokens` solo aparece en modelos con razonamiento (2.5+).
export interface UsoTokens {
  model: string;
  promptTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
}

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

  // Lee `usageMetadata` de la respuesta y lo deja en el log. Se llama en cada
  // punto donde una petición terminó OK (incluidos los reintentos con otro
  // modelo), así el log refleja el modelo que realmente cobró los tokens.
  private reportarUso(json: any, modelo: string, label: string): UsoTokens {
    const meta = json?.usageMetadata ?? json?.usage_metadata ?? {};
    const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const promptTokens = n(meta.promptTokenCount ?? meta.prompt_token_count);
    const outputTokens = n(
      meta.candidatesTokenCount ?? meta.candidates_token_count,
    );
    const thinkingTokens = n(meta.thoughtsTokenCount ?? meta.thoughts_token_count);
    const totalTokens =
      n(meta.totalTokenCount ?? meta.total_token_count) ||
      promptTokens + outputTokens + thinkingTokens;

    const uso: UsoTokens = {
      model: modelo,
      promptTokens,
      outputTokens,
      thinkingTokens,
      totalTokens,
    };

    if (totalTokens === 0) {
      console.warn(
        `[LLM Tokens] ${label} model=${modelo} — la respuesta no trajo usageMetadata`,
      );
      return uso;
    }

    console.log(
      `[LLM Tokens] ${label} model=${modelo} input=${promptTokens} output=${outputTokens}` +
        (thinkingTokens > 0 ? ` thinking=${thinkingTokens}` : '') +
        ` total=${totalTokens}`,
    );
    return uso;
  }

  async invoke(
    prompt: string,
    inlineData?: { mime_type: string; data: string },
    label = 'gemini',
    // Salida estructurada. Con `responseMimeType: 'application/json'` +
    // `responseSchema`, la API garantiza el JSON en vez de dejarlo librado a
    // que el modelo respete el formato pedido en el prompt.
    generationConfig?: Record<string, any>,
  ): Promise<{ content: string; usage?: UsoTokens; error?: Error }> {
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
        body: {
          contents: [{ parts }],
          ...(generationConfig ? { generationConfig } : {}),
        },
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
                      if (fmCandidate)
                        return {
                          content: fmCandidate,
                          usage: this.reportarUso(fmJson, fm, label),
                        };
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
                if (fmCandidate)
                  return {
                    content: fmCandidate,
                    usage: this.reportarUso(fmJson, fm, label),
                  };
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

        return {
          content: candidate,
          usage: this.reportarUso(json, normalizedModel, label),
        };
      } catch (err: any) {
        console.warn(
          `GeminiClient: network/parse error on attempt ${attempt.desc}: ${err?.message ?? err}`,
        );
        lastErr = err;
      }
    }

    // Instead of throwing, log the error and return an empty content result so
    // higher-level code can perform graceful fallbacks without causing unhandled exceptions.
    // El error se adjunta para que quien pueda reintentar (p. ej. ante un 429
    // con `retryDelay`) tenga el motivo; los llamadores viejos lo ignoran.
    console.error('GeminiClient: all attempts failed', lastErr);
    console.log(
      `[LLM Tokens] ${label} model=${this.modelName} — llamada fallida, sin consumo reportado`,
    );
    return { content: '', error: lastErr ?? undefined };
  }
}

/** Un ítem con sus candidatos ya resueltos, listo para el rerank. */
interface ItemPreparado {
  item: ClasificacionItemInput;
  expandida: string;
  candidatos: CandidatoSubpartida[];
  /** Motivo por el que no se pudieron traer candidatos, si fue el caso. */
  error?: string;
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
    @Inject(CLASIFICACION_APRENDIDA_REPOSITORY)
    private readonly aprendidaRepository: ClasificacionAprendidaRepository,
    private readonly busquedaHibrida: BusquedaHibridaService,
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
  ): Promise<ExtraccionFactura> {
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
      EXTRACCION_SCHEMA as any,
    );

    // El texto del PDF se inyecta en el prompt; la imagen viaja aparte como
    // inline_data. Sin esta rama, un PDF llegaba al modelo sin contenido.
    const input = imageBase64
      ? `${EXTRACCION_INSTRUCCIONES}\n\nAnalizá la imagen adjunta y devolvé únicamente el JSON.`
      : `${EXTRACCION_INSTRUCCIONES}\n\nCONTENIDO DEL DOCUMENTO:\n"""\n${(
          text ?? ''
        ).slice(0, 60000)}\n"""\n\nDevolvé únicamente el JSON.`;

    try {
      // If we have an image, send it as inline_data to GeminiClient (mime_type + base64); otherwise invoke normally
      let response: any;
      // Pedirle el JSON a la API y no al prompt: sin esto el modelo devuelve el
      // objeto envuelto en markdown o con una frase delante, y el parser falla
      // aunque los datos estén bien. El fallback OpenAI ignora este bloque.
      const generationConfig = {
        responseMimeType: 'application/json',
        temperature: 0,
      };
      if (imageBase64 && typeof this.model.invoke === 'function') {
        response = await this.model.invoke(
          input,
          { mime_type: mimeType, data: imageBase64 },
          'extraccion-factura',
          generationConfig,
        );
      } else {
        response = await this.model.invoke(
          input,
          undefined,
          'extraccion-factura',
          generationConfig,
        );
      }
      this.logUsoLangChain('extraccion-factura', response);
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
        // El motivo importa: si el JSON es válido y lo que falla es el schema,
        // el fallback devuelve datos que nunca se validaron. Sin el mensaje del
        // error los dos casos se ven idénticos en los logs.
        console.warn(
          '[AI Extraction] StructuredOutputParser.parse failed, attempting JSON-extraction fallback:',
          parseErr instanceof Error ? parseErr.message : parseErr,
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
            '[AI Extraction] Could not parse LLM response; returning empty extraction',
          );
          return { productos: [] };
        }
      }

      return normalizarExtraccion(output);
    } catch (error) {
      console.error('[AI Extraction] Error calling LLM:', error);
      // Devolver una extracción vacía en vez de datos inventados: el usuario
      // completa los campos a mano, pero nunca firma un dato falso.
      return { productos: [] };
    }
  }

  /**
   * Clasificación por recuperar-y-reordenar.
   *
   *   1. Expansión — una sola llamada barata traduce las descripciones
   *      comerciales de la factura al vocabulario del arancel.
   *   2. Candidatos — Postgres arma 24 opciones por ítem, con diversidad de
   *      capítulos y hermanas incluidas. Sin LLM, ~30 ms.
   *   3. Rerank — elige entre esos candidatos con las notas legales a la
   *      vista. Los ítems que comparten capítulo van en una misma llamada,
   *      porque comparten las notas: medido sobre una factura de 8 ítems, eso
   *      baja el prompt un 40% y las llamadas de 9 a 5.
   *
   * No se baja por el árbol (capítulo → partida → subpartida): son 3-4
   * llamadas secuenciales por ítem y, sobre todo, un error en el primer nivel
   * es irrecuperable. Acá un error de capítulo lo puede corregir el rerank,
   * porque los candidatos vienen de varios capítulos a la vez.
   */
  async clasificarSubpartidasBatch(
    items: ClasificacionItemInput[],
  ): Promise<ClasificacionItemOutput[]> {
    if (!items || items.length === 0) return [];

    // Paso 1 — una llamada para todos los ítems.
    const expandidas = await this.expandirDescripciones(items);

    // Paso 2 — candidatos por ítem. Es solo Postgres: ni LLM ni cuota, así que
    // se puede paralelizar más que el paso 3.
    const preparados = await this.conLimiteDeConcurrencia(items, 8, (it) =>
      this.prepararItem(it, expandidas.get(it.id) ?? it.descripcion),
    );

    const clasificables = preparados.filter((p) => p.candidatos.length > 0);
    const sinCandidatos = preparados.filter((p) => p.candidatos.length === 0);

    // Paso 3 — rerank. Los ítems que comparten capítulo van en una sola
    // llamada, con las notas legales escritas una vez para todo el grupo.
    const grupos = this.agruparPorCapitulo(clasificables);
    const resultados = (
      await this.conLimiteDeConcurrencia(
        grupos,
        parseInt(process.env.LLM_CONCURRENCIA, 10) || 3,
        (g) => this.clasificarGrupo(g),
      )
    ).flat();

    const porId = new Map<string, ClasificacionItemOutput>();
    for (const p of sinCandidatos) {
      porId.set(p.item.id, {
        id: p.item.id,
        subpartida: null,
        confidence: 0,
        razon:
          p.error ?? 'Ninguna subpartida del arancel coincide con la descripción',
        descripcionExpandida: p.expandida,
      });
    }
    for (const r of resultados) porId.set(r.id, r);

    return items.map(
      (it) => porId.get(it.id) ?? { id: it.id, subpartida: null, confidence: 0 },
    );
  }

  /**
   * Agrupa los ítems que comparten el capítulo de su mejor candidato.
   *
   * Las notas legales son el 61% del prompt (medido) y son las mismas para
   * todos los ítems de un capítulo: una factura con cinco productos del
   * capítulo 84 las mandaba cinco veces. Agrupando se escriben una sola vez,
   * y de paso bajan las llamadas, que es lo que choca con el límite de
   * 20 por minuto del plan gratuito.
   *
   * `LLM_ITEMS_POR_LLAMADA=1` vuelve al comportamiento de una llamada por
   * ítem, que es el que da máxima atención por producto.
   */
  private agruparPorCapitulo(preparados: ItemPreparado[]): ItemPreparado[][] {
    const tam = parseInt(process.env.LLM_ITEMS_POR_LLAMADA, 10) || 4;
    if (tam <= 1) return preparados.map((p) => [p]);

    const porCapitulo = new Map<string, ItemPreparado[]>();
    for (const p of preparados) {
      const cap = this.capituloDominante(p.candidatos);
      const lista = porCapitulo.get(cap);
      if (lista) lista.push(p);
      else porCapitulo.set(cap, [p]);
    }

    const grupos: ItemPreparado[][] = [];
    for (const lista of porCapitulo.values()) {
      for (let i = 0; i < lista.length; i += tam) {
        grupos.push(lista.slice(i, i + tam));
      }
    }
    return grupos;
  }

  /**
   * Paso 1 — puente entre el vocabulario comercial y el legal.
   *
   * Es el paso que más recall aporta y el más barato. Las facturas dicen
   * "MOUSE OPT USB LOG M90"; el arancel dice "dispositivos por coordenadas
   * x-y". Sin esto la búsqueda no devuelve nada útil: medido contra esta base,
   * "mouse óptico usb para computadora" no trae 8471.60 ni entre 40
   * candidatos, y con la descripción expandida sale primero.
   */
  private async expandirDescripciones(
    items: ClasificacionItemInput[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (items.length === 0) return out;

    const lista = items
      .map((it) => `${it.id}\t${(it.descripcion || '').slice(0, 300)}`)
      .join('\n');

    const prompt = `Sos un clasificador arancelario boliviano. Vas a recibir descripciones de productos tal como vienen en una factura comercial: abreviadas, con marcas, modelos y a veces en inglés.

Para cada una, escribí una descripción en español apta para buscar en el Arancel Aduanero, usando el vocabulario técnico y legal del Sistema Armonizado (no el comercial).

Reglas:
- Nombrá QUÉ ES el producto con su término genérico y técnico.
- Agregá MATERIAL, FUNCIÓN y USO si se pueden deducir con seguridad del texto.
- Traducí marcas y modelos a lo que el producto es. "Logitech M90" no es información arancelaria; "ratón de computadora" sí.
- Usá los términos que emplea el arancel, no los del comercio: "ratón / dispositivo por coordenadas x-y" en vez de "mouse", "teléfono móvil (celular)" en vez de "smartphone", "neumático" en vez de "llanta".
- NO inventes material, composición ni uso si el texto no lo permite deducir. Es mejor una descripción corta y correcta que una larga e inventada.
- CRÍTICO: si el texto no aclara una distinción que separa dos partidas, NO la resuelvas: nombrá las dos. Una camisa de algodón sin más datos es "camisa para hombre de algodón, de tejido de punto o de tejido plano (el documento no lo aclara)". Elegir una al azar manda la búsqueda al capítulo equivocado y el error ya no se puede corregir después.
- Distinciones que casi nunca vienen en la factura y no hay que dar por supuestas: tejido de punto vs. plano, nuevo vs. usado o recauchutado, en bruto vs. refinado, para siembra vs. para consumo, doméstico vs. industrial.
- No agregues cantidades, precios ni códigos arancelarios.

Entrada (una línea por producto, formato "id<TAB>descripción"):
${lista}`;

    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              expandida: { type: 'string' },
            },
            required: ['id', 'expandida'],
          },
        },
      },
      required: ['items'],
    };

    try {
      const label = `expansion-descripciones(${items.length} items)`;
      const parsed = await this.invocarJSON(prompt, schema, label);
      const arr = Array.isArray(parsed?.items) ? parsed.items : [];
      for (const r of arr) {
        if (r && typeof r.id === 'string' && typeof r.expandida === 'string') {
          const texto = r.expandida.trim();
          if (texto) out.set(r.id, texto);
        }
      }
    } catch (err) {
      // Degradar a la descripción original es peor pero no fatal: la búsqueda
      // léxica todavía funciona para descripciones que ya vienen claras.
      console.warn('[AI Classify] Falló la expansión, se usa el texto crudo:', err);
    }

    // La descripción original se conserva junto a la expandida: los códigos y
    // medidas del texto de factura ("14 pulgadas", "220V") aportan a la
    // búsqueda aunque el arancel no los use como términos.
    const combinadas = new Map<string, string>();
    for (const it of items) {
      const exp = out.get(it.id);
      combinadas.set(it.id, exp ? `${exp} ${it.descripcion}` : it.descripcion);
    }
    return combinadas;
  }

  /**
   * Capítulo con más candidatos entre los mejores del ítem.
   *
   * Se vota entre los 8 primeros en vez de tomar el capítulo del candidato #1:
   * ese es inestable. Medido, "polera" y "chompa" son ambas del capítulo 61
   * pero sus mejores candidatos caían en capítulos distintos, así que quedaban
   * en llamadas separadas y se mandaban las mismas notas dos veces.
   *
   * Los empates los gana el capítulo mejor rankeado, porque el Map conserva el
   * orden de inserción y los candidatos vienen ordenados por score.
   */
  private capituloDominante(candidatos: CandidatoSubpartida[]): string {
    const votos = new Map<string, number>();
    for (const c of candidatos.slice(0, 8)) {
      votos.set(c.capitulo, (votos.get(c.capitulo) ?? 0) + 1);
    }
    let mejor = candidatos[0].capitulo;
    let max = 0;
    for (const [cap, n] of votos) {
      if (n > max) {
        max = n;
        mejor = cap;
      }
    }
    return mejor;
  }

  /** Paso 2 — candidatos de un ítem. Solo Postgres, sin LLM. */
  private async prepararItem(
    item: ClasificacionItemInput,
    expandida: string,
  ): Promise<ItemPreparado> {
    try {
      // Híbrido: acá la semántica se usa siempre. Su costo es despreciable
      // frente a la llamada de clasificación, y un capítulo ausente de los
      // candidatos es un error que el modelo ya no puede corregir.
      // 24 y no 40: en el benchmark de 16 casos, 15 aciertos estaban entre los
      // primeros 5 y el peor en el puesto 8. Las posiciones 25-40 casi nunca
      // deciden y cuestan ~1.000 tokens por ítem.
      const candidatos = await this.busquedaHibrida.candidatos(expandida, 24);
      return { item, expandida, candidatos };
    } catch (err) {
      console.error('[AI Classify] Error buscando candidatos:', err);
      return {
        item,
        expandida,
        candidatos: [],
        error: 'No se pudo consultar el arancel',
      };
    }
  }

  /** Paso 3 — una llamada para todo el grupo. */
  private async clasificarGrupo(
    grupo: ItemPreparado[],
  ): Promise<ClasificacionItemOutput[]> {
    const fallo = (razon: string): ClasificacionItemOutput[] =>
      grupo.map((p) => ({
        id: p.item.id,
        subpartida: null,
        confidence: 0,
        razon,
        descripcionExpandida: p.expandida,
      }));

    // Notas solo de los capítulos con un candidato entre los 10 primeros de
    // algún ítem del grupo. Un capítulo que asoma recién en el puesto 20 no es
    // un contendiente serio y su nota cuesta ~3.500 caracteres.
    //
    // El tope crece con el grupo pero no linealmente: un ítem solo se banca 3
    // capítulos, y un grupo necesita algo más de margen porque suma los de
    // todos sus ítems. Poner 4 fijo le regalaba un capítulo extra al caso de
    // un solo ítem.
    const topeCapitulos = Math.min(4, 2 + grupo.length);
    const capitulos = [
      ...new Set(
        grupo.flatMap((p) => p.candidatos.slice(0, 10).map((c) => c.capitulo)),
      ),
    ].slice(0, topeCapitulos);

    // Notas legales y ejemplos confirmados, en paralelo: son dos bases
    // distintas y ninguna depende de la otra.
    const [notas, ejemplos] = await Promise.all([
      this.subpartidaRepository.notasDeCapitulos(capitulos).catch((err) => {
        // Sin notas el modelo clasifica peor, pero clasifica.
        console.warn('[AI Classify] No se pudieron traer las notas legales:', err);
        return [] as NotaLegal[];
      }),
      this.aprendidaRepository.ejemplosPorCapitulo(capitulos, 8).catch((err) => {
        console.warn('[AI Classify] No se pudieron traer los ejemplos:', err);
        return [] as ClasificacionAprendida[];
      }),
    ]);

    const prompt = this.promptDeClasificacion(grupo, notas, ejemplos);
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              subpartida: { type: 'string', nullable: true },
              confianza: { type: 'integer' },
              reglaAplicada: { type: 'string', nullable: true },
              razon: { type: 'string' },
              alternativas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    subpartida: { type: 'string' },
                    porQueNo: { type: 'string' },
                  },
                  required: ['subpartida', 'porQueNo'],
                },
              },
              datosFaltantes: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'subpartida', 'confianza', 'razon'],
          },
        },
      },
      required: ['items'],
    };

    const etiqueta = `clasificacion(${grupo.map((p) => p.item.id).join(',')})`;
    let respuesta: any;
    try {
      respuesta = await this.invocarJSON(prompt, schema, etiqueta);
    } catch (err) {
      console.error('[AI Classify] Error llamando al LLM:', err);
      return fallo('Error al consultar el modelo');
    }

    const devueltos: any[] = Array.isArray(respuesta?.items) ? respuesta.items : [];
    if (devueltos.length === 0) return fallo('Respuesta ilegible del modelo');

    const porId = new Map<string, any>();
    for (const r of devueltos) {
      if (r && typeof r.id === 'string') porId.set(r.id, r);
    }

    return grupo.map((p) => this.aResultado(p, porId.get(p.item.id)));
  }

  /**
   * Convierte lo que dijo el modelo sobre un ítem en el contrato del puerto,
   * validando todo: el modelo puede saltearse un ítem, inventar un código o
   * devolver una confianza fuera de rango.
   */
  private aResultado(p: ItemPreparado, r: any): ClasificacionItemOutput {
    const base = {
      id: p.item.id,
      descripcionExpandida: p.expandida,
    };

    if (!r || typeof r !== 'object') {
      return {
        ...base,
        subpartida: null,
        confidence: 0,
        razon: 'El modelo no devolvió una respuesta para este producto',
      };
    }

    // Guardarraíl: el código elegido tiene que estar entre los candidatos DE
    // ESTE ítem, no entre los del grupo. Los LLM alucinan códigos arancelarios
    // con formato perfecto y eso no se detecta a ojo; un código mal declarado
    // en aduana tiene costo real.
    const validos = new Set(p.candidatos.map((c) => c.code));
    const elegido =
      typeof r.subpartida === 'string' && validos.has(r.subpartida.trim())
        ? r.subpartida.trim()
        : null;

    if (r.subpartida && !elegido) {
      console.warn(
        `[AI Classify] El modelo devolvió "${r.subpartida}", que no estaba entre los candidatos de ${p.item.id}. Descartado.`,
      );
    }

    const conf = Number(r.confianza);
    return {
      ...base,
      subpartida: elegido,
      confidence:
        elegido && Number.isFinite(conf)
          ? Math.max(0, Math.min(100, Math.round(conf)))
          : 0,
      razon:
        typeof r.razon === 'string' && r.razon.trim()
          ? r.razon.trim()
          : elegido
            ? undefined
            : 'El modelo no encontró una subpartida adecuada',
      reglaAplicada:
        typeof r.reglaAplicada === 'string' && r.reglaAplicada.trim()
          ? r.reglaAplicada.trim()
          : undefined,
      alternativas: Array.isArray(r.alternativas)
        ? r.alternativas
            .filter(
              (a: any) =>
                a &&
                typeof a.subpartida === 'string' &&
                validos.has(a.subpartida.trim()),
            )
            .slice(0, 3)
            .map((a: any) => ({
              subpartida: a.subpartida.trim(),
              porQueNo: String(a.porQueNo ?? ''),
            }))
        : undefined,
      datosFaltantes: Array.isArray(r.datosFaltantes)
        ? r.datosFaltantes.filter((d: any) => typeof d === 'string').slice(0, 5)
        : undefined,
    };
  }

  /**
   * Bloque de candidatos, agrupado por el encabezado de su partida.
   *
   * La ruta de cada hoja arranca con el texto de la partida, que puede superar
   * los 250 caracteres y se repite idéntico en cada hermana. Con 12 candidatos
   * del mismo capítulo eso son ~800 tokens de texto duplicado, por capítulo.
   * Escribirlo una vez por grupo entrega exactamente la misma información.
   *
   * Los grupos salen en el orden del mejor candidato de cada uno, así que el
   * listado sigue reflejando la confianza de la recuperación. De paso deja
   * juntas a las subpartidas hermanas, que es como pide compararlas la RGI 6.
   */
  private candidatosAgrupados(candidatos: CandidatoSubpartida[]): string {
    const grupos = new Map<string, CandidatoSubpartida[]>();
    for (const c of candidatos) {
      const encabezado = this.tramosDeRuta(c)[0];
      const grupo = grupos.get(encabezado);
      if (grupo) grupo.push(c);
      else grupos.set(encabezado, [c]);
    }

    const bloques: string[] = [];
    for (const [encabezado, items] of grupos) {
      const filas = items.map((c) => {
        const cola =
          this.tramosDeRuta(c).slice(1).join(' > ') || '(toda la partida)';
        const um = c.unidad ? ` | UM: ${c.unidad}` : '';
        const marca = c.esHermano ? ' [hermana]' : '';
        return `  ${c.code}${marca} | ${cola}${um} | GA ${c.ga}%`;
      });
      bloques.push(`▸ ${encabezado}\n${filas.join('\n')}`);
    }
    return bloques.join('\n');
  }

  /** Tramos de la ruta jerárquica, sin puntuación de cierre ni vacíos. */
  private tramosDeRuta(c: CandidatoSubpartida): string[] {
    const ruta = (c.ruta ?? c.descHoja ?? '').replace(/\s+/g, ' ').trim();
    const partes = ruta
      .split('>')
      .map((t) => t.replace(/[\s:.]+$/, '').trim())
      .filter(Boolean);
    return partes.length > 0 ? partes : [c.code];
  }

  private promptDeClasificacion(
    grupo: ItemPreparado[],
    notas: NotaLegal[],
    ejemplos: ClasificacionAprendida[] = [],
  ): string {
    // Un bloque por producto, con sus propios candidatos. Los candidatos NO se
    // comparten entre ítems: cada uno tiene los suyos. Lo que se comparte —y es
    // de donde sale el ahorro— son las notas legales y las instrucciones.
    const productos = grupo
      .map((p) => {
        // Las descripciones mínimas solo del top-5: las tienen 8.135 filas, son
        // largas, y en los candidatos de más abajo no cambian la decisión.
        const minimas = p.candidatos
          .slice(0, 5)
          .filter((c) => c.descripcionesMinimas)
          .map((c) => `    ${c.code}: ${c.descripcionesMinimas}`)
          .join('\n');

        return [
          `── PRODUCTO id="${p.item.id}"`,
          `Descripción de la factura: ${p.item.descripcion}`,
          `Interpretación técnica: ${p.expandida}`,
          `Sus candidatos:`,
          this.candidatosAgrupados(p.candidatos),
          minimas ? `  Descripciones mínimas exigidas:\n${minimas}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n');

    const bloqueNotas = notas
      .map(
        (n) =>
          `── ${n.tipo === 'seccion' ? 'SECCIÓN' : 'CAPÍTULO'} ${n.clave} — ${n.titulo ?? ''}\n${n.nota}`,
      )
      .join('\n\n');

    // Criterio que este importador ya aplicó y firmó. Vale más que cualquier
    // razonamiento del modelo: refleja cómo despacha realmente su mercadería.
    const bloqueEjemplos = ejemplos
      .map((e) => `"${e.descripcion}" → ${e.subpartida}`)
      .join('\n');

    const cantidad = grupo.length;
    const encabezado =
      cantidad === 1
        ? 'PRODUCTO A CLASIFICAR'
        : `PRODUCTOS A CLASIFICAR (${cantidad}). Cada uno tiene SU PROPIA lista de candidatos: no mezcles códigos entre productos.`;

    return `Sos un especialista en clasificación arancelaria de la Aduana Nacional de Bolivia (nomenclatura NANDINA).

${encabezado}
Dentro de la lista de candidatos, la línea que empieza con ▸ es el texto de la
partida, y debajo cuelgan sus subpartidas con lo que las distingue entre sí, su
unidad de medida y su gravamen.

${productos}
${bloqueEjemplos ? `\nCLASIFICACIONES QUE ESTE IMPORTADOR YA CONFIRMÓ EN ESTOS CAPÍTULOS\n${bloqueEjemplos}\n` : ''}
${bloqueNotas ? `\nNOTAS LEGALES APLICABLES\n${bloqueNotas}\n` : ''}
CÓMO DECIDIR
1. Aplicá la RGI 1: el texto de la partida y las Notas legales de sección y capítulo mandan sobre cualquier parecido comercial. Revisá primero si alguna nota EXCLUYE el producto del capítulo.
2. Aplicá la RGI 6: compará solo entre subpartidas del mismo nivel. Las marcadas [hermana] están justamente para eso.
3. Una subpartida residual ("Los demás", "Las demás") solo corresponde si NINGUNA de sus hermanas específicas describe el producto.
4. Si dudás entre dos, elegí la más específica (RGI 3a).
5. Si hay clasificaciones ya confirmadas para mercadería equivalente, seguí ese criterio: es el que este importador viene declarando. Apartate solo si alguna Nota legal lo contradice, y decilo en "razon".

REGLAS DE RESPUESTA
- Devolvé EXACTAMENTE una entrada por producto, con su "id" tal como aparece arriba. No omitas ninguno.
- "subpartida" DEBE ser uno de los códigos listados como candidatos DE ESE producto, o null.
- Cada producto se decide por separado. Que dos compartan capítulo no significa que compartan subpartida.
- Si la descripción no alcanza para decidir con fundamento, devolvé null y listá en "datosFaltantes" qué habría que saber (material, uso, potencia, composición...). Un null honesto vale más que un código dudoso: esto termina en una declaración jurada.
- "confianza" es un entero 0-100 y tiene que reflejar la certeza real, no ser optimista por defecto.
- "razon" es una frase breve en español citando la regla o la nota que decidió.
- En "alternativas" poné hasta 2 códigos de la lista que estuvieron cerca, con el motivo del descarte.`;
  }

  /**
   * Llamada con salida estructurada. El schema lo hace cumplir la API de
   * Gemini (`responseSchema`), así que no hay que adivinar el JSON entre
   * markdown y prosa. Con OpenAI de fallback se cae al parseo tolerante.
   */
  private async invocarJSON(
    prompt: string,
    schema: Record<string, any>,
    label: string,
    reintentos = 3,
  ): Promise<any> {
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature: 0,
    };

    for (let intento = 0; ; intento++) {
      try {
        await this.esperarCompuertaDeCuota();
        const response = await this.textModel.invoke(
          prompt,
          undefined,
          label,
          generationConfig,
        );
        this.logUsoLangChain(label, response);

        const contentStr = this.textoDeRespuesta(response);
        // GeminiClient no lanza: ante un fallo devuelve `{content: ''}` con el
        // error adjunto. Se convierte en excepción para que el reintento de
        // abajo lo trate igual que cualquier otro fallo.
        if (!contentStr || !contentStr.trim()) {
          throw response?.error ?? new Error('Respuesta vacía del modelo');
        }

        const parsed = this.tryParseJSON(contentStr);
        if (parsed && typeof parsed === 'object') return parsed;

        // El fallback OpenAI ignora generationConfig y puede devolver el JSON
        // envuelto en markdown.
        return this.tryParseJSON(this.sanitizeModelJSON(contentStr));
      } catch (err) {
        if (intento >= reintentos) throw err;
        const espera = this.esperaAntesDeReintentar(err, intento);
        // Compuerta global: si la API dijo "estás pasado de cuota", no tiene
        // sentido que los demás ítems en vuelo sigan golpeando. Se frena a
        // todos hasta el mismo instante y después cada uno arranca con su
        // jitter, para no volver a chocar en bloque.
        this.pausarLlamadasPorCuota(err, espera);
        console.warn(
          `[AI Classify] ${label}: ${String((err as any)?.message ?? err).slice(0, 120)} — reintento ${intento + 1}/${reintentos} en ${Math.round(espera / 1000)}s`,
        );
        await new Promise((r) => setTimeout(r, espera));
      }
    }
  }

  /**
   * Instante (epoch ms) antes del cual no se debe llamar al modelo. Compartido
   * por todos los ítems en vuelo.
   */
  private pausaLlamadasHasta = 0;

  private pausarLlamadasPorCuota(err: any, espera: number): void {
    const msg = String(err?.message ?? err ?? '');
    if (!/429|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg)) return;
    this.pausaLlamadasHasta = Math.max(
      this.pausaLlamadasHasta,
      Date.now() + espera,
    );
  }

  private async esperarCompuertaDeCuota(): Promise<void> {
    const falta = this.pausaLlamadasHasta - Date.now();
    if (falta <= 0) return;
    // Jitter: sin esto los N workers reanudan en el mismo milisegundo y
    // vuelven a agotar la cuota de golpe.
    await new Promise((r) => setTimeout(r, falta + Math.random() * 1500));
  }

  /**
   * Milisegundos a esperar antes de reintentar.
   *
   * Clasificar una factura son 1 + N llamadas, así que con el plan gratuito de
   * Gemini (20 req/min) el rate limit se toca con facturas de ~19 líneas o más.
   * Ante un 429 Google devuelve `retryDelay` en el cuerpo del error: se respeta
   * ese valor, porque esperar menos solo gasta otro intento.
   */
  private esperaAntesDeReintentar(err: any, intento: number): number {
    const msg = String(err?.message ?? err ?? '');
    const esCuota = /429|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg);

    if (esCuota) {
      const m = msg.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
      const sugerido = m ? Math.ceil(parseFloat(m[1]) * 1000) : 0;
      // Un segundo de colchón; tope de 45 s para no colgar la petición HTTP.
      return Math.min(Math.max(sugerido + 1000, 2000), 45000);
    }
    // Fallo transitorio de red o respuesta vacía: backoff exponencial.
    return Math.min(1000 * 2 ** intento, 8000);
  }

  /**
   * Saca el texto de la respuesta del modelo.
   *
   * `generateContent` de Gemini devuelve `{content: {parts: [{text}], role}}`,
   * y `normalizeModelResponse` no desenvuelve esa forma: deja pasar el sobre
   * entero, que es JSON válido, así que `JSON.parse` "funciona" y devuelve el
   * sobre en vez del contenido. Va aparte del normalizador legacy para no
   * tocar el camino de extracción de facturas.
   */
  private textoDeRespuesta(response: any): string {
    const deParts = (parts: any): string | null =>
      Array.isArray(parts)
        ? parts.map((p: any) => p?.text ?? '').join('')
        : null;

    if (typeof response === 'string') return response;
    if (response && typeof response === 'object') {
      const c = response.content;
      if (typeof c === 'string') return c;
      const desdeContent = deParts(c?.parts);
      if (desdeContent) return desdeContent;
      const desdeRaiz = deParts(response.parts);
      if (desdeRaiz) return desdeRaiz;
      const desdeCandidatos = deParts(
        response.candidates?.[0]?.content?.parts ??
          response.candidates?.[0]?.parts,
      );
      if (desdeCandidatos) return desdeCandidatos;
    }
    return this.unwrapTextEnvelope(this.normalizeModelResponse(response));
  }

  /** Ejecuta `fn` sobre `items` con un tope de tareas simultáneas. */
  private async conLimiteDeConcurrencia<T, R>(
    items: T[],
    limite: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let siguiente = 0;

    const worker = async () => {
      while (true) {
        const i = siguiente++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(limite, items.length) }, worker),
    );
    return out;
  }

  // Cuando no hay GEMINI_API_KEY se usa ChatOpenAI, que no pasa por
  // GeminiClient.reportarUso: el consumo viene en el AIMessage de LangChain.
  // Si la respuesta ya trae `usage` (GeminiClient) no logueamos de nuevo.
  private logUsoLangChain(label: string, response: any): void {
    if (!response || typeof response !== 'object' || response.usage) return;
    const meta =
      response.usage_metadata ??
      response.response_metadata?.usage ??
      response.response_metadata?.tokenUsage;
    if (!meta) return;
    const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const input = n(meta.input_tokens ?? meta.prompt_tokens ?? meta.promptTokens);
    const output = n(
      meta.output_tokens ?? meta.completion_tokens ?? meta.completionTokens,
    );
    const total = n(meta.total_tokens ?? meta.totalTokens) || input + output;
    const modelo = response.response_metadata?.model_name ?? 'openai';
    console.log(
      `[LLM Tokens] ${label} model=${modelo} input=${input} output=${output} total=${total}`,
    );
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
