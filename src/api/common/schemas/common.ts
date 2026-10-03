// Written with the help of Claude
import { z } from 'zod';

export const Id = z.uuid();
export const DateTime = z.iso.datetime({ offset: true });
