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
