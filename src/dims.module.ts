import { Module } from '@nestjs/common';
import { SUBPARTIDA_REPOSITORY } from 'src/core/domain/ports/outbound/subpartida.repository';
import { MockSubpartidaRepository } from 'src/infraestructure/adapters/domain/mock-subpartida.repository';
import { AI_SERVICE } from 'src/core/domain/ports/outbound/ai.service';
import { LangChainAIService } from 'src/infraestructure/adapters/domain/langchain-ai.service';
import { BuscarSubpartidasUseCase } from 'src/core/application/usecases/dims/buscar-subpartidas.usecase';
import { BuscarSubpartidasDesdePdfUseCase } from 'src/core/application/usecases/dims/buscar-subpartidas-desde-pdf.usecase';
import { DigitalizarFacturaUseCase } from 'src/core/application/usecases/dims/digitalizar-factura.usecase';
import { DimsController } from 'src/interfaces/controllers/dims/dims.controller';

@Module({
  controllers: [DimsController],
  providers: [
    BuscarSubpartidasUseCase,
    BuscarSubpartidasDesdePdfUseCase,
    DigitalizarFacturaUseCase,
    {
      provide: SUBPARTIDA_REPOSITORY,
      useClass: MockSubpartidaRepository,
    },
    {
      provide: AI_SERVICE,
      useClass: LangChainAIService,
    },
  ],
  exports: [BuscarSubpartidasUseCase, BuscarSubpartidasDesdePdfUseCase, DigitalizarFacturaUseCase],
})
export class DimsModule {}
