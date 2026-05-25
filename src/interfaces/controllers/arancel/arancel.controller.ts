import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ListLineasUseCase } from '../../../core/application/usecases/arancel/list-lineas.usecase';
import { SearchSubpartidasUseCase } from '../../../core/application/usecases/arancel/search-subpartidas.usecase';
import { GetSubpartidaUseCase } from '../../../core/application/usecases/arancel/get-subpartida.usecase';

@ApiTags('Arancel')
@Controller('arancel')
export class ArancelController {
  constructor(
    private readonly listLineasUseCase: ListLineasUseCase,
    private readonly searchSubpartidasUseCase: SearchSubpartidasUseCase,
    private readonly getSubpartidaUseCase: GetSubpartidaUseCase,
  ) {}

  @Get('lineas')
  @ApiOperation({ summary: 'Listar líneas del Arancel' })
  listLineas() {
    return this.listLineasUseCase.execute();
  }

  @Get('subpartidas')
  @ApiOperation({ summary: 'Buscar subpartidas del Arancel' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'linea', required: false })
  async searchSubpartidas(
    @Query('q') q?: string,
    @Query('linea') linea?: string,
  ) {
    return this.searchSubpartidasUseCase.execute(q, linea);
  }

  @Get('subpartidas/:code')
  @ApiOperation({ summary: 'Obtener una subpartida' })
  async getSubpartida(@Param('code') code: string) {
    return this.getSubpartidaUseCase.execute(code);
  }
}
