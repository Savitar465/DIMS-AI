/**
 * Guardarraíl del rerank (fase 2).
 *
 * Lo que se protege: los LLM alucinan códigos arancelarios con formato
 * perfecto, y eso no se detecta a ojo. Un código inexistente en una DIMS es
 * una declaración jurada mal presentada, así que la única defensa es exigir
 * que el código elegido esté entre los candidatos que salieron del arancel.
 *
 * Los candidatos se buscan contra la base real; solo el modelo es un doble.
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

const ITEM = { id: 'x', descripcion: 'CAFE TOSTADO Y MOLIDO 500G' };
const EXPANDIDA = 'cafe tostado y molido sin descafeinar';
const CODIGO_REAL = '0901.21.20.00';

describeSiHayBase('Guardarraíl de clasificación', () => {
  let app: INestApplicationContext;
  let ai: AIService;

  beforeAll(async () => {
    app = await crearContexto();
    ai = app.get<AIService>(AI_SERVICE);
  });

  afterAll(async () => {
    await app?.close();
  });

  /**
   * Hace que el modelo conteste `respuesta` para el ítem en el paso de
   * clasificación. El modelo responde una lista, porque los ítems que
   * comparten capítulo van en una sola llamada.
   */
  const clasificarCon = async (respuesta: Record<string, unknown>) => {
    instalarModeloDoble(app, (label) =>
      label.startsWith('expansion')
        ? { items: [{ id: ITEM.id, expandida: EXPANDIDA }] }
        : { items: [{ id: ITEM.id, ...respuesta }] },
    );
    const [r] = await ai.clasificarSubpartidasBatch([ITEM]);
    return r;
  };

  it('acepta un código que está entre los candidatos', async () => {
    const r = await clasificarCon({
      subpartida: CODIGO_REAL,
      confianza: 95,
      razon: 'café molido sin descafeinar',
    });

    expect(r.subpartida).toBe(CODIGO_REAL);
    expect(r.confidence).toBe(95);
  });

  it('descarta un código alucinado aunque tenga formato válido', async () => {
    const r = await clasificarCon({
      subpartida: '0901.99.99.00',
      confianza: 99,
      razon: 'inventado',
    });

    expect(r.subpartida).toBeNull();
    expect(r.confidence).toBe(0);
  });

  it('respeta el null honesto del modelo y conserva qué datos faltan', async () => {
    const r = await clasificarCon({
      subpartida: null,
      confianza: 0,
      razon: 'la descripción no alcanza',
      datosFaltantes: ['material', 'uso'],
    });

    expect(r.subpartida).toBeNull();
    expect(r.datosFaltantes).toEqual(['material', 'uso']);
  });

  it('acota la confianza al rango 0-100', async () => {
    const r = await clasificarCon({
      subpartida: CODIGO_REAL,
      confianza: 900,
      razon: 'x',
    });

    expect(r.confidence).toBe(100);
  });

  it('descarta las alternativas que no salieron del arancel', async () => {
    const r = await clasificarCon({
      subpartida: CODIGO_REAL,
      confianza: 90,
      razon: 'ok',
      alternativas: [
        { subpartida: '9999.99.99.99', porQueNo: 'no existe' },
        { subpartida: '0901.21.10.00', porQueNo: 'es en grano, no molido' },
      ],
    });

    const codigos = (r.alternativas ?? []).map((a) => a.subpartida);
    expect(codigos).not.toContain('9999.99.99.99');
    expect(codigos).toContain('0901.21.10.00');
  });

  it('enriquece la descripción de factura antes de buscar candidatos', async () => {
    const doble = instalarModeloDoble(app, (label) =>
      label.startsWith('expansion')
        ? { items: [{ id: ITEM.id, expandida: EXPANDIDA }] }
        : {
            items: [
              { id: ITEM.id, subpartida: CODIGO_REAL, confianza: 90, razon: 'ok' },
            ],
          },
    );
    const [r] = await ai.clasificarSubpartidasBatch([ITEM]);

    // La expansión se conserva junto al texto original: los códigos y medidas
    // de la factura aportan a la búsqueda aunque el arancel no los use.
    expect(r.descripcionExpandida).toContain(EXPANDIDA);
    expect(r.descripcionExpandida).toContain(ITEM.descripcion);

    // Una sola llamada de expansión para todo el lote, más una por ítem.
    const expansiones = doble.llamadas.filter((l) =>
      l.label.startsWith('expansion'),
    );
    expect(expansiones).toHaveLength(1);
  });

  it('arma el prompt con candidatos y notas legales del capítulo', async () => {
    const doble = instalarModeloDoble(app, (label) =>
      label.startsWith('expansion')
        ? { items: [{ id: ITEM.id, expandida: EXPANDIDA }] }
        : {
            items: [
              { id: ITEM.id, subpartida: CODIGO_REAL, confianza: 90, razon: 'ok' },
            ],
          },
    );
    await ai.clasificarSubpartidasBatch([ITEM]);

    const rerank = doble.llamadas.find((l) => l.label.startsWith('clasificacion'));
    expect(rerank).toBeDefined();
    expect(rerank!.prompt).toContain(`PRODUCTO id="${ITEM.id}"`);
    expect(rerank!.prompt).toContain('Sus candidatos');
    expect(rerank!.prompt).toContain(CODIGO_REAL);
    expect(rerank!.prompt).toContain('NOTAS LEGALES');
  });
});
