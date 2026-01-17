import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindSalaSearch } from './find-sala-search.query';
import { FindSalaCrieriaUsecase } from '../../usecases/sala/find-sala-crieria.usecase';

@QueryHandler(FindSalaSearch)
export class FindSalaSearchQueryHandler implements IQueryHandler<FindSalaSearch> {

  constructor(
    private readonly findSalaCrieriaUsecase: FindSalaCrieriaUsecase,
  ) {}

  async execute(query: FindSalaSearch) {
    return await this.findSalaCrieriaUsecase.ask(query);
  }
}
