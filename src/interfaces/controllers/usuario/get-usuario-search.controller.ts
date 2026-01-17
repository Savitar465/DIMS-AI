import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger/dist/decorators/api-use-tags.decorator';
import { QueryBus } from '@nestjs/cqrs/dist/query-bus';
import { CriteriaQuery, setPagination } from '../../../infraestructure/shared/criteria/type-orm.helper';
import { Usuario } from '../../../core/domain/models/usuario';
import { ApiQuery } from '@nestjs/swagger/dist/decorators/api-query.decorator';
import { ApiOkResponse } from '@nestjs/swagger/dist/decorators/api-response.decorator';
import { FindUsuarioSearch } from '../../../core/application/query/usuario/find-usuario-search.query';

export interface QueryDto {
  criteria: string;
}

@ApiTags('usuarios')
@Controller('v1/usuarios')
export class GetUsuarioSearchController {
  constructor(
    private readonly queryBus: QueryBus,
  ) {
  }

  @Get('search')
  @ApiQuery({
    name: 'criteria',
    type: CriteriaQuery,
    description: 'Busqueda con parametros de filtrado(opcional), paginacion(opcional),orden(opcional)',
    required: true,
  })
  @ApiOkResponse({
    description: 'El usuario fue encontrado',
    type: [Usuario],
  })
  async run(@Query() query: QueryDto) {
    const criteria: CriteriaQuery = JSON.parse(query.criteria);
    try {
      if (criteria.pagination) setPagination(criteria.pagination);
      return await this.queryBus.execute(
        new FindUsuarioSearch(criteria),
      );
    } catch (e) {
      console.log(e);
    }

  }
}
