import { Module, Provider } from '@nestjs/common';
import { ConstantsRepository } from '../constants/constants';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsuarioService } from 'src/core/domain/services/usuario.service';
import { UsuarioRepository } from 'src/core/domain/ports/outbound/usuario.repository';
import { OrmUsuarioRepository } from 'src/infraestructure/adapters/domain/orm-usuario.repository';
import { CrearUsuarioUsecase } from 'src/core/application/usecases/usuario/crear-usuario.usecase';
import { FindUsuarioUsecase } from 'src/core/application/usecases/usuario/find-usuario.usecase';
import { CrearUsuarioHandler } from 'src/core/application/commands/usuario/crear-usuario.handler';
import { UsuarioCreadoHandler } from 'src/core/application/events/usuario/usuario-creado.handler';
import { UsuarioEntity } from 'src/infraestructure/persistance/entities/usuario.entity';
import { PostUsuarioController } from 'src/interfaces/controllers/usuario/post-usuario.controller';
import { GetUsuarioController } from 'src/interfaces/controllers/usuario/get-usuario.controller';
import { FindUsuarioQueryHandler } from 'src/core/application/query/usuario/find-usuario.handler';
import { FindUsuarioSearchQueryHandler } from '../../../core/application/query/usuario/find-usuario-search.handler';
import { FindUsuarioCrieriaUsecase } from '../../../core/application/usecases/usuario/find-usuario-crieria.usecase';
import { PutUsuarioController } from '../../controllers/usuario/put-usuario.controller';
import { ModificarUsuarioUsecase } from '../../../core/application/usecases/usuario/modificar-usuario.usecase';
import { ModificarUsuarioHandler } from '../../../core/application/commands/usuario/modificar-usuario.handler';
import { UsuarioModificadoHandler } from '../../../core/application/events/usuario/usuario-modificado.handler';
import { UsuarioDesactivadoHandler } from '../../../core/application/events/usuario/usuario-desactivado.handler';
import { DesactivarUsuarioHandler } from '../../../core/application/commands/usuario/desactivar-usuario.handler';
import { DesactivarUsuarioUsecase } from '../../../core/application/usecases/usuario/desactivar-usuario.usecase';
import { DeleteUsuarioController } from '../../controllers/usuario/delete-usuario.controller';
import { GetUsuarioSearchController } from '../../controllers/usuario/get-usuario-search.controller';

const repositoryFactory: Provider<UsuarioRepository> = {
  provide: ConstantsRepository.USUARIO_REPOSITORY,
  useClass: OrmUsuarioRepository,
};

const serviceProviders = [
  UsuarioService,
];

const useCaseProviders = [
  {
    provide: CrearUsuarioUsecase,
    useFactory: (usuarioS: UsuarioService) =>
      new CrearUsuarioUsecase(usuarioS),
    inject: [UsuarioService],
  },
  {
    provide: FindUsuarioUsecase,
    useFactory: (usuarioS: UsuarioService) =>
      new FindUsuarioUsecase(usuarioS),
    inject: [UsuarioService],
  },
  {
    provide: FindUsuarioCrieriaUsecase,
    useFactory: (usuarioS: UsuarioService) =>
      new FindUsuarioCrieriaUsecase(usuarioS),
    inject: [UsuarioService],
  },
  {
    provide: ModificarUsuarioUsecase,
    useFactory: (usuarioS: UsuarioService) =>
      new ModificarUsuarioUsecase(usuarioS),
    inject: [UsuarioService],
  },
  {
    provide: DesactivarUsuarioUsecase,
    useFactory: (usuarioS: UsuarioService) =>
      new DesactivarUsuarioUsecase(usuarioS),
    inject: [UsuarioService],
  }
];
const handlerProviders = [
  CrearUsuarioHandler,
  FindUsuarioQueryHandler,
  FindUsuarioSearchQueryHandler,
  ModificarUsuarioHandler,
  DesactivarUsuarioHandler
];
export const EventHandlers = [
  UsuarioCreadoHandler,
  UsuarioModificadoHandler,
  UsuarioDesactivadoHandler
];

@Module({
  imports: [TypeOrmModule.forFeature([UsuarioEntity])],
  providers: [
    repositoryFactory,
    ...serviceProviders,
    ...handlerProviders,
    ...useCaseProviders,
    ...EventHandlers,
  ],
  controllers: [
    PostUsuarioController,
    GetUsuarioSearchController,
    GetUsuarioController,
    PutUsuarioController,
    DeleteUsuarioController
  ],
  exports: [
    UsuarioService,
    TypeOrmModule,
    repositoryFactory
  ],
})
export class UsuarioModule {
}
