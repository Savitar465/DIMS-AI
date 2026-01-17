import { Body, Controller, Put, Param } from '@nestjs/common';
import { CommandBus } from "@nestjs/cqrs";
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ModificarSalaRequest } from '../../dtos/request/sala/modificar-sala.request';
import { ModificarSalaCommand } from '../../../core/application/commands/sala/modificar-sala.command';
import { Sala } from '../../../core/domain/models/sala';

@ApiTags('salas')
@Controller('v1/salas')
export class PutSalaController {
  constructor(
    private commandBus: CommandBus
  ) {}

  @Put(':id')
  @ApiOkResponse({
    description: "Sala modificado con éxito.",
    type: Sala
  })
  async run(@Param('id') id: string, @Body() body: ModificarSalaRequest) {
    return this.commandBus.execute(
      new ModificarSalaCommand({
        id: id,
        usuarios: body.usuarios,
        usuAudit: body.usuAudit
      })
    );
  }
}