// Written with the help of Claude
// Every endpoint path in one place, with its full prefix and version.
// Path parameters use the OpenAPI {name} form; @Endpoint converts it for Nest.
export const Routes = {
  system: {
    health: '/health',
  },
  events: {
    list: '/api/v1/events',
    byId: '/api/v1/events/{id}',
    cancel: '/api/v1/events/{id}/cancel',
  },
} as const;
