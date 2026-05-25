import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GetFlujoUseCase } from '../../../core/application/usecases/flujo/get-flujo.usecase';

@ApiTags('Flujo')
@Controller('flujo')
export class FlujoController {
  constructor(private readonly getFlujoUseCase: GetFlujoUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Obtener pasos del flujo y borradores' })
  async getFlujo() {
    return this.getFlujoUseCase.execute();
  }
}
