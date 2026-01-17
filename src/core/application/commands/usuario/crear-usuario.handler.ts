import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { CrearUsuarioCommand } from "./crear-usuario.command";
import { CrearUsuarioUsecase } from "../../usecases/usuario/crear-usuario.usecase";
import { UsuarioResponse } from '../../../../interfaces/dtos/response/usuario.response';

@CommandHandler(CrearUsuarioCommand)
export class CrearUsuarioHandler implements ICommandHandler<CrearUsuarioCommand> {

    constructor(private crearUsuarioUseCase: CrearUsuarioUsecase) {
    }

    async execute(command: CrearUsuarioCommand): Promise<UsuarioResponse> {
        return await this.crearUsuarioUseCase.execute(
            command.crearUsuarioRequest
        );
    }
}