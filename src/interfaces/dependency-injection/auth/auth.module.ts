// import { Module } from '@nestjs/common';
// import { KeycloakConfigService } from './jwt/keycloak-config.service';
// import { ConfigsModule } from '../configs/configs.module';
// import { APP_GUARD } from '@nestjs/core';
// import { AuthGuard, KeycloakConnectModule } from 'nest-keycloak-connect';
//
//
// @Module({
//   imports: [
//     // PassportModule.register({
//     //   defaultStrategy: 'jwt'
//     // }),
//     KeycloakConnectModule.registerAsync({
//       useExisting: KeycloakConfigService,
//       imports: [ConfigsModule],
//     }),
//   ],
//   providers: [
//     {
//       provide: APP_GUARD,
//       useClass: AuthGuard,
//     },
//   ],
//   exports: [],
//
// })
// export class AuthModule {
// }
