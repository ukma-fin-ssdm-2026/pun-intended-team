// Written with the help of Claude
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { dump } from 'js-yaml';
import { DEFAULT_PORT } from './config.js';
import { registry } from './registry.js';
import { tags } from './tags.js';
// Importing the controllers registers their paths in the registry.
import './controllers/index.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const { version } = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string };

const SPEC_FILE = path.join(repoRoot, 'docs/api/openapi-generated.yaml');

export function generateOpenApiSpec() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Nearby API',
      version,
      description: 'REST API of Nearby, an app for going to events and meeting people along the way.',
    },
    servers: [{ url: `http://localhost:${DEFAULT_PORT}`, description: 'Local development' }],
    tags: [...tags],
  });
}

export function writeOpenApiSpec(file = SPEC_FILE): string {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, dump(generateOpenApiSpec(), { noRefs: true }));
  return file;
}
