/**
 * Utilidades comunes a las pruebas de integración de clasificación.
 *
 * Estas pruebas usan las bases de verdad (la del arancel y la de la app) pero
 * NUNCA la API de Gemini: el modelo se reemplaza por un doble. Así se pueden
 * correr siempre, sin gastar cuota y sin depender de que el modelo responda
 * igual dos veces.
 */
import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AI_SERVICE, AIService } from '../src/core/domain/ports/outbound/ai.service';

// El .env todavía no está cargado cuando jest evalúa el módulo, y hace falta
// para decidir si saltear la suite.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  /* dotenv viene con @nestjs/config; si no está, el chequeo de abajo avisa. */
}

/**
 * Las pruebas necesitan la base del arancel. Sin credenciales se saltean con
 * un mensaje claro en vez de fallar: en un CI sin acceso a esa base, un rojo
 * acá no significaría que el código esté mal.
 */
export const hayBaseDeDatos = Boolean(
  process.env.ARANCEL_DB_HOST && process.env.DATABASE_HOST,
);

export const describeSiHayBase = hayBaseDeDatos ? describe : describe.skip;

export async function crearContexto(): Promise<INestApplicationContext> {
  return NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
}

/** Respuesta con la forma que devuelve `generateContent` de Gemini. */
export function respuestaGemini(payload: unknown) {
  return { content: { parts: [{ text: JSON.stringify(payload) }] } };
}

export interface ModeloDoble {
  /** Prompts recibidos, como `[label, prompt]`. */
  llamadas: Array<{ label: string; prompt: string }>;
}

/**
 * Reemplaza el cliente del modelo dentro del servicio de IA.
 *
 * `responder` recibe el label de la llamada (`expansion-...` o
 * `clasificacion(...)`) y devuelve el objeto que debería haber contestado el
 * modelo. Si devuelve `undefined`, la llamada falla — útil para verificar que
 * un camino NO usa el LLM.
 */
export function instalarModeloDoble(
  app: INestApplicationContext,
  responder: (label: string, prompt: string) => unknown,
): ModeloDoble {
  const servicio = app.get<AIService>(AI_SERVICE) as any;
  const doble: ModeloDoble = { llamadas: [] };

  servicio.textModel = {
    invoke: async (prompt: string, _inline: unknown, label: string) => {
      doble.llamadas.push({ label, prompt });
      const payload = responder(label, prompt);
      if (payload === undefined) {
        throw new Error(`El modelo no debería haberse llamado (${label})`);
      }
      return respuestaGemini(payload);
    },
  };

  return doble;
}
