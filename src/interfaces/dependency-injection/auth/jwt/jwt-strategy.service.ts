import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt'){
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true, // Enable caching
        rateLimit: true, // Rate limit JWKS requests
        jwksRequestsPerMinute: 10,
        jwksUri: 'https://keycloakqa.apps.gob.bo/realms/test/protocol/openid-connect/certs',
      }),
      audience: 'ms-chat',
      issuer: 'https://keycloakqa.apps.gob.bo/realms/test',
      algorithms: ['RS256'],
    });
  }

  validate(payload: unknown): unknown {
    return payload;
  }
}