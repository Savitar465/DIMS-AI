import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { CrearEventoRequest } from '../../../../interfaces/dtos/request/evento/crear-evento.request';
import { EventoService } from '../../../domain/services/evento.service';
import { Cambio, Mensaje } from '../../../domain/models/evento';
import { EventoMapper } from '../../../../interfaces/shared/mapper/evento.mapper';
import { EventoResponse } from '../../../../interfaces/dtos/response/evento.response';

@Injectable()
export class CrearEventoUsecase {
  constructor(
    @Inject(ConstantsService.EVENTO_SERVICE)
    private readonly eventoService: EventoService
  ) {
  }

  async execute(crearEventoRequest: CrearEventoRequest<Mensaje | Cambio>): Promise<EventoResponse> {
    const evento = await this.eventoService.save(crearEventoRequest);
    return await EventoMapper.toResponse(evento);
  }
}