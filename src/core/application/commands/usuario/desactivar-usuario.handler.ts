import { CommandHandler, ICommandHandler } from "@nestjs/cqrs";
import { UsuarioResponse } from '../../../../interfaces/dtos/response/usuario.response';
import { DesactivarUsuarioCommand } from './desactivar-usuario.command';
import { DesactivarUsuarioUsecase } from '../../usecases/usuario/desactivar-usuario.usecase';

@CommandHandler(DesactivarUsuarioCommand)
export class DesactivarUsuarioHandler implements ICommandHandler<DesactivarUsuarioCommand, UsuarioResponse> {

    constructor(private desactivarUsuarioUsecase: DesactivarUsuarioUsecase) {
    }

    async execute(command: DesactivarUsuarioCommand): Promise<UsuarioResponse> {
        return await this.desactivarUsuarioUsecase.execute(
          command.desactivarUsuarioRequest
        );
    }
}