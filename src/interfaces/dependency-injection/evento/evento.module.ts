import { Module, Provider } from '@nestjs/common';
import { PostEventoController } from '../../controllers/evento/post-evento.controller';
import { GetEventoController } from '../../controllers/evento/get-evento.controller';
import { EventoRepository } from '../../../core/domain/ports/outbound/evento.repository';
import { CrearEventoHandler } from '../../../core/application/commands/evento/crear-evento.handler';
import { CrearEventoUsecase } from '../../../core/application/usecases/evento/crear-evento.usecase';
import { ConstantsRepository } from '../constants/constants';
import { OrmEventoRepository } from '../../../infraestructure/adapters/domain/orm-evento.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoEntity } from '../../../infraestructure/persistance/entities/evento.entity';
import { EventoService } from '../../../core/domain/services/evento.service';
import { EventoCreadoHandler } from '../../../core/application/events/evento/evento-creado.handler';
import { FindEventoUsecase } from '../../../core/application/usecases/evento/find-evento.usecase';
import { FindEventoQueryHandler } from '../../../core/application/query/evento/find-evento.handler';
import { UsuarioService } from '../../../core/domain/services/usuario.service';
import { SalaService } from '../../../core/domain/services/sala.service';
import { UsuarioModule } from '../usuario/usuario.module';
import { SalaModule } from '../sala/sala.module';
import { SaveEventoGateway } from '../../gateways/eventos/save-evento.gateway';
import { PutEventoController } from '../../controllers/evento/put-evento.controller';
import { EventoModificadoHandler } from '../../../core/application/events/evento/evento-modificado.handler';
import { ModificarEventoHandler } from '../../../core/application/commands/evento/modificar-evento.handler';
import { ModificarEventoUsecase } from '../../../core/application/usecases/evento/modificar-evento.usecase';
import { DeleteEventoController } from '../../controllers/evento/delete-evento.controller';
import { DesactivarEventoHandler } from '../../../core/application/commands/evento/desactivar-evento.handler';
import { DesactivarEventoUsecase } from '../../../core/application/usecases/evento/desactivar-evento.usecase';
import { FindEventoSearchQueryHandler } from '../../../core/application/query/evento/find-evento-search.handler';
import { FindEventoCrieriaUsecase } from '../../../core/application/usecases/evento/find-evento-crieria.usecase';
import { GetEventoSearchController } from '../../controllers/evento/get-evento-search.controller';

const repositoryFactory: Provider<EventoRepository> = {
  provide: ConstantsRepository.EVENTO_REPOSITORY,
  useClass: OrmEventoRepository,
};

const serviceProviders = [EventoService];

const useCaseProviders = [
  {
    provide: CrearEventoUsecase,
    useFactory: (
      eventoS: EventoService
    ) => new CrearEventoUsecase(eventoS),
    inject: [EventoService],
  },
  {
    provide: FindEventoUsecase,
    useFactory: (
      eventoS: EventoService,
      usuarioS: UsuarioService,
      salaS: SalaService
    ) => new FindEventoUsecase(eventoS, usuarioS, salaS),
    inject: [EventoService,UsuarioService, SalaService],
  },
  {
    provide: FindEventoCrieriaUsecase,
    useFactory: (
      eventoS: EventoService
    ) => new FindEventoCrieriaUsecase(eventoS),
    inject: [EventoService],
  },
  {
    provide: ModificarEventoUsecase,
    useFactory: (
      eventoS: EventoService
    ) => new ModificarEventoUsecase(eventoS),
    inject: [EventoService],
  },
  {
    provide: DesactivarEventoUsecase,
    useFactory: (
      eventoS: EventoService,
    ) => new DesactivarEventoUsecase(eventoS),
    inject: [EventoService],
  }
];
const handlerProviders = [
  CrearEventoHandler,
  FindEventoQueryHandler,
  FindEventoSearchQueryHandler,
  ModificarEventoHandler,
  DesactivarEventoHandler
];
export const EventHandlers = [EventoCreadoHandler, EventoModificadoHandler];

@Module({
  imports: [
    UsuarioModule,
    SalaModule,
    TypeOrmModule.forFeature([EventoEntity]),
  ],
  providers: [
    repositoryFactory,
    ...serviceProviders,
    ...handlerProviders,
    ...useCaseProviders,
    ...EventHandlers,
    SaveEventoGateway,
  ],
  controllers: [PostEventoController, GetEventoController, GetEventoSearchController, PutEventoController, DeleteEventoController],
  exports: [EventoService, TypeOrmModule, repositoryFactory],
})
export class EventoModule {}
