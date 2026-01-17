import {IQueryHandler, QueryHandler} from "@nestjs/cqrs";
import {FindEventoQuery} from "./find-evento.query";
import {FindEventoUsecase} from "../../usecases/evento/find-evento.usecase";

@QueryHandler(FindEventoQuery)
export class FindEventoQueryHandler implements IQueryHandler<FindEventoQuery> {
    
    constructor(
        private readonly findEventoUsecase: FindEventoUsecase
    ) {
    }
    async execute(query: FindEventoQuery) {
        return await this.findEventoUsecase.ask(query);
    }

}