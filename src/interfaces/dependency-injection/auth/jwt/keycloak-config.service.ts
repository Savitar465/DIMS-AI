import { KeycloakConnectOptions, KeycloakConnectOptionsFactory, PolicyEnforcementMode, TokenValidation } from 'nest-keycloak-connect';
import { Injectable } from '@nestjs/common';

@Injectable()
export class KeycloakConfigService implements KeycloakConnectOptionsFactory {
  createKeycloakConnectOptions(): Promise<KeycloakConnectOptions> | KeycloakConnectOptions {
    return {
      authServerUrl: 'https://keycloakqa.apps.gob.bo', //your URL Keycloak server
      realm: 'test', //realms that used for this app
      clientId: 'ms-chat', //client id for this app
      secret: 'BwiYJVg29lpnaJqfdBUjvrGKa9IL06H1', //secret for this app
      logLevels: ['error'],
      useNestLogger: true,
      policyEnforcement: PolicyEnforcementMode.ENFORCING,
      tokenValidation: TokenValidation.ONLINE,
    };
  }

}