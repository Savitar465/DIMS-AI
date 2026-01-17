import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from "@nestjs/cqrs";
import { CrearSalaRequest } from 'src/interfaces/dtos/request/sala/crear-sala.request';
import { CrearSalaCommand } from 'src/core/application/commands/sala/crear-sala.command';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { Sala } from 'src/core/domain/models/sala';

@ApiTags('salas')
@Controller('v1/salas')
export class PostSalaController {
    constructor(
        private commandBus: CommandBus
    ) {}

    @Post()
    @ApiCreatedResponse({
        description: "Sala creada con éxito.",
        type: Sala
    })
    async run(@Body() body: CrearSalaRequest) {
        return this.commandBus.execute(
            new CrearSalaCommand({
                usuarios: body.usuarios,
                usuAudit: body.usuAudit
            })
        );
    }
}
