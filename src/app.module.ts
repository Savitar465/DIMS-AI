import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './infraestructure/shared/config/database.config';
import { DimsModule } from './dims.module';

@Global()
@Module({
  imports: [
    DimsModule,
    CqrsModule,
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
  exports: [CqrsModule],
  // providers: [
  //   {
  //     provide: APP_GUARD,
  //     useClass: AuthGuard,
  //   },
  // ],
  controllers: [],
})
export class AppModule {}
