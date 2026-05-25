import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import {
  DimsListFilter,
  DimsListResult,
  DimsRepository,
} from '../../../core/domain/ports/outbound/dims.repository';
import { DimsEntity } from '../entities/dims.entity';

@Injectable()
export class TypeOrmDimsRepository implements DimsRepository {
  constructor(
    @InjectRepository(DimsEntity)
    private readonly repo: Repository<DimsEntity>,
  ) {}

  async save(dims: DimsEntity): Promise<DimsEntity> {
    return this.repo.save(dims);
  }

  async findById(id: string): Promise<DimsEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async list(filter: DimsListFilter): Promise<DimsListResult> {
    const qb = this.repo.createQueryBuilder('d');
    if (filter.estado) {
      qb.andWhere('d.estado = :estado', { estado: filter.estado });
    }
    if (filter.q) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('d.id LIKE :q', { q: `%${filter.q}%` }).orWhere(
            'd.proveedor LIKE :q',
            { q: `%${filter.q}%` },
          );
        }),
      );
    }
    qb.orderBy('d.creadaEn', 'DESC')
      .skip((filter.page - 1) * filter.pageSize)
      .take(filter.pageSize);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findDrafts(): Promise<DimsEntity[]> {
    return this.repo.find({
      where: { estado: 'borrador' },
      order: { actualizadaEn: 'DESC' },
    });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
