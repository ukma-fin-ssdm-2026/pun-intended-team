// Written with the help of Claude
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

// @Endpoint registers every endpoint here; openapi.ts turns it into the spec
export const registry = new OpenAPIRegistry();

export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description:
    'An access token from `/api/v1/auth/sign-in` or `/api/v1/auth/verify`, or a guest token from ' +
    '`/api/v1/auth/guest` for catalog reads.',
});
