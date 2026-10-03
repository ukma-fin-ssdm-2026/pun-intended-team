// Written with the help of Claude
import {
  applyDecorators,
  type CallHandler,
  createParamDecorator,
  type ExecutionContext,
  HttpCode,
  type NestInterceptor,
  RequestMapping,
  RequestMethod,
  UseInterceptors,
} from '@nestjs/common';
import type { RouteConfig } from '@asteasolutions/zod-to-openapi';
import { map, tap } from 'rxjs';
import { z } from 'zod';
import { ApiException } from './api-exception.js';
import { type Access, RequireAccess } from './auth.js';
import { bearerAuth, registry } from './registry.js';
import { ErrorResponse, type ValidationIssue } from './schemas/errors.js';
import type { Tag } from './tags.js';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RequestSchemas {
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
}

interface ResponseDefinition {
  description: string;
  schema?: z.ZodType;
}

type Parsed<T> = T extends z.ZodType ? z.output<T> : undefined;

/** What @Input() hands to the handler once every schema has passed. */
export interface RouteInput<R extends RequestSchemas> {
  params: Parsed<R['params']>;
  query: Parsed<R['query']>;
  body: Parsed<R['body']>;
}

export interface EndpointDefinition {
  method: Method;
  /** A path from Routes, in the OpenAPI {name} form. */
  path: string;
  /** Unique name of the operation; also the tool name in generated clients and MCP servers. */
  operationId: string;
  summary: string;
  description?: string;
  tags: Tag[];
  access: Access;
  request?: RequestSchemas;
  /** Exactly one 2xx: the status the endpoint answers with on success. */
  responses: Record<number, ResponseDefinition>;
  /** Required with a 201: the Routes path of the created object, its {id} filled from the result. */
  location?: string;
}

const VALIDATION_ERROR: ResponseDefinition = {
  description: 'The request is invalid',
  schema: ErrorResponse,
};

const UNAUTHENTICATED: ResponseDefinition = {
  description: 'No access token, or an invalid or expired one',
  schema: ErrorResponse,
};

const NOT_AN_ADMIN: ResponseDefinition = {
  description: 'Not found, or the caller is not an administrator',
  schema: ErrorResponse,
};

const LOCATION_HEADER = {
  Location: { description: 'URL of the created object', schema: { type: 'string' as const } },
};

// Where the interceptor leaves the parsed input for @Input() to pick up.
const INPUT = Symbol('validated input');

interface IncomingRequest {
  params: unknown;
  query: unknown;
  body: unknown;
  [INPUT]?: RouteInput<RequestSchemas>;
}

/**
 * Declares one endpoint in both places at once: the OpenAPI registry (docs)
 * and the Nest router (behaviour). The same zod schemas that describe the
 * endpoint validate its input and shape its success response.
 */
export function Endpoint(route: EndpointDefinition): MethodDecorator {
  const { method, path, access, location, request = {} } = route;
  const status = successStatus(route);
  const hasInput = Boolean(request.params || request.query || request.body);

  const responses = {
    ...(hasInput && { 400: VALIDATION_ERROR }),
    ...(access !== 'public' && { 401: UNAUTHENTICATED }),
    ...(access === 'admin' && { 404: NOT_AN_ADMIN }),
    ...route.responses,
  };

  registry.registerPath({
    method,
    path,
    operationId: route.operationId,
    summary: route.summary,
    description: route.description,
    tags: route.tags,
    security: access === 'public' ? undefined : [{ [bearerAuth.name]: [] }],
    request: toOpenApiRequest(request),
    responses: Object.fromEntries(
      Object.entries(responses).map(([code, { description, schema }]) => [
        code,
        {
          description,
          ...(schema && { content: { 'application/json': { schema } } }),
          ...(Number(code) === 201 && { headers: LOCATION_HEADER }),
        },
      ]),
    ),
  });

  const interceptors: NestInterceptor[] = [
    new ValidationInterceptor(request),
    new ResponseSchemaInterceptor(route.responses[status].schema),
  ];
  if (location) {
    interceptors.push(new LocationInterceptor(location));
  }

  return applyDecorators(
    RequestMapping({ method: RequestMethod[method.toUpperCase() as Uppercase<Method>], path: toNestPath(path) }),
    HttpCode(status),
    RequireAccess(access),
    UseInterceptors(...interceptors),
  );
}

/** The handler parameter that receives the validated input; invalid requests never reach the handler. */
export const Input = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<IncomingRequest>()[INPUT],
);

class ValidationInterceptor implements NestInterceptor {
  constructor(private readonly request: RequestSchemas) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<IncomingRequest>();
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

    const params = parse('params', this.request.params, req.params);
    const query = parse('query', this.request.query, req.query);
    const body = parse('body', this.request.body, req.body);

    if (details.length > 0) {
      throw new ApiException('VALIDATION_ERROR', 'The request is invalid', details);
    }

    // Every schema has passed, so the values match the declared types.
    req[INPUT] = { params, query, body } as RouteInput<RequestSchemas>;
    return next.handle();
  }
}

/**
 * Parses the handler's result with the success schema, so the response holds
 * exactly the documented fields: z.object drops unknown keys, e.g. internal
 * fields a domain object gains later. A result that does not fit the schema
 * is a server bug and ends as a logged 500.
 */
class ResponseSchemaInterceptor implements NestInterceptor {
  constructor(private readonly schema: z.ZodType | undefined) {}

  intercept(_context: ExecutionContext, next: CallHandler) {
    const { schema } = this;
    return schema ? next.handle().pipe(map((result: unknown) => schema.parse(result))) : next.handle();
  }
}

/** Sets the Location header of a 201 to the URL of the object the handler created. */
class LocationInterceptor implements NestInterceptor {
  constructor(private readonly location: string) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const res = context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>();
    return next.handle().pipe(tap((result: { id: string }) => res.setHeader('Location', this.location.replace('{id}', result.id))));
  }
}

/** Checked at startup, so a misdeclared endpoint stops the server instead of misbehaving. */
function successStatus(route: EndpointDefinition): number {
  const statuses = Object.keys(route.responses)
    .map(Number)
    .filter((status) => status >= 200 && status < 300);
  if (statuses.length !== 1) {
    throw new Error(`${route.operationId} must declare exactly one 2xx response, got ${statuses.length}`);
  }
  if (route.responses[204]?.schema) {
    throw new Error(`${route.operationId}: a 204 response has no body, so it cannot have a schema`);
  }
  if (Boolean(route.responses[201]) !== Boolean(route.location)) {
    throw new Error(`${route.operationId}: a 201 response needs a location, and only a 201 can have one`);
  }
  return statuses[0];
}

/** '/events/{id}' -> '/events/:id' */
function toNestPath(path: string): string {
  return path.replace(/\{(\w+)\}/g, ':$1');
}

function toOpenApiRequest(request: RequestSchemas): RouteConfig['request'] {
  return {
    params: request.params,
    query: request.query,
    body: request.body && { content: { 'application/json': { schema: request.body } } },
  };
}
