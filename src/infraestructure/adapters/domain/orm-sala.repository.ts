import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { SalaRepository } from 'src/core/domain/ports/outbound/sala.repository';
import { SalaEntity } from 'src/infraestructure/persistance/entities/sala.entity';
import { Sala } from 'src/core/domain/models/sala';
import { ObjectId } from 'mongodb';
import { CriteriaQuery, getOrder, getWhere } from 'src/infraestructure/shared/criteria/type-orm.helper';
import { PaginatedResource } from 'src/infraestructure/shared/criteria/paginated-resource';
import { salaMetaModel } from 'src/infraestructure/persistance/metamodel/sala-meta-model';

@Injectable()
export class OrmSalaRepository implements SalaRepository {
  constructor(
    @InjectRepository(SalaEntity)
    private readonly salaRepository: MongoRepository<SalaEntity>,
  ) {
  }

  async save(sala: Sala): Promise<SalaEntity> {
    const salaEntity: SalaEntity = {
      _id: new ObjectId(),
      usuarios: sala.usuarios.map(
        usuario => new ObjectId(usuario),
      ),
      estado: sala.estado,
      usuCre: sala.usuCre,
      fecCre: sala.fecCre,
      usuMod: sala.usuMod,
      fecMod: sala.fecMod,
    };
    return this.salaRepository.save(salaEntity);
  }

  async findById(id: string): Promise<SalaEntity> {
    const objectId = new ObjectId(id);
    return await this.salaRepository.findOneBy({
      where: { _id: objectId },
    });
  }

  async update(sala: Sala): Promise<SalaEntity> {
    const salaEntity: SalaEntity = await this.findById(sala.id);
    salaEntity.usuarios = sala.usuarios.map(
      usuario => new ObjectId(usuario),
    );
    salaEntity.estado = sala.estado;
    salaEntity.usuMod = sala.usuMod;
    salaEntity.fecMod = new Date();
    return this.salaRepository.save(salaEntity);
  }

  async searchByCriteria(criteria: CriteriaQuery): Promise<PaginatedResource<Sala>> {
    const where = getWhere(criteria.filter, salaMetaModel);
    const order = getOrder(criteria.sort);
    let query: any;
    if (criteria.pagination) {
      query = {
        where,
        order,
        take: criteria.pagination.limit,
        skip: criteria.pagination.offset,
      };
    } else {
      query = {
        where,
        order,
      };
    }
    const [salasE, total] = await this.salaRepository.findAndCount(query);
    return {
      items: salasE.map((salaE) => Sala.fromEntity(salaE)),
      totalItems: total,
      page: criteria.pagination ? criteria.pagination.page : 0,
      size: criteria.pagination ? criteria.pagination.size : total,
    };
  }
}