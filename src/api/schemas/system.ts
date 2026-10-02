// Written with the help of Claude
import { z } from 'zod';

const HealthResponseFields = z.object({
  status: z.literal('ok'),
});

export const healthExample: HealthResponse = {
  status: 'ok',
};

export const HealthResponse = HealthResponseFields.meta({
  id: 'HealthResponse',
  description: 'Returned while the API is up',
  example: healthExample,
});

export type HealthResponse = z.infer<typeof HealthResponseFields>;
