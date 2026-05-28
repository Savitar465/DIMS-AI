import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClasificacionCacheEntity } from '../entities/clasificacion-cache.entity';
import {
  ClasificacionCacheEntry,
  ClasificacionCacheRepository,
} from '../../../core/domain/ports/outbound/clasificacion-cache.repository';

@Injectable()
export class TypeOrmClasificacionCacheRepository
  implements ClasificacionCacheRepository
{
  constructor(
    @InjectRepository(ClasificacionCacheEntity)
    private readonly repo: Repository<ClasificacionCacheEntity>,
  ) {}

  async findByHashes(hashes: string[]): Promise<ClasificacionCacheEntry[]> {
    if (hashes.length === 0) return [];
    const rows = await this.repo.find({ where: { hash: In(hashes) } });
    return rows.map((r) => ({
      hash: r.hash,
      subpartida: r.subpartida,
      confidence: r.confidence,
      razon: r.razon ?? undefined,
      descripcionMuestra: r.descripcionMuestra,
    }));
  }

  async saveMany(entries: ClasificacionCacheEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const rows = entries.map((e) => {
      const row = new ClasificacionCacheEntity();
      row.hash = e.hash;
      row.subpartida = e.subpartida;
      row.confidence = e.confidence;
      row.razon = e.razon ?? null;
      row.descripcionMuestra = e.descripcionMuestra;
      return row;
    });
    // upsert por la columna `hash` (primary key) — sobrescribe si ya existe.
    await this.repo.save(rows);
  }
}
