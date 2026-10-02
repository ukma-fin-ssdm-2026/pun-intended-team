// Written with the help of Claude
// Every endpoint path in one place, with its full prefix and version.
// Path parameters use the OpenAPI {name} form; defineRoute converts it for Express.
export const Routes = {
  system: {
    health: '/health',
  },
  events: {
    byId: '/api/v1/events/{id}',
  },
} as const;
