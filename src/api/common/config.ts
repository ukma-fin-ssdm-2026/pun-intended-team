// Written with the help of Claude
// Single place for the port: both the server and the generated spec use it.
export const DEFAULT_PORT = 4100;

export const port = Number(process.env.PORT ?? DEFAULT_PORT);

export const isProduction = process.env.NODE_ENV === 'production';

export const serveSwaggerUi = process.env.SWAGGER_UI === 'true' || !isProduction;

export const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin !== '');
