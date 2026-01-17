import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { EventoResponse } from '../../../../interfaces/dtos/response/evento.response';
import { DesactivarEventoCommand } from './desactivar-evento.command';
import { DesactivarEventoUsecase } from '../../usecases/evento/desactivar-evento.usecase';

@CommandHandler(DesactivarEventoCommand)
export class DesactivarEventoHandler implements ICommandHandler<DesactivarEventoCommand, EventoResponse> {

    constructor(private desactivarEventoUsecase: DesactivarEventoUsecase) {
    }

    async execute(command: DesactivarEventoCommand): Promise<EventoResponse> {
        return await this.desactivarEventoUsecase.execute(
          command.desactivarEventoRequest
        );
    }
}