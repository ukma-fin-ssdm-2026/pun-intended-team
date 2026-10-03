// Written with the help of Claude
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

// defineRoute registers every endpoint here; openapi.ts turns it into the spec
export const registry = new OpenAPIRegistry();
