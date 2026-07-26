import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ClasificacionAprendida,
  ClasificacionAprendidaRepository,
} from '../../../core/domain/ports/outbound/clasificacion-aprendida.repository';
import { ClasificacionAprendidaEntity } from '../entities/clasificacion-aprendida.entity';

@Injectable()
export class TypeOrmClasificacionAprendidaRepository
  implements ClasificacionAprendidaRepository
{
  constructor(
    @InjectRepository(ClasificacionAprendidaEntity)
    private readonly repo: Repository<ClasificacionAprendidaEntity>,
  ) {}

  private toModel(e: ClasificacionAprendidaEntity): ClasificacionAprendida {
    return {
      hash: e.hash,
      descripcion: e.descripcion,
      subpartida: e.subpartida,
      capitulo: e.capitulo,
      veces: e.veces,
    };
  }

  async registrar(entrada: {
    hash: string;
    descripcion: string;
    subpartida: string;
    confirmadoPor?: string;
  }): Promise<void> {
    const capitulo = (entrada.subpartida || '').replace(/\D/g, '').slice(0, 2);
    if (!entrada.hash || !entrada.subpartida || capitulo.length !== 2) return;

    // Upsert en SQL: `veces` tiene que incrementarse sobre el valor guardado.
    // Con el `orUpdate` del query builder se pisaría con el valor del INSERT
    // (siempre 1) y el contador nunca subiría. Además así dos confirmaciones
    // simultáneas del mismo producto no se pierden.
    await this.repo.query(
      `INSERT INTO clasificacion_aprendida
         (hash, descripcion, subpartida, capitulo, veces, "confirmadoPor", "updatedAt")
       VALUES ($1, $2, $3, $4, 1, $5, now())
       ON CONFLICT (hash) DO UPDATE SET
         descripcion     = EXCLUDED.descripcion,
         subpartida      = EXCLUDED.subpartida,
         capitulo        = EXCLUDED.capitulo,
         veces           = clasificacion_aprendida.veces + 1,
         "confirmadoPor" = EXCLUDED."confirmadoPor",
         "updatedAt"     = now()`,
      [
        entrada.hash,
        entrada.descripcion,
        entrada.subpartida,
        capitulo,
        entrada.confirmadoPor ?? null,
      ],
    );
  }

  async findByHashes(hashes: string[]): Promise<ClasificacionAprendida[]> {
    const únicos = [...new Set((hashes ?? []).filter(Boolean))];
    if (únicos.length === 0) return [];
    const filas = await this.repo.find({ where: { hash: In(únicos) } });
    return filas.map((f) => this.toModel(f));
  }

  async ejemplosPorCapitulo(
    capitulos: string[],
    limite = 8,
  ): Promise<ClasificacionAprendida[]> {
    const caps = [...new Set((capitulos ?? []).filter(Boolean))];
    if (caps.length === 0) return [];
    const filas = await this.repo.find({
      where: { capitulo: In(caps) },
      order: { veces: 'DESC', updatedAt: 'DESC' },
      take: limite,
    });
    return filas.map((f) => this.toModel(f));
  }
}
