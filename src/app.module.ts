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
    // Configure pino logger: enable human-friendly `pino-pretty` only in development.
    LoggerModule.forRoot((() => {
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd) {
        return {
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
        };
      }

      // Production / serverless environments (e.g. Vercel) should not use pino-pretty transport.
      // Use structured JSON logs which are compatible with log collectors and serverless platforms.
      return {
        pinoHttp: {
          level: 'info',
          autoLogging: true,
          // Do not configure a transport here to avoid `unable to determine transport target` errors
        },
      };
    })()),
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
