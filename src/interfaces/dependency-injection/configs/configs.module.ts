import { Module } from '@nestjs/common';
import { KeycloakConfigService } from '../auth/jwt/keycloak-config.service';

@Module({
  providers: [KeycloakConfigService],
  exports: [KeycloakConfigService],
})
export class ConfigsModule {
}
