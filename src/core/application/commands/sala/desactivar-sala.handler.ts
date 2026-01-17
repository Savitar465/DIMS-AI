import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { SalaResponse } from '../../../../interfaces/dtos/response/sala.response';
import { DesactivarSalaCommand } from './desactivar-sala.command';
import { DesactivarSalaUsecase } from '../../usecases/sala/desactivar-sala.usecase';

@CommandHandler(DesactivarSalaCommand)
export class DesactivarSalaHandler implements ICommandHandler<DesactivarSalaCommand, SalaResponse> {

    constructor(private desactivarSalaUsecase: DesactivarSalaUsecase) {
    }

    async execute(command: DesactivarSalaCommand): Promise<SalaResponse> {
        return await this.desactivarSalaUsecase.execute(
          command.desactivarSalaRequest
        );
    }
}