import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from "../../../../interfaces/dependency-injection/constants/constants";
import { UsuarioService } from 'src/core/domain/services/usuario.service';
import { Usuario } from 'src/core/domain/models/usuario';
import { CrearUsuarioRequest } from 'src/interfaces/dtos/request/usuario/crear-usuario.request';
import { UsuarioMapper } from '../../../../interfaces/shared/mapper/usuario.mapper';
import { UsuarioResponse } from '../../../../interfaces/dtos/response/usuario.response';

@Injectable()
export class CrearUsuarioUsecase {
    constructor(
        @Inject(ConstantsService.USUARIO_SERVICE)
        private readonly usuarioService: UsuarioService
    ) {
    }

    async execute(crearUsuarioRequest: CrearUsuarioRequest): Promise<UsuarioResponse> {
        const usuario: Usuario = await this.usuarioService.save(crearUsuarioRequest);
        const usuarioResponse: UsuarioResponse = await UsuarioMapper.toResponse(usuario);
        return usuarioResponse;
    }
}