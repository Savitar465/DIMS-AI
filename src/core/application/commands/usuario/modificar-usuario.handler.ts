import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { UsuarioResponse } from '../../../../interfaces/dtos/response/usuario.response';
import { ModificarUsuarioCommand } from './modificar-usuario.command';
import { ModificarUsuarioUsecase } from '../../usecases/usuario/modificar-usuario.usecase';

@CommandHandler(ModificarUsuarioCommand)
export class ModificarUsuarioHandler implements ICommandHandler<ModificarUsuarioCommand, UsuarioResponse> {

    constructor(private modificarUsuarioUseCase: ModificarUsuarioUsecase) {
    }

    async execute(command: ModificarUsuarioCommand): Promise<UsuarioResponse> {
        return await this.modificarUsuarioUseCase.execute(
          command.modificarUsuarioRequest
        );
    }
}