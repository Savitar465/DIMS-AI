import { createHash } from 'crypto';
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
import { FacturaEntity } from '../../../../infraestructure/persistance/entities/factura.entity';

@Injectable()
export class ClasificarSubpartidasUseCase {
  constructor(
    @Inject(AI_SERVICE) private readonly aiService: AIService,
    @Inject(FACTURA_REPOSITORY)
    private readonly facturaRepository: FacturaRepository,
    @Inject(CLASIFICACION_CACHE_REPOSITORY)
    private readonly cacheRepository: ClasificacionCacheRepository,
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

    // OPTIMIZACIÓN #3 — Lookup en cache antes de la IA.
    // Hashea la descripción normalizada y resuelve hits desde DB.
    const hashByItemId = new Map<string, string>();
    for (const it of pendientes) {
      hashByItemId.set(it.id, this.hashDescripcion(it.descripcion));
    }
    const uniqueHashes = [...new Set(hashByItemId.values())];
    const cacheRows = await this.cacheRepository.findByHashes(uniqueHashes);
    const cacheByHash = new Map(cacheRows.map((r) => [r.hash, r]));

    // Particionar entre hits y misses.
    const itemsMiss = pendientes.filter(
      (it) => !cacheByHash.has(hashByItemId.get(it.id)!),
    );

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

  // Hash sobre la descripción normalizada: minúsculas, sin acentos, sin
  // puntuación, palabras únicas en orden ASC. Así "Mouse USB" y "USB Mouse"
  // colapsan a la misma entrada del cache.
  private hashDescripcion(desc: string): string {
    const norm = (desc || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 0)
      .sort()
      .join(' ');
    return createHash('sha256').update(norm).digest('hex');
  }
}
