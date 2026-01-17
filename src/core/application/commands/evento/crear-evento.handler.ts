import {CommandHandler, ICommandHandler} from "@nestjs/cqrs";
import {CrearEventoCommand} from "./crear-evento.command";
import {CrearEventoUsecase} from "../../usecases/evento/crear-evento.usecase";
import { Cambio, Mensaje } from '../../../domain/models/evento';
import { EventoResponse } from '../../../../interfaces/dtos/response/evento.response';

@CommandHandler(CrearEventoCommand)
export class CrearEventoHandler implements ICommandHandler<CrearEventoCommand<Mensaje|Cambio>> {

    constructor(private readonly crearEventoUseCase: CrearEventoUsecase) {
    }

    async execute(command: CrearEventoCommand<Mensaje|Cambio>): Promise<EventoResponse> {
        return await this.crearEventoUseCase.execute(
            command.crearEventoRequest
        );
    }
}