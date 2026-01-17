import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { UsuarioService } from '../../../domain/services/usuario.service';
import { FindUsuarioSearch } from '../../query/usuario/find-usuario-search.query';
import { UsuarioMapper } from '../../../../interfaces/shared/mapper/usuario.mapper';

@Injectable()
export class FindUsuarioCrieriaUsecase {
  constructor(
    @Inject(ConstantsService.USUARIO_SERVICE)
    private readonly usuarioService: UsuarioService,
  ) {}

  async ask(query: FindUsuarioSearch) {
    const users = await this.usuarioService.search(query);
    const mappedItems = await Promise.all(
      users.items.map((usuario) => UsuarioMapper.toResponse(usuario)),
    );
    return { ...users, items: mappedItems };
  }
}
