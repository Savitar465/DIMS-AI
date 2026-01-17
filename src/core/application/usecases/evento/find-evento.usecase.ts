import { Inject, Injectable } from '@nestjs/common';
import { ConstantsService } from '../../../../interfaces/dependency-injection/constants/constants';
import { EventoService } from '../../../domain/services/evento.service';
import { FindEventoQuery } from '../../query/evento/find-evento.query';
import { EventoMapper } from '../../../../interfaces/shared/mapper/evento.mapper';
import { FindUsuarioQuery } from '../../query/usuario/find-usuario.query';
import { UsuarioService } from '../../../domain/services/usuario.service';
import { SalaService } from '../../../domain/services/sala.service';
import { FindSalaQuery } from '../../query/sala/find-sala.query';
import { UsuarioEnum } from '../../../../infraestructure/persistance/metamodel/usuario-meta-model';
import { FilterRule } from '../../../../infraestructure/shared/criteria/filter-params';

@Injectable()
export class FindEventoUsecase {
  constructor(
    @Inject(ConstantsService.EVENTO_SERVICE)
    private readonly eventoService: EventoService,
    @Inject(ConstantsService.USUARIO_SERVICE)
    private readonly usuarioService: UsuarioService,
    @Inject(ConstantsService.SALA_SERVICE)
    private readonly salaService: SalaService,
  ) {
  }

  async ask(query: FindEventoQuery) {
    const evento = await this.eventoService.findById(query);
    const usuario = await this.usuarioService.findById(new FindUsuarioQuery(evento.usuario));
    const usuariosMencionados = await this.usuarioService
      .search({
        criteria: {
          filter: {
            property: UsuarioEnum.ID,
            rule: FilterRule.IN,
            value: evento.usuariosMencionados.join(','),
          },
        },
      });
    const sala = await this.salaService.findById(new FindSalaQuery(evento.sala));
    return await EventoMapper.toResponse(evento, usuario, usuariosMencionados.items, sala);
  }
}