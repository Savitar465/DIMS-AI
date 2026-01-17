import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindEventoSearch } from './find-evento-search.query';
import { FindEventoCrieriaUsecase } from '../../usecases/evento/find-evento-crieria.usecase';

@QueryHandler(FindEventoSearch)
export class FindEventoSearchQueryHandler implements IQueryHandler<FindEventoSearch> {

  constructor(
    private readonly findEventoCrieriaUsecase: FindEventoCrieriaUsecase,
  ) {}

  async execute(query: FindEventoSearch) {
    return await this.findEventoCrieriaUsecase.ask(query);
  }
}
