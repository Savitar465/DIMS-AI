import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongoDatabaseModule } from './interfaces/dependency-injection/mongo-database/mongo-database.module';
import { EventoModule } from './interfaces/dependency-injection/evento/evento.module';
import { UsuarioModule } from './interfaces/dependency-injection/usuario/usuario.module';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './infraestructure/shared/config/database.config';
import { SalaModule } from './interfaces/dependency-injection/sala/sala.module';
import { ConfigsModule } from './interfaces/dependency-injection/configs/configs.module';
import { AuthGuard, KeycloakConnectModule } from 'nest-keycloak-connect';
import { KeycloakConfigService } from './interfaces/dependency-injection/auth/jwt/keycloak-config.service';
import { APP_GUARD } from '@nestjs/core';

@Global()
@Module({
  imports: [
    EventoModule,
    UsuarioModule,
    SalaModule,
    CqrsModule,
    MongoDatabaseModule,
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
      load: [databaseConfig],
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            levelFirst: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname,req,res,responseTime',
          },
        },
        autoLogging: true,
      },
    }),
    // KeycloakConnectModule.registerAsync({
    //   useExisting: KeycloakConfigService,
    //   imports: [ConfigsModule],
    // }),
  ],
  exports: [CqrsModule, MongoDatabaseModule],
  // providers: [
  //   {
  //     provide: APP_GUARD,
  //     useClass: AuthGuard,
  //   },
  // ],
  controllers: [],
})
export class AppModule {
}
