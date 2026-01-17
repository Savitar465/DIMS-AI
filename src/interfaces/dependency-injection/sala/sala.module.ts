import { Module, Provider } from '@nestjs/common';
import { ConstantsRepository } from '../constants/constants';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaService } from 'src/core/domain/services/sala.service';
import { SalaRepository } from 'src/core/domain/ports/outbound/sala.repository';
import { OrmSalaRepository } from 'src/infraestructure/adapters/domain/orm-sala.repository';
import { CrearSalaUsecase } from 'src/core/application/usecases/sala/crear-sala.usecase';
import { FindSalaUsecase } from 'src/core/application/usecases/sala/find-sala.usecase';
import { CrearSalaHandler } from 'src/core/application/commands/sala/crear-sala.handler';
import { SalaCreadoHandler } from 'src/core/application/events/sala/sala-creado.handler';
import { SalaEntity } from 'src/infraestructure/persistance/entities/sala.entity';
import { PostSalaController } from 'src/interfaces/controllers/sala/post-sala.controller';
import { GetSalaController } from 'src/interfaces/controllers/sala/get-sala.controller';
import { FindSalaQueryHandler } from 'src/core/application/query/sala/find-sala.handler';
import { UsuarioModule } from '../usuario/usuario.module';
import { UsuarioService } from '../../../core/domain/services/usuario.service';
import { ModificarSalaUsecase } from '../../../core/application/usecases/sala/modificar-sala.usecase';
import { ModificarSalaHandler } from '../../../core/application/commands/sala/modificar-sala.handler';
import { PutSalaController } from '../../controllers/sala/put-sala.controller';
import { SalaModificadoHandler } from '../../../core/application/events/sala/sala-modificado.handler';
import { DesactivarSalaUsecase } from '../../../core/application/usecases/sala/desactivar-sala.usecase';
import { DesactivarSalaHandler } from '../../../core/application/commands/sala/desactivar-sala.handler';
import { DeleteSalaController } from '../../controllers/sala/delete-sala.controller';
import { FindSalaSearchQueryHandler } from '../../../core/application/query/sala/find-sala-search.handler';
import { FindSalaCrieriaUsecase } from '../../../core/application/usecases/sala/find-sala-crieria.usecase';
import { GetSalaSearchController } from '../../controllers/sala/get-sala-search.controller';

const repositoryFactory: Provider<SalaRepository> = {
  provide: ConstantsRepository.SALA_REPOSITORY,
  useClass: OrmSalaRepository,
};

const serviceProviders = [SalaService];

const useCaseProviders = [
  {
    provide: CrearSalaUsecase,
    useFactory: (salaS: SalaService) =>
      new CrearSalaUsecase(salaS),
    inject: [SalaService],
  },
  {
    provide: FindSalaUsecase,
    useFactory: (salaS: SalaService, usuarioS: UsuarioService) => new FindSalaUsecase(salaS, usuarioS),
    inject: [SalaService,UsuarioService],
  },
  {
    provide: FindSalaCrieriaUsecase,
    useFactory: (salaS: SalaService) => new FindSalaCrieriaUsecase(salaS),
    inject: [SalaService],
  },
  {
    provide: ModificarSalaUsecase,
    useFactory: (salaS: SalaService) => new ModificarSalaUsecase(salaS),
    inject: [SalaService],
  },
  {
    provide: DesactivarSalaUsecase,
    useFactory: (salaS: SalaService) =>
      new DesactivarSalaUsecase(salaS),
    inject: [SalaService],
  },
];
const handlerProviders = [
  CrearSalaHandler,
  FindSalaQueryHandler,
  FindSalaSearchQueryHandler,
  ModificarSalaHandler,
  DesactivarSalaHandler
];
export const EventHandlers = [SalaCreadoHandler, SalaModificadoHandler];

@Module({
  imports: [UsuarioModule, TypeOrmModule.forFeature([SalaEntity])],
  providers: [
    repositoryFactory,
    ...serviceProviders,
    ...handlerProviders,
    ...useCaseProviders,
    ...EventHandlers,
  ],
  controllers: [PostSalaController, GetSalaController, GetSalaSearchController, PutSalaController, DeleteSalaController],
  exports: [SalaService, TypeOrmModule, repositoryFactory],
})
export class SalaModule {}
