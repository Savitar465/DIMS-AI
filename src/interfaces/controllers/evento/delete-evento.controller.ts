import { Body, Controller, Param, Delete } from '@nestjs/common';
import { CommandBus } from "@nestjs/cqrs";
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Sala } from '../../../core/domain/models/sala';
import { DesactivarEventoRequest } from '../../dtos/request/evento/desactivar-evento.request';
import { DesactivarEventoCommand } from '../../../core/application/commands/evento/desactivar-evento.command';

@ApiTags('eventos')
@Controller('v1/eventos')
export class DeleteEventoController {
  constructor(
    private commandBus: CommandBus
  ) {}

  @Delete(':id')
  @ApiOkResponse({
    description: "Evento desactivado con éxito.",
    type: Sala
  })
  async run(@Param('id') id: string, @Body() body: DesactivarEventoRequest) {
    return this.commandBus.execute(
      new DesactivarEventoCommand({
        id: id,
        usuAudit: body.usuAudit
      })
    );
  }
}