// Written with the help of Claude
import createClient from 'openapi-fetch';

import { config } from '@/config';

import type { paths } from './schema';

export const apiClient = createClient<paths>({
  baseUrl: config.apiUrl,
  headers: { Authorization: `Bearer ${config.apiToken}` },
});
