// Written with the help of Claude
import type { Response, Router } from 'express';
import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { registry } from '../registry.js';
import { ErrorResponse, type ValidationIssue } from '../schemas/errors.js';
import type { Tag } from '../tags.js';
import { sendError } from './errors.js';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface RequestSchemas {
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
}

interface ResponseDefinition {
  description: string;
  schema?: z.ZodType;
}

type Parsed<T> = T extends z.ZodType ? z.output<T> : undefined;

export interface RouteInput<R extends RequestSchemas> {
  params: Parsed<R['params']>;
  query: Parsed<R['query']>;
  body: Parsed<R['body']>;
}

export interface RouteDefinition<R extends RequestSchemas> {
  method: Method;
  /** A path from Routes, in the OpenAPI {name} form. */
  path: string;
  /** Unique name of the operation; also the tool name in generated clients and MCP servers. */
  operationId: string;
  summary: string;
  description?: string;
  tags: Tag[];
  request?: R;
  responses: Record<number, ResponseDefinition>;
  /** Receives already validated input; invalid requests never reach it. */
  handler: (input: RouteInput<R>, res: Response) => unknown;
}

const VALIDATION_ERROR: ResponseDefinition = {
  description: 'The request is invalid; see error.details',
  schema: ErrorResponse,
};

/**
 * Registers one endpoint in both places at once: the OpenAPI registry (docs)
 * and the Express router (behaviour), validating params, query and body with
 * the same zod schemas that describe them.
 */
export function defineRoute<R extends RequestSchemas>(router: Router, route: RouteDefinition<R>): void {
  const { method, path, request = {} as R, handler } = route;
  const hasInput = Boolean(request.params || request.query || request.body);

  const responses = hasInput && !route.responses[400] ? { 400: VALIDATION_ERROR, ...route.responses } : route.responses;

  registry.registerPath({
    method,
    path,
    operationId: route.operationId,
    summary: route.summary,
    description: route.description,
    tags: route.tags,
    request: toOpenApiRequest(request),
    responses: Object.fromEntries(
      Object.entries(responses).map(([status, { description, schema }]) => [
        status,
        schema ? { description, content: { 'application/json': { schema } } } : { description },
      ]),
    ),
  });

  router[method](toExpressPath(path), async (req, res) => {
    const details: ValidationIssue[] = [];
    const parse = (location: ValidationIssue['location'], schema: z.ZodType | undefined, value: unknown) => {
      if (!schema) return undefined;
      const result = schema.safeParse(value);
      if (result.success) return result.data;
      for (const issue of result.error.issues) {
        details.push({ location, field: issue.path.join('.'), message: issue.message });
      }
      return undefined;
    };

    const params = parse('params', request.params, req.params);
    const query = parse('query', request.query, req.query);
    const body = parse('body', request.body, req.body);

    if (details.length > 0) {
      sendError(res, 400, 'VALIDATION_ERROR', 'The request is invalid', details);
      return;
    }

    // Every schema has passed, so the values match the declared types.
    await handler({ params, query, body } as RouteInput<R>, res);
  });
}

/** '/events/{id}' -> '/events/:id' */
function toExpressPath(path: string): string {
  return path.replace(/\{(\w+)\}/g, ':$1');
}

function toOpenApiRequest(request: RequestSchemas): RouteConfig['request'] {
  return {
    params: request.params,
    query: request.query,
    body: request.body && { content: { 'application/json': { schema: request.body } } },
  };
}
