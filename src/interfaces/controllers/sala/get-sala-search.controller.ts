import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger/dist/decorators/api-use-tags.decorator';
import { QueryBus } from '@nestjs/cqrs/dist/query-bus';
import { CriteriaQuery, setPagination } from '../../../infraestructure/shared/criteria/type-orm.helper';
import { ApiQuery } from '@nestjs/swagger/dist/decorators/api-query.decorator';
import { ApiOkResponse } from '@nestjs/swagger/dist/decorators/api-response.decorator';
import { FindSalaSearch } from '../../../core/application/query/sala/find-sala-search.query';
import { Sala } from '../../../core/domain/models/sala';

export interface QueryDto {
  criteria: string;
}

@ApiTags('salas')
@Controller('v1/salas')
export class GetSalaSearchController {
  constructor(
    private readonly queryBus: QueryBus,
  ) {}

  @Get('search')
  @ApiQuery({
    name: 'criteria',
    type: CriteriaQuery,
    description: 'Busqueda con parametros de filtrado(opcional), paginacion(opcional),orden(opcional)',
    required: true,
  })
  @ApiOkResponse({
    description: 'Salas encontradas',
    type: [Sala as any],
  })
  async run(@Query() query: QueryDto) {
    const criteria: CriteriaQuery = JSON.parse(query.criteria);
    try {
      if (criteria.pagination) setPagination(criteria.pagination);
      return await this.queryBus.execute(
        new FindSalaSearch(criteria),
      );
    } catch (e) {
      console.log(e);
    }
  }
}
