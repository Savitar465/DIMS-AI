import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SUBPARTIDA_REPOSITORY } from 'src/core/domain/ports/outbound/subpartida.repository';
import { FACTURA_REPOSITORY } from 'src/core/domain/ports/outbound/factura.repository';
import { DIMS_REPOSITORY } from 'src/core/domain/ports/outbound/dims.repository';
import { AI_SERVICE } from 'src/core/domain/ports/outbound/ai.service';
import { CLASIFICACION_CACHE_REPOSITORY } from 'src/core/domain/ports/outbound/clasificacion-cache.repository';
import { CLASIFICACION_APRENDIDA_REPOSITORY } from 'src/core/domain/ports/outbound/clasificacion-aprendida.repository';
import { EMBEDDING_SERVICE } from 'src/core/domain/ports/outbound/embedding.service';
import { BUSQUEDA_SEMANTICA_REPOSITORY } from 'src/core/domain/ports/outbound/busqueda-semantica.repository';
import { GeminiEmbeddingService } from 'src/infraestructure/adapters/domain/gemini-embedding.service';
import { PgVectorBusquedaSemanticaRepository } from 'src/infraestructure/persistance/repositories/pgvector-busqueda-semantica.repository';
import { BusquedaHibridaService } from 'src/core/application/services/busqueda-hibrida.service';

import { FacturaEntity } from 'src/infraestructure/persistance/entities/factura.entity';
import { DimsEntity } from 'src/infraestructure/persistance/entities/dims.entity';
import { ClasificacionCacheEntity } from 'src/infraestructure/persistance/entities/clasificacion-cache.entity';
import { ClasificacionAprendidaEntity } from 'src/infraestructure/persistance/entities/clasificacion-aprendida.entity';

import { PgArancelSubpartidaRepository } from 'src/infraestructure/persistance/repositories/pg-arancel-subpartida.repository';
import {
  ArancelDataSourceCloser,
  arancelDataSourceProvider,
} from 'src/infraestructure/persistance/arancel.datasource';
import { TypeOrmFacturaRepository } from 'src/infraestructure/persistance/repositories/typeorm-factura.repository';
import { TypeOrmDimsRepository } from 'src/infraestructure/persistance/repositories/typeorm-dims.repository';
import { TypeOrmClasificacionCacheRepository } from 'src/infraestructure/persistance/repositories/typeorm-clasificacion-cache.repository';
import { TypeOrmClasificacionAprendidaRepository } from 'src/infraestructure/persistance/repositories/typeorm-clasificacion-aprendida.repository';
import { LangChainAIService } from 'src/infraestructure/adapters/domain/langchain-ai.service';

import { UploadFacturaUseCase } from 'src/core/application/usecases/facturas/upload-factura.usecase';
import { GetFacturaUseCase } from 'src/core/application/usecases/facturas/get-factura.usecase';
import { GetFacturaDocumentoUseCase } from 'src/core/application/usecases/facturas/get-factura-documento.usecase';
import { UpdateFacturaUseCase } from 'src/core/application/usecases/facturas/update-factura.usecase';
import { UpdateFacturaItemUseCase } from 'src/core/application/usecases/facturas/update-factura-item.usecase';
import { ClasificarSubpartidasUseCase } from 'src/core/application/usecases/facturas/clasificar-subpartidas.usecase';
import { AddFacturaItemUseCase } from 'src/core/application/usecases/facturas/add-factura-item.usecase';

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
    TypeOrmModule.forFeature([
      FacturaEntity,
      DimsEntity,
      ClasificacionCacheEntity,
      ClasificacionAprendidaEntity,
    ]),
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
    GetFacturaDocumentoUseCase,
    UpdateFacturaUseCase,
    UpdateFacturaItemUseCase,
    ClasificarSubpartidasUseCase,
    AddFacturaItemUseCase,
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
    // Búsqueda híbrida (léxica + semántica)
    BusquedaHibridaService,
    {
      provide: EMBEDDING_SERVICE,
      useClass: GeminiEmbeddingService,
    },
    {
      provide: BUSQUEDA_SEMANTICA_REPOSITORY,
      useClass: PgVectorBusquedaSemanticaRepository,
    },
    // Adapters
    arancelDataSourceProvider,
    ArancelDataSourceCloser,
    {
      provide: SUBPARTIDA_REPOSITORY,
      useClass: PgArancelSubpartidaRepository,
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
    {
      provide: CLASIFICACION_CACHE_REPOSITORY,
      useClass: TypeOrmClasificacionCacheRepository,
    },
    {
      provide: CLASIFICACION_APRENDIDA_REPOSITORY,
      useClass: TypeOrmClasificacionAprendidaRepository,
    },
  ],
})
export class DimsModule {}
