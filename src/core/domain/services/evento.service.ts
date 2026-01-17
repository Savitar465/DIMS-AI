import { ConstantsRepository } from '../../../interfaces/dependency-injection/constants/constants';
import { Inject, Injectable } from '@nestjs/common';
import { EventoRepository } from '../ports/outbound/evento.repository';
import { Cambio, Evento, Mensaje } from '../models/evento';
import { EventBus } from '@nestjs/cqrs';
import { EventoCreadoEvent } from '../events/evento/evento-creado.event';
import { FindEventoQuery } from '../../application/query/evento/find-evento.query';
import { EventoModificadoEvent } from '../events/evento/evento-modificado.event';
import { DesactivarEventoRequest } from '../../../interfaces/dtos/request/evento/desactivar-evento.request';
import { EstadoEnum } from '../../shared/enums/estado.enum';
import { CrearEventoRequest } from '../../../interfaces/dtos/request/evento/crear-evento.request';
import { ModificarEventoRequest } from '../../../interfaces/dtos/request/evento/modificar-evento.request';
import { FindEventoSearch } from '../../application/query/evento/find-evento-search.query';

@Injectable()
export class EventoService {

  constructor(
    @Inject(ConstantsRepository.EVENTO_REPOSITORY)
    private readonly eventoRepository: EventoRepository,
    private readonly eventEventBus: EventBus
  ) {
  }

  async save(crearEventoRequest: CrearEventoRequest<Mensaje | Cambio>) {
    return Evento.create({
      usuario: crearEventoRequest.usuario,
      data: crearEventoRequest.data,
      tipo: crearEventoRequest.tipo,
      sala: crearEventoRequest.sala,
      usuariosMencionados: crearEventoRequest.usuariosMencionados,
      usuAudit: crearEventoRequest.usuAudit,
    }).then(async (eventoC) => {
      const eventoE = await this.eventoRepository.save(eventoC);
      const evento = Evento.fromEntity(eventoE);
      if (evento) {
        this.eventEventBus.publish(new EventoCreadoEvent(evento));
      }
      return evento;
    });
  }

  async findById(query: FindEventoQuery) {
    const evento = await this.eventoRepository.findById(query.id);
    return Evento.fromEntity(evento);
  }

  async search(query: FindEventoSearch) {
    return await this.eventoRepository.searchByCriteria(query.criteria);
  }

  async update(modificarEventoRequest: ModificarEventoRequest<Mensaje | Cambio>): Promise<Evento<Mensaje | Cambio>> {
    const eventoU = await Evento.create({
      usuario: modificarEventoRequest.usuario,
      data: modificarEventoRequest.data,
      tipo: modificarEventoRequest.tipo,
      sala: modificarEventoRequest.sala,
      usuariosMencionados: modificarEventoRequest.usuariosMencionados,
      usuAudit: modificarEventoRequest.usuAudit,
    });

    const eventoE = await this.eventoRepository.update(eventoU);

    const evento = Evento.fromEntity(eventoE);

    if (evento) {
      this.eventEventBus.publish(new EventoModificadoEvent(evento));
    }

    return evento;
  }

  async deactivate(desactivarEventoRequest: DesactivarEventoRequest) {
    const evento = await Evento.create({
      id: desactivarEventoRequest.id,
      estado: EstadoEnum.INACTIVO,
    });
    const eventoSaved = await this.eventoRepository.update(evento);

    const eventoResponse: Evento<Mensaje | Cambio> = Evento.fromEntity(eventoSaved);

    return eventoResponse;
  }
}
