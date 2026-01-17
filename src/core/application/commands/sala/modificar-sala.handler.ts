import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { ModificarSalaUsecase } from '../../usecases/sala/modificar-sala.usecase';
import { SalaResponse } from '../../../../interfaces/dtos/response/sala.response';
import { ModificarSalaCommand } from '../../commands/sala/modificar-sala.command';

@CommandHandler(ModificarSalaCommand)
export class ModificarSalaHandler implements ICommandHandler<ModificarSalaCommand, SalaResponse> {

    constructor(private modificarSalaUseCase: ModificarSalaUsecase) {
    }

    async execute(command: ModificarSalaCommand): Promise<SalaResponse> {
        return await this.modificarSalaUseCase.execute(
          command.modificarSalaRequest
        );
    }
}