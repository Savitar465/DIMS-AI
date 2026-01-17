import { IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { FindSalaQuery } from "./find-sala.query";
import { FindSalaUsecase } from "../../usecases/sala/find-sala.usecase";

@QueryHandler(FindSalaQuery)
export class FindSalaQueryHandler implements IQueryHandler<FindSalaQuery> {

    constructor(
        private readonly findSalaUseCase: FindSalaUsecase
    ) {
    }
    async execute(query: FindSalaQuery) {
        return await this.findSalaUseCase.ask(query);
    }
}