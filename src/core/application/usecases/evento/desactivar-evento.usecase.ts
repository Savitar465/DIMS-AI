import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { EventoResponse } from '../../../../interfaces/dtos/response/evento.response';
import { EventoService } from '../../../domain/services/evento.service';
import { EventoMapper } from '../../../../interfaces/shared/mapper/evento.mapper';
import { DesactivarEventoRequest } from '../../../../interfaces/dtos/request/evento/desactivar-evento.request';

@Injectable()
export class DesactivarEventoUsecase {
    constructor(
        @Inject(ConstantsService.EVENTO_SERVICE)
        private readonly eventoService: EventoService,
    ) {
    }

    async execute(desactivarEventoRequest: DesactivarEventoRequest): Promise<EventoResponse> {
        const evento = await this.eventoService.deactivate(desactivarEventoRequest);
        return await EventoMapper.toResponse(evento);
    }
}