import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindUsuarioSearch } from './find-usuario-search.query';
import { FindUsuarioCrieriaUsecase } from '../../usecases/usuario/find-usuario-crieria.usecase';

@QueryHandler(FindUsuarioSearch)
export class FindUsuarioSearchQueryHandler implements IQueryHandler<FindUsuarioSearch> {

  constructor(
    private readonly findUsuarioCrieriaUsecase: FindUsuarioCrieriaUsecase,
  ) {
  }

  async execute(query: FindUsuarioSearch) {
    return await this.findUsuarioCrieriaUsecase.ask(query);
  }
}