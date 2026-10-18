// Written with the help of Claude
import { existsSync } from 'node:fs';

// Local settings; variables already set in the environment win.
if (existsSync('.env')) {
  process.loadEnvFile();
}

// Single place for the port: both the server and the generated spec use it.
export const DEFAULT_PORT = 4100;

export const port = Number(process.env.PORT ?? DEFAULT_PORT);

export const isProduction = process.env.NODE_ENV === 'production';

export const serveSwaggerUi = process.env.SWAGGER_UI === 'true' || !isProduction;

export const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin !== '');

// Development stand-in: events live in memory until the database holds them (#144), so an import run by another
// process would not reach the API. With this set, the API runs one import after it starts.
export const importOnStart = process.env.IMPORT_ON_START === 'true';
