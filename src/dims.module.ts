import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SUBPARTIDA_REPOSITORY } from 'src/core/domain/ports/outbound/subpartida.repository';
import { FACTURA_REPOSITORY } from 'src/core/domain/ports/outbound/factura.repository';
import { DIMS_REPOSITORY } from 'src/core/domain/ports/outbound/dims.repository';
import { AI_SERVICE } from 'src/core/domain/ports/outbound/ai.service';

import { SubpartidaEntity } from 'src/infraestructure/persistance/entities/subpartida.entity';
import { FacturaEntity } from 'src/infraestructure/persistance/entities/factura.entity';
import { DimsEntity } from 'src/infraestructure/persistance/entities/dims.entity';

import { TypeOrmSubpartidaRepository } from 'src/infraestructure/persistance/repositories/typeorm-subpartida.repository';
import { TypeOrmFacturaRepository } from 'src/infraestructure/persistance/repositories/typeorm-factura.repository';
import { TypeOrmDimsRepository } from 'src/infraestructure/persistance/repositories/typeorm-dims.repository';
import { LangChainAIService } from 'src/infraestructure/adapters/domain/langchain-ai.service';

import { UploadFacturaUseCase } from 'src/core/application/usecases/facturas/upload-factura.usecase';
import { GetFacturaUseCase } from 'src/core/application/usecases/facturas/get-factura.usecase';
import { UpdateFacturaUseCase } from 'src/core/application/usecases/facturas/update-factura.usecase';
import { UpdateFacturaItemUseCase } from 'src/core/application/usecases/facturas/update-factura-item.usecase';

import { ListDimsUseCase } from 'src/core/application/usecases/dims/list-dims.usecase';
import { CreateDimsUseCase } from 'src/core/application/usecases/dims/create-dims.usecase';
import { GetDimsUseCase } from 'src/core/application/usecases/dims/get-dims.usecase';
import { UpdateDimsUseCase } from 'src/core/application/usecases/dims/update-dims.usecase';
import { DeleteDimsUseCase } from 'src/core/application/usecases/dims/delete-dims.usecase';
import { GenerateDimsUseCase } from 'src/core/application/usecases/dims/generate-dims.usecase';
import { ValidateDimsUseCase } from 'src/core/application/usecases/dims/validate-dims.usecase';
import { ExportDimsUseCase } from 'src/core/application/usecases/dims/export-dims.usecase';
import { EmailDimsUseCase } from 'src/core/application/usecases/dims/email-dims.usecase';
import { SubmitDimsUseCase } from 'src/core/application/usecases/dims/submit-dims.usecase';

import { ListLineasUseCase } from 'src/core/application/usecases/arancel/list-lineas.usecase';
import { SearchSubpartidasUseCase } from 'src/core/application/usecases/arancel/search-subpartidas.usecase';
import { GetSubpartidaUseCase } from 'src/core/application/usecases/arancel/get-subpartida.usecase';

import { GetFlujoUseCase } from 'src/core/application/usecases/flujo/get-flujo.usecase';

import { FacturasController } from 'src/interfaces/controllers/facturas/facturas.controller';
import { DimsController } from 'src/interfaces/controllers/dims/dims.controller';
import { ArancelController } from 'src/interfaces/controllers/arancel/arancel.controller';
import { FlujoController } from 'src/interfaces/controllers/flujo/flujo.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SubpartidaEntity, FacturaEntity, DimsEntity]),
  ],
  controllers: [
    FacturasController,
    DimsController,
    ArancelController,
    FlujoController,
  ],
  providers: [
    // Facturas
    UploadFacturaUseCase,
    GetFacturaUseCase,
    UpdateFacturaUseCase,
    UpdateFacturaItemUseCase,
    // DIMS
    ListDimsUseCase,
    CreateDimsUseCase,
    GetDimsUseCase,
    UpdateDimsUseCase,
    DeleteDimsUseCase,
    GenerateDimsUseCase,
    ValidateDimsUseCase,
    ExportDimsUseCase,
    EmailDimsUseCase,
    SubmitDimsUseCase,
    // Arancel
    ListLineasUseCase,
    SearchSubpartidasUseCase,
    GetSubpartidaUseCase,
    // Flujo
    GetFlujoUseCase,
    // Adapters
    {
      provide: SUBPARTIDA_REPOSITORY,
      useClass: TypeOrmSubpartidaRepository,
    },
    {
      provide: FACTURA_REPOSITORY,
      useClass: TypeOrmFacturaRepository,
    },
    {
      provide: DIMS_REPOSITORY,
      useClass: TypeOrmDimsRepository,
    },
    {
      provide: AI_SERVICE,
      useClass: LangChainAIService,
    },
  ],
})
export class DimsModule {}
