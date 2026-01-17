import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { ModificarEventoRequest } from '../../../../interfaces/dtos/request/evento/modificar-evento.request';
import { Cambio, Mensaje } from '../../../domain/models/evento';
import { EventoResponse } from '../../../../interfaces/dtos/response/evento.response';
import { EventoService } from '../../../domain/services/evento.service';
import { EventoMapper } from '../../../../interfaces/shared/mapper/evento.mapper';

@Injectable()
export class ModificarEventoUsecase {
  constructor(
    @Inject(ConstantsService.EVENTO_SERVICE)
    private readonly eventoService: EventoService
  ) {
  }

  async execute(modificarEventoRequest: ModificarEventoRequest<Mensaje | Cambio>): Promise<EventoResponse> {
    const evento = await this.eventoService.update(modificarEventoRequest);
    return await EventoMapper.toResponse(evento);
  }
}