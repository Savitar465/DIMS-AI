import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { FindSalaQuery } from '../../query/sala/find-sala.query';
import { SalaService } from 'src/core/domain/services/sala.service';
import { SalaMapper } from '../../../../interfaces/shared/mapper/sala.mapper';
import { UsuarioService } from '../../../domain/services/usuario.service';
import { FilterRule } from '../../../../infraestructure/shared/criteria/filter-params';
import { UsuarioEnum } from '../../../../infraestructure/persistance/metamodel/usuario-meta-model';

@Injectable()
export class FindSalaUsecase {
  constructor(
    @Inject(ConstantsService.SALA_SERVICE)
    private readonly salaService: SalaService,
    @Inject(ConstantsService.USUARIO_SERVICE)
    private readonly usuarioService: UsuarioService,
  ) {
  }

  async ask(query: FindSalaQuery) {
    const sala = await this.salaService.findById(query);
    const usuarios = await this.usuarioService
      .search({
        criteria: {
          filter: {
            property: UsuarioEnum.ID,
            rule: FilterRule.IN,
            value: sala.usuarios.join(','),
          },
        },
      })
    return await SalaMapper.toResponse(sala, usuarios.items);
  }
}