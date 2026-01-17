import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { FindUsuarioQuery } from "./find-usuario.query";
import { FindUsuarioUsecase } from "../../usecases/usuario/find-usuario.usecase";

@QueryHandler(FindUsuarioQuery)
export class FindUsuarioQueryHandler implements IQueryHandler<FindUsuarioQuery> {

    constructor(
        private readonly findUsuarioUsecase: FindUsuarioUsecase
    ) {
    }
    async execute(query: FindUsuarioQuery) {
        return await this.findUsuarioUsecase.ask(query);
    }
}