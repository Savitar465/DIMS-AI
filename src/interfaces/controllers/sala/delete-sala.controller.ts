import { Body, Controller, Param, Delete } from '@nestjs/common';
import { CommandBus } from "@nestjs/cqrs";
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Sala } from '../../../core/domain/models/sala';
import { DesactivarSalaRequest } from '../../dtos/request/sala/desactivar-sala.request';
import { DesactivarSalaCommand } from '../../../core/application/commands/sala/desactivar-sala.command';

@ApiTags('salas')
@Controller('v1/salas')
export class DeleteSalaController {
  constructor(
    private commandBus: CommandBus
  ) {}

  @Delete(':id')
  @ApiOkResponse({
    description: "Sala desactivada con éxito.",
    type: Sala
  })
  async run(@Param('id') id: string, @Body() body: DesactivarSalaRequest) {
    return this.commandBus.execute(
      new DesactivarSalaCommand({
        id: id,
        usuAudit: body.usuAudit
      })
    );
  }
}