// Written with the help of Claude
// Prints an env template with its placeholders filled from the environment: node render-env.mjs <template>.
// ${NAME} must be set and not empty, ${NAME:-} may be empty. Fails on any missing value, naming all of them,
// so a deploy never writes a half-filled .env. Values are never printed to stderr.
import { readFileSync } from 'node:fs';

const [template] = process.argv.slice(2);
if (!template) {
  console.error('Usage: node render-env.mjs <template>');
  process.exit(1);
}

const missing = new Set();
const fill = (_match, name, optional) => {
  const value = process.env[name] ?? '';
  if (/[\r\n]/.test(value)) {
    missing.add(`${name} (has a line break)`);
  } else if (value === '' && !optional) {
    missing.add(name);
  }
  return value;
};
// Comment lines are copied as they are.
const rendered = readFileSync(template, 'utf8')
  .split('\n')
  .map((line) => (line.startsWith('#') ? line : line.replace(/\$\{([A-Z0-9_]+)(:-)?\}/g, fill)))
  .join('\n');

if (missing.size > 0) {
  console.error(`Not set: ${[...missing].join(', ')}`);
  process.exit(1);
}
process.stdout.write(rendered);
