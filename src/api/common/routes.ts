// Written with the help of Claude
// Every endpoint path in one place, with its full prefix and version.
// Path parameters use the OpenAPI {name} form; @Endpoint converts it for Nest.
export const Routes = {
  system: {
    health: '/health',
  },
  auth: {
    register: '/api/v1/auth/register',
    verify: '/api/v1/auth/verify',
    signIn: '/api/v1/auth/sign-in',
    guest: '/api/v1/auth/guest',
    passwordReset: '/api/v1/auth/password-reset',
    passwordResetConfirm: '/api/v1/auth/password-reset/confirm',
  },
  account: {
    password: '/api/v1/me/password',
  },
  events: {
    list: '/api/v1/events',
    byId: '/api/v1/events/{id}',
    cancel: '/api/v1/events/{id}/cancel',
  },
  listings: {
    list: '/api/v1/listings',
    byId: '/api/v1/listings/{id}',
  },
  profiles: {
    me: '/api/v1/me/profile',
    interests: '/api/v1/me/profile/interests',
  },
  interests: {
    list: '/api/v1/interests',
  },
  categories: {
    list: '/api/v1/categories',
  },
  admin: {
    categories: '/api/v1/admin/categories',
    categoryById: '/api/v1/admin/categories/{id}',
  },
} as const;
