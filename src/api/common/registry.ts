// Written with the help of Claude
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

// @Endpoint registers every endpoint here; openapi.ts turns it into the spec
export const registry = new OpenAPIRegistry();

export const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description:
    'An access token, or a guest token for catalog reads. Until sign-in is implemented, use a stub token: ' +
    '`stub-guest`, `stub-user`, `stub-user-2`, `stub-org` (verified organization), `stub-org-pending` or `stub-admin`.',
});
