import { Body, Controller, Param, Delete } from '@nestjs/common';
import { CommandBus } from "@nestjs/cqrs";
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario } from 'src/core/domain/models/usuario';
import { DesactivarUsuarioRequest } from '../../dtos/request/usuario/desactivar-usuario.request';
import { DesactivarUsuarioCommand } from '../../../core/application/commands/usuario/desactivar-usuario.command';

@ApiTags('usuarios')
@Controller('v1/usuarios')
export class DeleteUsuarioController {
  constructor(
    private commandBus: CommandBus
  ) {}

  @Delete(':id')
  @ApiOkResponse({
    description: "Usuario desactivado con éxito.",
    type: Usuario
  })
  async run(@Param('id') id: string, @Body() body: DesactivarUsuarioRequest) {
    return this.commandBus.execute(
      new DesactivarUsuarioCommand({
        id: id,
        usuAudit: body.usuAudit
      })
    );
  }
}