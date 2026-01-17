import { Inject, Injectable } from "@nestjs/common";
import { ConstantsService } from "../../../../interfaces/dependency-injection/constants/constants";
import { UsuarioService } from "src/core/domain/services/usuario.service";
import { FindUsuarioQuery } from "../../query/usuario/find-usuario.query";
import { UsuarioMapper } from '../../../../interfaces/shared/mapper/usuario.mapper';
import { UsuarioResponse } from '../../../../interfaces/dtos/response/usuario.response';

@Injectable()
export class FindUsuarioUsecase {
    constructor(
        @Inject(ConstantsService.USUARIO_SERVICE)
        private readonly usuarioService: UsuarioService
    ) {
    }

    async ask(query: FindUsuarioQuery): Promise<UsuarioResponse> {
        const usuario = await this.usuarioService.findById(query);
        const usuarioResponse = await UsuarioMapper.toResponse(usuario);
        return usuarioResponse;
    }
}