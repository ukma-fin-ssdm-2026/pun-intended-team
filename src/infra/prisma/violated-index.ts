// Written with the help of Claude
import { Prisma } from './generated/client.ts';

/** The unique index a failed write ran into; undefined for any other error. */
export function violatedIndex(error: unknown): string | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return undefined;
  }
  const cause = (error.meta?.driverAdapterError as { cause?: { constraint?: { index?: unknown } } } | undefined)?.cause;
  const index = cause?.constraint?.index;
  return typeof index === 'string' ? index : undefined;
}
