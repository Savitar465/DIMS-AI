/**
 * Mide el costo en prompt de clasificar una factura, y en qué se va.
 *
 *   npm run prompt:medir
 *
 * No gasta cuota: el modelo se reemplaza por un doble y solo se captura el
 * prompt que se le habría enviado. Sirve para evaluar cualquier cambio que
 * afecte el consumo de tokens antes de pagarlo.
 *
 * Comparar agrupado contra no agrupado:
 *   LLM_ITEMS_POR_LLAMADA=1 npm run prompt:medir
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AI_SERVICE, AIService } from '../src/core/domain/ports/outbound/ai.service';

/**
 * Factura de importación realista: un importador trae mercadería relacionada,
 * así que varios ítems caen en el mismo capítulo. Es justo el caso que la
 * agrupación aprovecha, y un set con un capítulo por ítem no lo mostraría.
 */
// `expandida` imita lo que devuelve el paso de expansión en producción. Sin
// eso la recuperación queda degradada y la medición sería pesimista.
const ITEMS = [
  { id: 'i1', descripcion: 'NOTEBOOK HP 14" CORE I5 8GB RAM',
    expandida: 'máquina automática para tratamiento o procesamiento de datos, portátil, de peso inferior a 10 kg' },
  { id: 'i2', descripcion: 'TECLADO INALAMBRICO USB LOGITECH',
    expandida: 'teclado, unidad de entrada de máquina automática para tratamiento o procesamiento de datos' },
  { id: 'i3', descripcion: 'MONITOR LED 24 PULGADAS FULL HD',
    expandida: 'monitor, unidad de visualización de máquina automática para tratamiento o procesamiento de datos' },
  { id: 'i4', descripcion: 'IMPRESORA MULTIFUNCION TINTA CONTINUA',
    expandida: 'impresora, unidad de salida de máquina automática para tratamiento o procesamiento de datos' },
  { id: 'i5', descripcion: 'CAMISA M/L 100% ALGODON CABALLERO T.M',
    expandida: 'camisa para hombre, de algodón, de tejido de punto o de tejido plano (el documento no lo aclara)' },
  { id: 'i6', descripcion: 'POLERA ALGODON ESTAMPADA T.L',
    expandida: 'camiseta de punto de algodón, t-shirt' },
  { id: 'i7', descripcion: 'CHOMPA LANA CUELLO REDONDO',
    expandida: 'suéter, pulóver, cárdigan, de punto, de lana' },
  { id: 'i8', descripcion: 'CAFE TOSTADO Y MOLIDO 500G',
    expandida: 'café tostado, sin descafeinar, molido' },
];

// Derivado de las mediciones reales: el prompt del café dio 14.091 caracteres
// y la API reportó ~4.549 tokens de entrada.
const CHARS_POR_TOKEN = 3.1;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const ai = app.get<AIService>(AI_SERVICE) as any;

  const prompts: Array<{ label: string; prompt: string }> = [];
  ai.textModel = {
    invoke: async (prompt: string, _i: any, label: string) => {
      if (label.startsWith('clasificacion')) prompts.push({ label, prompt });
      return {
        content: {
          parts: [
            {
              text: label.startsWith('expansion')
                ? JSON.stringify({
                    items: ITEMS.map((i) => ({ id: i.id, expandida: i.expandida })),
                  })
                : JSON.stringify({
                    items: ITEMS.map((i) => ({
                      id: i.id, subpartida: null, confianza: 0, razon: 'x',
                    })),
                  }),
            },
          ],
        },
      };
    },
  };

  await ai.clasificarSubpartidasBatch(ITEMS);

  // Corta el prompt en bloques para ver dónde se van los caracteres.
  const trozo = (p: string, desde: string, hastas: string[]): number => {
    const i = p.indexOf(desde);
    if (i < 0) return 0;
    const fin = hastas
      .map((h) => p.indexOf(h, i + desde.length))
      .filter((x) => x > 0)
      .sort((a, b) => a - b)[0];
    return (fin > 0 ? fin : p.length) - i;
  };

  const acum = { total: 0, notas: 0 };

  console.log(`Ítems: ${ITEMS.length} · Llamadas de clasificación: ${prompts.length}\n`);
  console.log('llamada'.padEnd(28), 'ítems'.padStart(6), 'chars'.padStart(8), 'notas'.padStart(8));

  for (const { label, prompt } of prompts) {
    const ids = label.slice('clasificacion('.length, -1).split(',');
    const notas = trozo(prompt, 'NOTAS LEGALES', ['CÓMO DECIDIR']);
    acum.total += prompt.length;
    acum.notas += notas;
    console.log(
      ids.join(',').slice(0, 26).padEnd(28),
      String(ids.length).padStart(6),
      String(prompt.length).padStart(8),
      String(notas).padStart(8),
    );
  }

  const porItem = acum.total / ITEMS.length;
  console.log('\n' + '─'.repeat(62));
  console.log(`Total del prompt        ${Math.round(acum.total)} chars`);
  console.log(`Notas legales           ${Math.round(acum.notas)} chars (${Math.round((100 * acum.notas) / acum.total)}%)`);
  console.log(`Por ítem                ${Math.round(porItem)} chars ≈ ${Math.round(porItem / CHARS_POR_TOKEN)} tokens`);
  console.log(`Llamadas al LLM         ${prompts.length + 1} (1 de expansión + ${prompts.length} de clasificación)`);

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
