// Written with the help of Claude
import type { CommunicationFormat } from '../../core/profiles/types/profile.ts';
import type { DesiredCompany } from './generated/client.ts';

// The database calls the API's `company` `casual`, in profiles and applications alike.
export const toDesiredCompany: Record<CommunicationFormat, DesiredCompany> = {
  friends: 'friends',
  dating: 'dating',
  company: 'casual',
};

export const toCommunicationFormat: Record<DesiredCompany, CommunicationFormat> = {
  friends: 'friends',
  dating: 'dating',
  casual: 'company',
};
