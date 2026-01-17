import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { SalaService } from '../../../domain/services/sala.service';
import { FindSalaSearch } from '../../query/sala/find-sala-search.query';
import { SalaMapper } from '../../../../interfaces/shared/mapper/sala.mapper';

@Injectable()
export class FindSalaCrieriaUsecase {
  constructor(
    @Inject(ConstantsService.SALA_SERVICE)
    private readonly salaService: SalaService,
  ) {}

  async ask(query: FindSalaSearch) {
    const salas = await this.salaService.search(query);
    const mappedItems = await Promise.all(
      salas.items.map((sala) => SalaMapper.toResponse(sala)),
    );
    return { ...salas, items: mappedItems };
  }
}
