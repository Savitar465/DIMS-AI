import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { EventoService } from '../../../domain/services/evento.service';
import { FindEventoSearch } from '../../query/evento/find-evento-search.query';
import { EventoMapper } from '../../../../interfaces/shared/mapper/evento.mapper';

@Injectable()
export class FindEventoCrieriaUsecase {
  constructor(
    @Inject(ConstantsService.EVENTO_SERVICE)
    private readonly eventoService: EventoService,
  ) {}

  async ask(query: FindEventoSearch) {
    const eventos = await this.eventoService.search(query);
    const mappedItems = await Promise.all(
      eventos.items.map((evento) => EventoMapper.toResponse(evento)),
    );
    return { ...eventos, items: mappedItems };
  }
}
