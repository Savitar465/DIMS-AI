import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CrearSalaCommand } from "./crear-sala.command";
import { CrearSalaUsecase } from "../../usecases/sala/crear-sala.usecase";
import { SalaResponse } from '../../../../interfaces/dtos/response/sala.response';

@CommandHandler(CrearSalaCommand)
export class CrearSalaHandler implements ICommandHandler<CrearSalaCommand> {

    constructor(private crearSalaUseCase: CrearSalaUsecase) {
    }

    async execute(command: CrearSalaCommand): Promise<SalaResponse> {
        return await this.crearSalaUseCase.execute(
            command.crearSalaRequest
        );
    }
}