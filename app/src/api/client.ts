// Written with the help of Claude
import createClient, { type Middleware } from 'openapi-fetch';

import { config } from '@/config';

import type { paths } from './schema';
import { currentAccessToken, rejectAccessToken } from './session';

const auth: Middleware = {
  async onRequest({ request }) {
    request.headers.set('Authorization', `Bearer ${await currentAccessToken()}`);
    return request;
  },
  onResponse({ request, response }) {
    if (response.status === 401) {
      rejectAccessToken(request.headers.get('Authorization')?.replace('Bearer ', '') ?? '');
    }
  },
};

// Sends the account's token when signed in and a guest token otherwise, and renews both.
export const apiClient = createClient<paths>({ baseUrl: config.apiUrl });
apiClient.use(auth);
