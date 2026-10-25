// Written with the help of Claude
// Sets the passwords of nearby_main and nearby_import (npm run db:set-passwords). They come from
// MAIN_DATABASE_URL and IMPORT_DATABASE_URL; the statements run as the role in DATABASE_URL, which owns the
// schema. Safe to repeat: ALTER ROLE just sets the same password again. Passwords are never printed.
import pg from 'pg';

const roles = [
  { name: 'nearby_main', variable: 'MAIN_DATABASE_URL', value: process.env.MAIN_DATABASE_URL },
  { name: 'nearby_import', variable: 'IMPORT_DATABASE_URL', value: process.env.IMPORT_DATABASE_URL },
];

function required(variable: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${variable} is not set: see .env.example`);
  }
  return value;
}

function passwordFor({ name, variable, value }: (typeof roles)[number]): string {
  const url = new URL(required(variable, value));
  if (decodeURIComponent(url.username) !== name) {
    throw new Error(`${variable} must sign in as ${name}`);
  }
  const password = decodeURIComponent(url.password);
  if (!password) {
    throw new Error(`${variable} has no password`);
  }
  return password;
}

const client = new pg.Client({ connectionString: required('DATABASE_URL', process.env.DATABASE_URL) });
await client.connect();
try {
  for (const role of roles) {
    // ALTER ROLE takes no parameters, so the server builds the statement and quotes both values.
    const { rows } = await client.query<{ statement: string }>(
      `SELECT format('ALTER ROLE %I PASSWORD %L', $1::text, $2::text) AS statement`,
      [role.name, passwordFor(role)],
    );
    await client.query(rows[0]!.statement);
    console.log(`Set the password of ${role.name}`);
  }
} finally {
  await client.end();
}
