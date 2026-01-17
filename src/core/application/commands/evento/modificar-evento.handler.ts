import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { ModificarEventoCommand } from './modificar-evento.command';
import { ModificarEventoUsecase } from '../../usecases/evento/modificar-evento.usecase';
import { EventoResponse } from '../../../../interfaces/dtos/response/evento.response';

@CommandHandler(ModificarEventoCommand)
export class ModificarEventoHandler implements ICommandHandler<ModificarEventoCommand, EventoResponse> {

    constructor(private modificarEventoUsecase: ModificarEventoUsecase) {
    }

    async execute(command: ModificarEventoCommand): Promise<EventoResponse> {
        return await this.modificarEventoUsecase.execute(
          command.modificarEventoRequest
        );
    }
}