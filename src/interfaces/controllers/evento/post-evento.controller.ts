import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { CrearEventoRequest } from '../../dtos/request/evento/crear-evento.request';
import { CrearEventoCommand } from '../../../core/application/commands/evento/crear-evento.command';
import { ApiTags } from '@nestjs/swagger';
import { Cambio, Mensaje } from '../../../core/domain/models/evento';

@ApiTags('eventos')
@Controller('v1/eventos')
export class PostEventoController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async run(@Body() body: CrearEventoRequest<Mensaje|Cambio>) {
    return this.commandBus.execute(
      new CrearEventoCommand({
        usuario: body.usuario,
        data: body.data,
        tipo: body.tipo,
        sala: body.sala,
        usuariosMencionados: body.usuariosMencionados,
        usuAudit: body.usuAudit
      }),
    );
  }
}
