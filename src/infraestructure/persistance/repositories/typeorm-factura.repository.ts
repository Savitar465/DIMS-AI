import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FacturaRepository } from '../../../core/domain/ports/outbound/factura.repository';
import { FacturaEntity } from '../entities/factura.entity';

@Injectable()
export class TypeOrmFacturaRepository implements FacturaRepository {
  constructor(
    @InjectRepository(FacturaEntity)
    private readonly repo: Repository<FacturaEntity>,
  ) {}

  async save(factura: FacturaEntity): Promise<FacturaEntity> {
    return this.repo.save(factura);
  }

  async findById(id: string): Promise<FacturaEntity | null> {
    return this.repo.findOne({ where: { id } });
  }
}
