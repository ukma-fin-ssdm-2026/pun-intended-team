// Written with the help of Claude
import { Prisma } from '../../../dist/infra/prisma/generated/client.js';

/** The error Prisma's pg adapter throws when a write runs into `index`, as seen from Prisma 7.10. */
export function aUniqueViolation({ code = 'P2002', index = 'auth_methods_type_secret_key' as unknown } = {}) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code,
    clientVersion: '7.10.0',
    meta: {
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { kind: 'UniqueConstraintViolation', constraint: { index } },
      },
    },
  });
}

/** The error Prisma's pg adapter throws when Postgres refuses a statement with `originalCode`, as seen from Prisma 7.10. */
export function aPostgresError(originalCode: string, code = 'P2039') {
  return new Prisma.PrismaClientKnownRequestError(`Database error. Code: \`${originalCode}\``, {
    code,
    clientVersion: '7.10.0',
    meta: {
      modelName: 'Category',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: { originalCode, kind: 'postgres', code: originalCode, severity: 'ERROR' },
      },
    },
  });
}
