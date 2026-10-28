// Written with the help of Claude
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Not env(): it throws when the variable is missing, but `prisma generate` never connects
  // and runs after every npm ci, also in CI jobs without a database.
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
