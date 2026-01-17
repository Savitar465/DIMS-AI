import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from "@nestjs/cqrs";
import { CrearUsuarioRequest } from 'src/interfaces/dtos/request/usuario/crear-usuario.request';
import { CrearUsuarioCommand } from 'src/core/application/commands/usuario/crear-usuario.command';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Usuario } from 'src/core/domain/models/usuario';

@ApiTags('usuarios')
@Controller('v1/usuarios')
export class PostUsuarioController {
    constructor(
        private commandBus: CommandBus
    ) {
    }

    @Post()
    @ApiCreatedResponse({
        description: "Usuario creado con éxito.",
        type: Usuario
    })
    async run(@Body() body: CrearUsuarioRequest) {
        return this.commandBus.execute(
            new CrearUsuarioCommand({
                username: body.username,
                email: body.email,
                password: body.password,
                usuAudit: body.usuAudit
            })
        );
    }
}
