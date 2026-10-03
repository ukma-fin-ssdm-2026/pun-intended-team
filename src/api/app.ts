// Written with the help of Claude
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { apiRouter } from './controllers/index.js';
import { errorHandler, notFoundHandler } from './lib/errors.js';
import { generateOpenApiSpec } from './openapi.js';

export const app = express();

app.use(express.json());
app.use(apiRouter);

// The live Swagger UI calls the server it is served from, whatever its port or host.
const openapiSpec = { ...generateOpenApiSpec(), servers: [{ url: '/' }] };

app.get('/api-docs.json', (_req, res) => {
  res.json(openapiSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Must stay last: they answer whatever the routes above did not.
app.use(notFoundHandler);
app.use(errorHandler);
