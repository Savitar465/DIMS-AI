/**
 * Búsqueda híbrida léxica + semántica (fase 5).
 *
 * Lo que más importa proteger acá no es que la semántica funcione, sino que NO
 * se use cuando el índice está a medio poblar: pgvector siempre devuelve el
 * vecino más cercano, así que con cobertura parcial contesta con total
 * confianza la mejor opción de un subconjunto arbitrario. El fallo es
 * silencioso — no hay error, solo resultados sutilmente equivocados.
 */
import { INestApplicationContext } from '@nestjs/common';
import { BusquedaHibridaService } from '../src/core/application/services/busqueda-hibrida.service';
import {
  BUSQUEDA_SEMANTICA_REPOSITORY,
  BusquedaSemanticaRepository,
} from '../src/core/domain/ports/outbound/busqueda-semantica.repository';
import {
  EMBEDDING_SERVICE,
  EmbeddingService,
} from '../src/core/domain/ports/outbound/embedding.service';
import {
  SUBPARTIDA_REPOSITORY,
  SubpartidaRepository,
} from '../src/core/domain/ports/outbound/subpartida.repository';
import { crearContexto, describeSiHayBase } from './entorno-integracion';

describeSiHayBase('Búsqueda híbrida', () => {
  let app: INestApplicationContext;
  let busqueda: BusquedaHibridaService;
  let semantica: BusquedaSemanticaRepository;
  let embeddings: EmbeddingService;
  let subpartidas: SubpartidaRepository;

  // Se restauran después de cada prueba para no contaminar las siguientes.
  let originales: Record<string, any>;

  beforeAll(async () => {
    app = await crearContexto();
    busqueda = app.get(BusquedaHibridaService);
    semantica = app.get(BUSQUEDA_SEMANTICA_REPOSITORY);
    embeddings = app.get(EMBEDDING_SERVICE);
    subpartidas = app.get(SUBPARTIDA_REPOSITORY);

    originales = {
      contarEmbeddings: semantica.contarEmbeddings,
      contarHojas: subpartidas.contarHojas,
      buscar: semantica.buscar,
      embedConsulta: embeddings.embedConsulta,
      estaDisponible: embeddings.estaDisponible,
    };
  });

  afterEach(() => {
    Object.assign(semantica, {
      contarEmbeddings: originales.contarEmbeddings,
      buscar: originales.buscar,
    });
    Object.assign(subpartidas, { contarHojas: originales.contarHojas });
    Object.assign(embeddings, {
      embedConsulta: originales.embedConsulta,
      estaDisponible: originales.estaDisponible,
    });
    // El servicio cachea la cobertura por 5 minutos.
    (busqueda as any).cobertura = { ok: false, vence: 0 };
  });

  afterAll(async () => {
    await app?.close();
  });

  /** Simula cobertura del índice y cuenta las llamadas al embebedor. */
  const prepararCobertura = (embebidas: number, hojas = 8132) => {
    const llamadas = { embed: 0 };
    semantica.contarEmbeddings = async () => embebidas;
    subpartidas.contarHojas = async () => hojas;
    embeddings.estaDisponible = () => true;
    embeddings.embedConsulta = async () => {
      llamadas.embed++;
      return new Array(768).fill(0.01);
    };
    return llamadas;
  };

  describe('guarda de cobertura', () => {
    it('no usa la semántica con el índice a medio poblar', async () => {
      const llamadas = prepararCobertura(900);

      expect(await busqueda.estaDisponible()).toBe(false);

      // Una consulta que lo léxico no resuelve: aun así no debe embeberse.
      await busqueda.buscar('shampoo anticaspa 400ml');
      expect(llamadas.embed).toBe(0);
    });

    it('la habilita cuando el índice está completo', async () => {
      prepararCobertura(8132);
      expect(await busqueda.estaDisponible()).toBe(true);
    });

    it('la deja pasar con una cobertura casi total', async () => {
      prepararCobertura(8000); // 98,4%
      expect(await busqueda.estaDisponible()).toBe(true);
    });

    it('no la usa si falta la API key', async () => {
      prepararCobertura(8132);
      embeddings.estaDisponible = () => false;
      expect(await busqueda.estaDisponible()).toBe(false);
    });
  });

  describe('cuándo se gasta la llamada semántica', () => {
    it('no la gasta si lo léxico ya encontró algo bueno', async () => {
      const llamadas = prepararCobertura(8132);

      const r = await busqueda.buscar('cafe tostado molido');

      expect(r.length).toBeGreaterThan(0);
      expect(llamadas.embed).toBe(0);
    });

    it('la gasta cuando lo léxico viene flojo', async () => {
      const llamadas = prepararCobertura(8132);
      semantica.buscar = async () => [
        { codigo: '3305100000', similitud: 0.81 },
      ];

      await busqueda.buscar('shampoo anticaspa 400ml');

      expect(llamadas.embed).toBe(1);
    });

    it('incorpora el resultado semántico que lo léxico no encontró', async () => {
      prepararCobertura(8132);
      // 33.05.10 = champús. Inalcanzable por palabras desde "shampoo".
      semantica.buscar = async () => [
        { codigo: '3305100000', similitud: 0.83 },
      ];

      const r = await busqueda.buscar('shampoo anticaspa 400ml');
      const encontrado = r.find((m) => m.code === '3305.10.00.00');

      expect(encontrado).toBeDefined();
      expect(encontrado!.origenSemantico).toBe(true);
    });
  });

  describe('degradación', () => {
    it('devuelve lo léxico si el embebedor falla', async () => {
      prepararCobertura(8132);
      embeddings.embedConsulta = async () => null;

      const r = await busqueda.buscar('shampoo anticaspa 400ml');
      expect(Array.isArray(r)).toBe(true);
    });

    it('devuelve lo léxico si pgvector falla', async () => {
      prepararCobertura(8132);
      semantica.buscar = async () => {
        throw new Error('pgvector caído');
      };

      const r = await busqueda.buscar('cemento portland');
      expect(r.length).toBeGreaterThan(0);
    });
  });

  describe('candidatos para el rerank', () => {
    it('suma los semánticos a los léxicos sin perder ninguno', async () => {
      prepararCobertura(8132);
      semantica.buscar = async () => [
        { codigo: '3305100000', similitud: 0.83 },
      ];

      const soloLexicos = await subpartidas.buscarCandidatos('cafe tostado molido', 40);
      const hibridos = await busqueda.candidatos('cafe tostado molido', 40);

      const codigos = new Set(hibridos.map((c) => c.code));
      for (const c of soloLexicos) expect(codigos.has(c.code)).toBe(true);
      expect(codigos.has('3305.10.00.00')).toBe(true);
    });
  });
});
