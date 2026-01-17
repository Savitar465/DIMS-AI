import { Body, Controller, Put, Param } from '@nestjs/common';
import { CommandBus } from "@nestjs/cqrs";
import { ModificarUsuarioRequest } from 'src/interfaces/dtos/request/usuario/modificar-usuario.request';
import { ModificarUsuarioCommand } from 'src/core/application/commands/usuario/modificar-usuario.command';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Usuario } from 'src/core/domain/models/usuario';

@ApiTags('usuarios')
@Controller('v1/usuarios')
export class PutUsuarioController {
  constructor(
    private commandBus: CommandBus
  ) {}

  @Put(':id')
  @ApiOkResponse({
    description: "Usuario modificado con éxito.",
    type: Usuario
  })
  async run(@Param('id') id: string, @Body() body: ModificarUsuarioRequest) {
    return this.commandBus.execute(
      new ModificarUsuarioCommand({
        id: id,
        username: body.username,
        email: body.email,
        password: body.password,
        usuAudit: body.usuAudit
      })
    );
  }
}