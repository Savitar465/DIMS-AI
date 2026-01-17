import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from "../../../../interfaces/dependency-injection/constants/constants";
import { UsuarioService } from 'src/core/domain/services/usuario.service';
import { UsuarioMapper } from '../../../../interfaces/shared/mapper/usuario.mapper';
import { UsuarioResponse } from '../../../../interfaces/dtos/response/usuario.response';
import { DesactivarUsuarioRequest } from '../../../../interfaces/dtos/request/usuario/desactivar-usuario.request';

@Injectable()
export class DesactivarUsuarioUsecase {
    constructor(
        @Inject(ConstantsService.USUARIO_SERVICE)
        private readonly usuarioService: UsuarioService
    ) {
    }

    async execute(desactivarUsuarioRequest: DesactivarUsuarioRequest): Promise<UsuarioResponse> {
        const usuario = await this.usuarioService.deactivate(desactivarUsuarioRequest);
        const usuarioResponse: UsuarioResponse = await UsuarioMapper.toResponse(usuario);
        return usuarioResponse;
    }
}