/**
 * Aprendizaje de clasificaciones confirmadas (fase 4).
 *
 * Dos cosas que importan y son fáciles de romper sin darse cuenta:
 *
 *  1. Una clasificación ya confirmada tiene que resolverse SIN llamar al LLM.
 *  2. El autoguardado NO tiene que aprender. Reenvía la subpartida de todos
 *     los ítems en cada save, así que si contara como confirmación, cada
 *     sugerencia de la IA que nadie revisó entraría como verdad y volvería
 *     como ejemplo en el prompt, reforzándose sola.
 */
import { INestApplicationContext } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AI_SERVICE,
  AIService,
} from '../src/core/domain/ports/outbound/ai.service';
import {
  CLASIFICACION_APRENDIDA_REPOSITORY,
  ClasificacionAprendidaRepository,
} from '../src/core/domain/ports/outbound/clasificacion-aprendida.repository';
import { hashDescripcion } from '../src/core/domain/models/descripcion-hash';
import { ClasificarSubpartidasUseCase } from '../src/core/application/usecases/facturas/clasificar-subpartidas.usecase';
import { UpdateFacturaItemUseCase } from '../src/core/application/usecases/facturas/update-factura-item.usecase';
import { ClasificacionAprendidaEntity } from '../src/infraestructure/persistance/entities/clasificacion-aprendida.entity';
import { FacturaEntity } from '../src/infraestructure/persistance/entities/factura.entity';
import {
  crearContexto,
  describeSiHayBase,
  instalarModeloDoble,
} from './entorno-integracion';

const DESC = 'CAFE TOSTADO Y MOLIDO 500G TEST';
const CODIGO = '0901.21.20.00';
const FACTURA_ID = 'test-integracion-aprendizaje';

/** El registro es fire-and-forget para no bloquear la respuesta al usuario. */
const esperarRegistro = () => new Promise((r) => setTimeout(r, 700));

describeSiHayBase('Clasificaciones aprendidas', () => {
  let app: INestApplicationContext;
  let aprendidas: ClasificacionAprendidaRepository;
  let repoAprendidas: Repository<ClasificacionAprendidaEntity>;
  let repoFacturas: Repository<FacturaEntity>;

  const hash = hashDescripcion(DESC);

  beforeAll(async () => {
    app = await crearContexto();
    aprendidas = app.get<ClasificacionAprendidaRepository>(
      CLASIFICACION_APRENDIDA_REPOSITORY,
    );
    repoAprendidas = app.get(getRepositoryToken(ClasificacionAprendidaEntity));
    repoFacturas = app.get(getRepositoryToken(FacturaEntity));
  });

  afterEach(async () => {
    await repoAprendidas.delete({ hash });
    await repoFacturas.delete({ id: FACTURA_ID });
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('registro', () => {
    it('guarda la confirmación y deriva el capítulo', async () => {
      await aprendidas.registrar({
        hash,
        descripcion: DESC,
        subpartida: CODIGO,
        confirmadoPor: 'test',
      });

      const [r] = await aprendidas.findByHashes([hash]);
      expect(r.subpartida).toBe(CODIGO);
      expect(r.capitulo).toBe('09');
      expect(r.veces).toBe(1);
    });

    it('incrementa el contador en vez de reiniciarlo', async () => {
      await aprendidas.registrar({ hash, descripcion: DESC, subpartida: CODIGO });
      await aprendidas.registrar({ hash, descripcion: DESC, subpartida: CODIGO });

      const [r] = await aprendidas.findByHashes([hash]);
      expect(r.veces).toBe(2);
    });

    it('encuentra la misma mercancía descrita en otro orden', async () => {
      await aprendidas.registrar({ hash, descripcion: DESC, subpartida: CODIGO });

      const [r] = await aprendidas.findByHashes([
        hashDescripcion('test 500g molido y tostado cafe'),
      ]);
      expect(r?.subpartida).toBe(CODIGO);
    });

    it('ignora una subpartida sin capítulo válido', async () => {
      await aprendidas.registrar({ hash, descripcion: DESC, subpartida: 'x' });
      expect(await aprendidas.findByHashes([hash])).toHaveLength(0);
    });
  });

  describe('ejemplos para el prompt', () => {
    it('devuelve solo los del capítulo pedido', async () => {
      await aprendidas.registrar({ hash, descripcion: DESC, subpartida: CODIGO });

      const delCapitulo = await aprendidas.ejemplosPorCapitulo(['09', '84']);
      expect(delCapitulo.map((e) => e.subpartida)).toContain(CODIGO);

      const deOtro = await aprendidas.ejemplosPorCapitulo(['61']);
      expect(deOtro.map((e) => e.subpartida)).not.toContain(CODIGO);
    });

    it('llegan al prompt del rerank, antes de las notas legales', async () => {
      await aprendidas.registrar({ hash, descripcion: DESC, subpartida: CODIGO });

      const ai = app.get<AIService>(AI_SERVICE);
      const doble = instalarModeloDoble(app, (label) =>
        label.startsWith('expansion')
          ? { items: [{ id: 'y', expandida: 'cafe molido tostado' }] }
          : { subpartida: null, confianza: 0, razon: 'test' },
      );

      await ai.clasificarSubpartidasBatch([
        { id: 'y', descripcion: 'CAFE MOLIDO GOURMET 250G' },
      ]);

      const prompt =
        doble.llamadas.find((l) => l.label.startsWith('clasificacion'))?.prompt ?? '';

      expect(prompt).toContain('YA CONFIRMÓ');
      expect(prompt).toContain(DESC);
      expect(prompt).toContain(CODIGO);
      // El orden importa: primero el criterio propio del importador, después
      // la ley, que es la que puede contradecirlo.
      expect(prompt.indexOf('YA CONFIRMÓ')).toBeLessThan(
        prompt.indexOf('NOTAS LEGALES'),
      );
    });
  });

  describe('clasificación', () => {
    const guardarFactura = (item: Record<string, unknown>) =>
      repoFacturas.save({
        id: FACTURA_ID,
        estado: 'extraida',
        items: [item],
      } as any);

    it('resuelve desde lo aprendido sin llamar al LLM', async () => {
      await aprendidas.registrar({ hash, descripcion: DESC, subpartida: CODIGO });
      await guardarFactura({
        id: 'it1',
        descripcion: DESC,
        cantidad: 1,
        precioUnit: 10,
        subtotal: 10,
        clasificada: false,
      });

      // Cualquier llamada al modelo revienta la prueba.
      instalarModeloDoble(app, () => undefined);

      const factura = await app.get(ClasificarSubpartidasUseCase).execute(FACTURA_ID);
      const item: any = factura.items[0];

      expect(item.subpartida).toBe(CODIGO);
      expect(item.confidence).toBe(100);
      // No es una sugerencia: ya lo decidió una persona.
      expect(item.aiSuggested).toBe(false);
    });
  });

  describe('qué cuenta como confirmación', () => {
    const DESC_IA = 'ARTICULO CLASIFICADO POR IA SIN REVISAR TEST';
    const hashIA = hashDescripcion(DESC_IA);
    const SUGERIDA = '8471.30.00.90';

    beforeEach(async () => {
      await repoAprendidas.delete({ hash: hashIA });
      await repoFacturas.save({
        id: FACTURA_ID,
        estado: 'extraida',
        items: [
          {
            id: 'it2',
            descripcion: DESC_IA,
            cantidad: 1,
            precioUnit: 1,
            subtotal: 1,
            subpartida: SUGERIDA,
            aiSuggested: true,
            clasificada: true,
          },
        ],
      } as any);
    });

    afterEach(async () => {
      await repoAprendidas.delete({ hash: hashIA });
    });

    it('el autoguardado que reenvía el mismo valor no aprende', async () => {
      await app.get(UpdateFacturaItemUseCase).execute(FACTURA_ID, 'it2', {
        descripcion: DESC_IA,
        cantidad: 1,
        precioUnit: 1,
        subpartida: SUGERIDA,
      });
      await esperarRegistro();

      expect(await aprendidas.findByHashes([hashIA])).toHaveLength(0);
    });

    it('corregir el código sí aprende', async () => {
      await app.get(UpdateFacturaItemUseCase).execute(FACTURA_ID, 'it2', {
        subpartida: '8471.60.20.00',
      });
      await esperarRegistro();

      const [r] = await aprendidas.findByHashes([hashIA]);
      expect(r?.subpartida).toBe('8471.60.20.00');
    });

    it('aceptar a mano el mismo código aprende si viene marcado', async () => {
      await app.get(UpdateFacturaItemUseCase).execute(FACTURA_ID, 'it2', {
        subpartida: SUGERIDA,
        subpartidaConfirmada: true,
      });
      await esperarRegistro();

      const [r] = await aprendidas.findByHashes([hashIA]);
      expect(r?.subpartida).toBe(SUGERIDA);
    });
  });
});
