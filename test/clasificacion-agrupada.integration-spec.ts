/**
 * Agrupación de ítems por capítulo en una sola llamada.
 *
 * Las notas legales son la mayor parte del prompt y son idénticas para todos
 * los ítems de un capítulo: mandarlas una vez por grupo baja ~40% los tokens y
 * las llamadas, que es lo que choca con el límite de 20 por minuto.
 *
 * Lo que hay que proteger es que agrupar NO mezcle productos: cada ítem se
 * decide con sus propios candidatos y recibe su propio resultado.
 */
import { INestApplicationContext } from '@nestjs/common';
import {
  AI_SERVICE,
  AIService,
} from '../src/core/domain/ports/outbound/ai.service';
import {
  crearContexto,
  describeSiHayBase,
  instalarModeloDoble,
} from './entorno-integracion';

// Dos productos del capítulo 84 y uno del 09: los primeros deberían viajar
// juntos y el tercero aparte.
const INFORMATICA = [
  {
    id: 'a1',
    descripcion: 'NOTEBOOK HP 14',
    expandida:
      'máquina automática para tratamiento o procesamiento de datos, portátil',
  },
  {
    id: 'a2',
    descripcion: 'TECLADO USB',
    expandida:
      'teclado, unidad de entrada de máquina automática para tratamiento de datos',
  },
];
const CAFE = {
  id: 'b1',
  descripcion: 'CAFE MOLIDO 500G',
  expandida: 'café tostado, sin descafeinar, molido',
};

describeSiHayBase('Clasificación agrupada por capítulo', () => {
  let app: INestApplicationContext;
  let ai: AIService;

  const TODOS = [...INFORMATICA, CAFE];

  beforeAll(async () => {
    app = await crearContexto();
    ai = app.get<AIService>(AI_SERVICE);
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Responde `porItem(id)` para cada ítem pedido en esa llamada. */
  const correr = (porItem: (id: string) => Record<string, unknown>) =>
    instalarModeloDoble(app, (label) => {
      if (label.startsWith('expansion')) {
        return { items: TODOS.map((i) => ({ id: i.id, expandida: i.expandida })) };
      }
      const ids = label.slice('clasificacion('.length, -1).split(',');
      return { items: ids.map((id) => ({ id, ...porItem(id) })) };
    });

  it('mete los ítems del mismo capítulo en una sola llamada', async () => {
    const doble = correr(() => ({ subpartida: null, confianza: 0, razon: 'x' }));

    await ai.clasificarSubpartidasBatch(
      TODOS.map((i) => ({ id: i.id, descripcion: i.descripcion })),
    );

    const clasificaciones = doble.llamadas.filter((l) =>
      l.label.startsWith('clasificacion'),
    );

    // 3 ítems en menos de 3 llamadas: al menos dos viajaron juntos.
    expect(clasificaciones.length).toBeLessThan(TODOS.length);

    const juntos = clasificaciones.find((l) => l.label.includes(','));
    expect(juntos).toBeDefined();
    expect(juntos!.label).toContain('a1');
    expect(juntos!.label).toContain('a2');
    // El café no tiene nada que hacer en esa llamada.
    expect(juntos!.label).not.toContain('b1');
  });

  it('escribe las notas legales una sola vez para todo el grupo', async () => {
    const doble = correr(() => ({ subpartida: null, confianza: 0, razon: 'x' }));

    await ai.clasificarSubpartidasBatch(
      INFORMATICA.map((i) => ({ id: i.id, descripcion: i.descripcion })),
    );

    const prompt =
      doble.llamadas.find((l) => l.label.startsWith('clasificacion'))?.prompt ?? '';

    // Un solo bloque de notas, aunque el prompt lleve dos productos.
    expect(prompt.split('NOTAS LEGALES APLICABLES')).toHaveLength(2);
    expect(prompt).toContain('PRODUCTO id="a1"');
    expect(prompt).toContain('PRODUCTO id="a2"');
  });

  it('devuelve un resultado por ítem, sin mezclarlos', async () => {
    // Cada ítem recibe el código del OTRO: el guardarraíl tiene que descartarlo
    // porque no está entre SUS candidatos.
    correr((id) => ({
      subpartida: id === 'a1' ? '0901.21.20.00' : '8471.30.00.90',
      confianza: 95,
      razon: 'cruzado a propósito',
    }));

    const res = await ai.clasificarSubpartidasBatch(
      INFORMATICA.map((i) => ({ id: i.id, descripcion: i.descripcion })),
    );

    expect(res).toHaveLength(2);
    expect(res.map((r) => r.id).sort()).toEqual(['a1', 'a2']);
    // A a1 se le pasó un código de café: no está entre sus candidatos.
    expect(res.find((r) => r.id === 'a1')!.subpartida).toBeNull();
  });

  it('no pierde un ítem si el modelo se lo saltea', async () => {
    instalarModeloDoble(app, (label) => {
      if (label.startsWith('expansion')) {
        return {
          items: INFORMATICA.map((i) => ({ id: i.id, expandida: i.expandida })),
        };
      }
      // Responde solo por el primero.
      return {
        items: [{ id: 'a1', subpartida: null, confianza: 0, razon: 'ok' }],
      };
    });

    const res = await ai.clasificarSubpartidasBatch(
      INFORMATICA.map((i) => ({ id: i.id, descripcion: i.descripcion })),
    );

    expect(res).toHaveLength(2);
    const a2 = res.find((r) => r.id === 'a2')!;
    expect(a2.subpartida).toBeNull();
    expect(a2.razon).toMatch(/no devolvió una respuesta/i);
  });

  it('LLM_ITEMS_POR_LLAMADA=1 vuelve a una llamada por ítem', async () => {
    const previo = process.env.LLM_ITEMS_POR_LLAMADA;
    process.env.LLM_ITEMS_POR_LLAMADA = '1';
    try {
      const doble = correr(() => ({ subpartida: null, confianza: 0, razon: 'x' }));

      await ai.clasificarSubpartidasBatch(
        INFORMATICA.map((i) => ({ id: i.id, descripcion: i.descripcion })),
      );

      const clasificaciones = doble.llamadas.filter((l) =>
        l.label.startsWith('clasificacion'),
      );
      expect(clasificaciones).toHaveLength(INFORMATICA.length);
      expect(clasificaciones.every((l) => !l.label.includes(','))).toBe(true);
    } finally {
      if (previo === undefined) delete process.env.LLM_ITEMS_POR_LLAMADA;
      else process.env.LLM_ITEMS_POR_LLAMADA = previo;
    }
  });
});
