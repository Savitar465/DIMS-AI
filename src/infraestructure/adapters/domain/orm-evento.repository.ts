import { Injectable } from '@nestjs/common';
import { EventoRepository } from '../../../core/domain/ports/outbound/evento.repository';
import { Cambio, Evento, Mensaje } from '../../../core/domain/models/evento';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { EventoEntity } from '../../persistance/entities/evento.entity';
import { ObjectId } from 'mongodb';
import { CriteriaQuery, getOrder, getWhere } from '../../shared/criteria/type-orm.helper';
import { PaginatedResource } from '../../shared/criteria/paginated-resource';
import { eventoMetaModel } from '../../persistance/metamodel/evento-meta-model';

@Injectable()
export class OrmEventoRepository implements EventoRepository {
  constructor(
    @InjectRepository(EventoEntity)
    private readonly eventoRepository: MongoRepository<EventoEntity>,
  ) {
  }

  async save(evento: Evento<Mensaje | Cambio>): Promise<EventoEntity> {
    const eventoEntity: EventoEntity = {
      _id: new ObjectId(),
      usuario: new ObjectId(evento.usuario),
      data: evento.data,
      tipo: evento.tipo,
      sala: new ObjectId(evento.sala),
      usuariosMencionados: evento.usuariosMencionados.map(
        (usuario) => new ObjectId(usuario),
      ),
      estado: evento.estado,
      usuCre: evento.usuCre,
      fecCre: evento.fecCre,
      usuMod: evento.usuMod,
      fecMod: evento.fecMod,
    };
    return this.eventoRepository.save(eventoEntity);
  }

  async findById(id: string): Promise<EventoEntity> {
    const objectId = new ObjectId(id);
    return await this.eventoRepository.findOneBy({ where: { _id: objectId } });
  }

  async update(evento: Evento<Mensaje | Cambio>): Promise<EventoEntity> {
    const eventoEntity: EventoEntity = await this.findById(evento.id);
    eventoEntity.data = evento.data;
    eventoEntity.tipo = evento.tipo;
    eventoEntity.sala = new ObjectId(evento.sala);
    eventoEntity.usuariosMencionados = evento.usuariosMencionados.map(
      (usuario) => new ObjectId(usuario),
    );
    eventoEntity.usuMod = evento.usuMod;
    eventoEntity.fecMod = new Date();
    return this.eventoRepository.save(eventoEntity);
  }

  async searchByCriteria(criteria: CriteriaQuery): Promise<PaginatedResource<Evento<Mensaje | Cambio>>> {
    const where = getWhere(criteria.filter, eventoMetaModel);
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

    const [eventosE, total] = await this.eventoRepository.findAndCount(query);

    return {
      items: eventosE.map((eventoE) => Evento.fromEntity(eventoE)),
      totalItems: total,
      page: criteria.pagination ? criteria.pagination.page : 0,
      size: criteria.pagination ? criteria.pagination.size : total,
    };
  }
}
