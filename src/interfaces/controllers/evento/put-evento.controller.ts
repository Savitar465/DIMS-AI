import { Body, Controller, Put, Param } from '@nestjs/common';
import { CommandBus } from "@nestjs/cqrs";
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Cambio, Evento, Mensaje } from '../../../core/domain/models/evento';
import { ModificarEventoRequest } from '../../dtos/request/evento/modificar-evento.request';
import { ModificarEventoCommand } from '../../../core/application/commands/evento/modificar-evento.command';

@ApiTags('eventos')
@Controller('v1/eventos')
export class PutEventoController {
  constructor(
    private commandBus: CommandBus
  ) {}

  @Put(':id')
  @ApiOkResponse({
    description: "Evento modificado con éxito.",
    type: Evento
  })
  async run(@Param('id') id: string, @Body() body: ModificarEventoRequest<Evento<Mensaje | Cambio>>) {
    return this.commandBus.execute(
      new ModificarEventoCommand({
        id: id,
        usuario: body.usuario,
        data: body.data,
        tipo: body.tipo,
        sala: body.sala,
        usuariosMencionados: body.usuariosMencionados,
        usuAudit: body.usuAudit
      })
    );
  }
}