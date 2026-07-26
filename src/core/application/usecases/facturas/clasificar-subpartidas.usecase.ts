import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AI_SERVICE,
  AIService,
} from '../../../domain/ports/outbound/ai.service';
import {
  FACTURA_REPOSITORY,
  FacturaRepository,
} from '../../../domain/ports/outbound/factura.repository';
import {
  CLASIFICACION_CACHE_REPOSITORY,
  ClasificacionCacheRepository,
} from '../../../domain/ports/outbound/clasificacion-cache.repository';
import {
  CLASIFICACION_APRENDIDA_REPOSITORY,
  ClasificacionAprendidaRepository,
} from '../../../domain/ports/outbound/clasificacion-aprendida.repository';
import { hashDescripcion } from '../../../domain/models/descripcion-hash';
import { FacturaEntity } from '../../../../infraestructure/persistance/entities/factura.entity';

@Injectable()
export class ClasificarSubpartidasUseCase {
  constructor(
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
    @Inject(CLASIFICACION_CACHE_REPOSITORY)
    private readonly cacheRepository: ClasificacionCacheRepository,
    @Inject(CLASIFICACION_APRENDIDA_REPOSITORY)
    private readonly aprendidaRepository: ClasificacionAprendidaRepository,
  ) {}

  async execute(facturaId: string, force = false): Promise<FacturaEntity> {
    const factura = await this.facturaRepository.findById(facturaId);
    if (!factura) {
      throw new NotFoundException({
        error: {
          code: 'not_found',
          message: `Factura ${facturaId} no encontrada.`,
        },
      });
    }

    const items = Array.isArray(factura.items) ? factura.items : [];
    const pendientes = force ? items : items.filter((it) => !it.clasificada);
    if (pendientes.length === 0) return factura;

    // Tres niveles antes de gastar una llamada al modelo:
    //   1. clasificacion_aprendida — confirmado por una persona. Es verdad, no
    //      sugerencia, así que gana sobre todo lo demás.
    //   2. clasificacion_cache — lo que respondió la IA para esta descripción.
    //   3. el LLM.
    // `force` saltea 1 y 2: es la vía para corregir una entrada aprendida que
    // resultó estar mal, que si no quedaría fijada para siempre.
    const hashByItemId = new Map<string, string>();
    for (const it of pendientes) {
      hashByItemId.set(it.id, hashDescripcion(it.descripcion));
    }
    const uniqueHashes = [...new Set(hashByItemId.values())];

    const aprendidasByHash = force
      ? new Map<string, { subpartida: string }>()
      : new Map(
          (await this.aprendidaRepository.findByHashes(uniqueHashes)).map(
            (r) => [r.hash, r],
          ),
        );

    const cacheRows = force
      ? []
      : await this.cacheRepository.findByHashes(uniqueHashes);
    const cacheByHash = new Map(cacheRows.map((r) => [r.hash, r]));

    // Particionar entre hits y misses.
    const itemsMiss = pendientes.filter((it) => {
      const h = hashByItemId.get(it.id)!;
      return !aprendidasByHash.has(h) && !cacheByHash.has(h);
    });

    let aiResults: Awaited<
      ReturnType<AIService['clasificarSubpartidasBatch']>
    > = [];
    if (itemsMiss.length > 0) {
      aiResults = await this.aiService.clasificarSubpartidasBatch(
        itemsMiss.map((it) => ({ id: it.id, descripcion: it.descripcion })),
      );
      // Guardar los resultados de IA en el cache para futuros hits.
      const toCache = itemsMiss.map((it) => {
        const r = aiResults.find((x) => x.id === it.id);
        return {
          hash: hashByItemId.get(it.id)!,
          subpartida: r?.subpartida ?? null,
          confidence: r?.confidence ?? 0,
          razon: r?.razon,
          descripcionMuestra: it.descripcion,
        };
      });
      await this.cacheRepository.saveMany(toCache);
    }

    const aiById = new Map(aiResults.map((r) => [r.id, r]));

    factura.items = items.map((it) => {
      if (force ? false : it.clasificada) return it;
      const hash = hashByItemId.get(it.id);
      const aprendida = hash ? aprendidasByHash.get(hash) : undefined;

      // Lo aprendido primero: ya lo confirmó una persona para esta misma
      // descripción, así que no es una sugerencia de IA y no se marca como tal.
      if (aprendida) {
        return {
          ...it,
          subpartida: aprendida.subpartida,
          confidence: 100,
          aiSuggested: false,
          clasificada: true,
          razon: 'Confirmada antes por el usuario para esta misma descripción',
        };
      }

      const fromCache = hash ? cacheByHash.get(hash) : undefined;
      const fromAI = aiById.get(it.id);
      const r = fromAI ?? fromCache;
      if (!r) return it;
      return {
        ...it,
        subpartida: r.subpartida,
        confidence: r.confidence,
        aiSuggested: !!r.subpartida,
        clasificada: true,
        razon: r.razon,
      };
    });

    return this.facturaRepository.save(factura);
  }
}
