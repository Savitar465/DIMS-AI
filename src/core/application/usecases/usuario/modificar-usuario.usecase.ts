import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from "../../../../interfaces/dependency-injection/constants/constants";
import { UsuarioService } from 'src/core/domain/services/usuario.service';
import { UsuarioMapper } from '../../../../interfaces/shared/mapper/usuario.mapper';
import { UsuarioResponse } from '../../../../interfaces/dtos/response/usuario.response';
import { ModificarUsuarioRequest } from '../../../../interfaces/dtos/request/usuario/modificar-usuario.request';

@Injectable()
export class ModificarUsuarioUsecase {
    constructor(
        @Inject(ConstantsService.USUARIO_SERVICE)
        private readonly usuarioService: UsuarioService
    ) {
    }

    async execute(modificarUsuarioRequest: ModificarUsuarioRequest): Promise<UsuarioResponse> {
        const usuario = await this.usuarioService.update(modificarUsuarioRequest);
        const usuarioResponse: UsuarioResponse = await UsuarioMapper.toResponse(usuario);
        return usuarioResponse;
    }
}