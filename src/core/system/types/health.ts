// Written with the help of Claude
export type DependencyStatus = 'up' | 'down';

/** The result of a health check: healthy only while every dependency the API needs is up. */
export interface Health {
  status: 'healthy' | 'unhealthy';
  checks: { database: DependencyStatus };
}
