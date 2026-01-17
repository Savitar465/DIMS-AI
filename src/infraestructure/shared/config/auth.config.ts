export interface AuthConfig{
  cache: boolean,
  rateLimit: boolean,
  jwksRequestsPerMinute: number,
  jwksUri: string,
}

export default () => ({
  auth: {
    cache: process.env.AUTH_CACHE,
    rateLimit: process.env.AUTH_RATE_LIMIT,
    jwksRequestsPerMinute: process.env.AUTH_JWKS_REQUESTS_PER_MINUTE,
    jwksUri: process.env.AUTH_JWKS_URI,
  }
});