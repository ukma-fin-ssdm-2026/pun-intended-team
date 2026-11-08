// Written with the help of Claude
import { z } from 'zod';

const DependencyStatus = z.enum(['up', 'down']);

const HealthResponseFields = z.object({
  status: z.enum(['healthy', 'unhealthy']).describe('healthy only while every dependency in checks is up'),
  checks: z
    .object({ database: DependencyStatus })
    .describe('Each dependency the API needs, up or down; the cause of a failure is only logged'),
});

export const healthExample: HealthResponse = {
  status: 'healthy',
  checks: { database: 'up' },
};

export const HealthResponse = HealthResponseFields.meta({
  id: 'HealthResponse',
  description: 'Whether the API and the dependencies it needs are up',
  example: healthExample,
});

export type HealthResponse = z.infer<typeof HealthResponseFields>;
