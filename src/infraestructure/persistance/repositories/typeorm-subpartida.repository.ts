import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { LineaId, Subpartida } from '../../../core/domain/models/subpartida';
import { SubpartidaRepository } from '../../../core/domain/ports/outbound/subpartida.repository';
import { SubpartidaEntity } from '../entities/subpartida.entity';
import { SUBPARTIDAS_SEED } from '../seed/subpartidas.seed';

@Injectable()
export class TypeOrmSubpartidaRepository
  implements SubpartidaRepository, OnModuleInit
{
  constructor(
    @InjectRepository(SubpartidaEntity)
    private readonly repo: Repository<SubpartidaEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    const count = await this.repo.count();
    if (count === 0) {
      await this.repo.save(SUBPARTIDAS_SEED);
    }
  }

  private toModel(e: SubpartidaEntity): Subpartida {
    return new Subpartida({
      code: e.code,
      desc: e.desc,
      linea: e.linea,
      arancel: e.arancel,
      iva: e.iva,
      ice: e.ice,
      gravamen: e.gravamen,
    });
  }

  async search(termino: string, linea?: string): Promise<Subpartida[]> {
    const where: any[] = [];
    if (termino) {
      where.push({ desc: Like(`%${termino}%`) });
      where.push({ code: Like(`%${termino}%`) });
    }
    let results = where.length
      ? await this.repo.find({ where })
      : await this.repo.find();
    if (linea) {
      results = results.filter((s) => s.linea === linea);
    }
    return results.map((e) => this.toModel(e));
  }

  async findAll(): Promise<Subpartida[]> {
    const results = await this.repo.find();
    return results.map((e) => this.toModel(e));
  }

  async findByCode(code: string): Promise<Subpartida | null> {
    const e = await this.repo.findOne({ where: { code } });
    return e ? this.toModel(e) : null;
  }

  async findByLinea(linea: LineaId): Promise<Subpartida[]> {
    const results = await this.repo.find({ where: { linea } });
    return results.map((e) => this.toModel(e));
  }
}
