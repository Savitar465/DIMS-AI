import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from "@nestjs/cqrs";
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FindSalaQuery } from 'src/core/application/query/sala/find-sala.query';
import { Sala } from 'src/core/domain/models/sala';

export interface Query {
    id: string
}
@ApiTags('salas')
@Controller('v1/salas')
export class GetSalaController {
    constructor(private queryBus: QueryBus) { }

    @Get()
    @ApiQuery({
        name: 'id',
        type: String,
        description: 'ID de la sala a buscar',
        required: true,
    })
    @ApiOkResponse({
        description: 'La sala fue encontrada',
        type: Sala,
      })
    async run(@Query() query: Query) {
        console.log(query.id);
        console.log(await this.queryBus.execute(
            new FindSalaQuery(query.id)
        ));
        return await this.queryBus.execute(
            new FindSalaQuery(query.id)
        );
    }
}