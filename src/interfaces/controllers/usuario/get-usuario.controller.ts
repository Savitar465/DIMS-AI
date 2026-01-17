import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FindUsuarioQuery } from 'src/core/application/query/usuario/find-usuario.query';
import { Usuario } from 'src/core/domain/models/usuario';

export interface Query {
    id: string
}
@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('v1/usuarios')
export class GetUsuarioController {
    constructor(private queryBus: QueryBus) { }

    @Get()
    @ApiQuery({
        name: 'id',
        type: String,
        description: 'ID del usuario a buscar',
        required: true,
    })
    @ApiOkResponse({
        description: 'El usuario fue encontrado',
        type: Usuario,
      })
    async run(@Query() query: Query) {
        return await this.queryBus.execute(
            new FindUsuarioQuery(query.id)
        );
    }
}