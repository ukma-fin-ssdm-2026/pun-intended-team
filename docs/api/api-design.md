<!-- Written with the help of Claude -->
# API Design

## Status codes

Every endpoint declares exactly one success status. The server refuses to start if an endpoint declares none or several.

### Success

| Status | When | Body |
|---|---|---|
| `200 OK` | The request succeeded: a read, or an update that returns the updated object | The object |
| `201 Created` | A new object was created | The created object, plus a `Location` header with its URL |
| `204 No Content` | A delete succeeded, or an action with nothing to return | None (the server refuses to start if a 204 declares a body schema) |

### Errors

Every error has the `ErrorResponse` body: `{ "error": { "code", "message", "details"? } }`. Clients branch on `code`, never on `message`.

| Status | `code` | When |
|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Params, query or body do not match the schema, and `details` lists every invalid field. Also a body that is not valid JSON or a URL with broken encoding; those have no `details`, since no single field is at fault |
| `401 Unauthorized` | `UNAUTHENTICATED` | No access token, or an invalid or expired one |
| `404 Not Found` | `NOT_FOUND` | The resource does not exist, **or the caller may not access it**, or no route matches (including a wrong method on an existing path) |
| `409 Conflict` | `CONFLICT` | The request conflicts with the current state, e.g. a duplicate |
| `413 Content Too Large` | `PAYLOAD_TOO_LARGE` | The body is larger than 100 kB |
| `422 Unprocessable Content` | one code per business rule | The body is valid, but a business rule forbids the action |
| `429 Too Many Requests` | `RATE_LIMITED` | A rate limit was hit (SEC-007) |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Anything unexpected; details are logged, never returned |

**No `403`.** A caller who may not access a resource gets the same `404` as if it did not exist, so the API never reveals that it exists (SEC-001, e.g. a match that is not mutual yet).
