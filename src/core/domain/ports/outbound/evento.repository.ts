import { Cambio, Evento, Mensaje } from '../../models/evento';
import { EventoEntity } from '../../../../infraestructure/persistance/entities/evento.entity';
import { CriteriaQuery } from '../../../../infraestructure/shared/criteria/type-orm.helper';
import { PaginatedResource } from '../../../../infraestructure/shared/criteria/paginated-resource';

export interface EventoRepository {
  save(evento: Evento<Cambio | Mensaje>): Promise<EventoEntity>;
  findById(id: string): Promise<EventoEntity>;
  update(evento: Evento<Cambio | Mensaje>): Promise<EventoEntity>;
  searchByCriteria(criteria: CriteriaQuery): Promise<PaginatedResource<Evento<Cambio | Mensaje>>>;
}