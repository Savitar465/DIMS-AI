import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

import { FindEventoQuery } from '../../../core/application/query/evento/find-evento.query';

export interface Query {
  id: string;
}

@ApiTags('eventos')
@ApiBearerAuth()
@Controller('v1/eventos')
export class GetEventoController {

  constructor(
    private queryBus: QueryBus,
  ) {
  }

  @Get()
  @ApiQuery({
    name: 'id',
    description: 'ID of the item',
    type: String,
    required: true,
  })
  async run(@Query() query: Query) {
    return await this.queryBus.execute(
      new FindEventoQuery(query.id),
    );
  }
}