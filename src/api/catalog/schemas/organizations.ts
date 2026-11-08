// Written with the help of Claude
import { z } from 'zod';
import { DateTime, Id, PageQuery, pageOf } from '../../common/schemas/common.ts';

const OrganizationRequestFields = z.strictObject({
  name: z.string().trim().min(1).max(100).describe('The organization’s name, as users will see it'),
  description: z.string().trim().min(1).max(1000).describe('What the organization does'),
  officialLink: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .describe('The organization’s official site or page, where an administrator can check it'),
});

export const organizationRequestExample: OrganizationRequestBody = {
  name: 'Мистецький Арсенал',
  description: 'Культурний комплекс у центрі Києва: виставки, концерти, лекції.',
  officialLink: 'https://artarsenal.in.ua',
};

export const OrganizationRequestBody = OrganizationRequestFields.meta({
  id: 'OrganizationRequestBody',
  example: organizationRequestExample,
});

const OrganizationFields = z.object({
  name: z.string(),
  description: z.string().nullable(),
  officialLink: z.string().nullable(),
  verificationStatus: z
    .enum(['pending', 'verified', 'rejected', 'revoked'])
    .describe('pending: waits for an administrator; only a verified organization publishes events'),
  verifiedAt: DateTime.nullable().describe('When an administrator verified it; null otherwise'),
});

export const organizationExample: Organization = {
  ...organizationRequestExample,
  verificationStatus: 'pending',
  verifiedAt: null,
};

export const Organization = OrganizationFields.meta({
  id: 'Organization',
  description: 'The caller’s organization request and its status',
  example: organizationExample,
});

const AdminOrganizationFields = OrganizationFields.extend({
  accountId: Id.describe('The account that sent the request; the id in the approve and reject paths'),
  account: z
    .object({
      id: Id,
      username: z.string().nullable().describe('Null when the account has no profile'),
      displayName: z.string().nullable(),
    })
    .describe('The account that sent the request'),
});

const adminOrganizationExample: AdminOrganization = {
  ...organizationExample,
  accountId: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d',
  account: { id: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d', username: 'arsenal', displayName: 'Арсенал' },
};

export const AdminOrganization = AdminOrganizationFields.meta({
  id: 'AdminOrganization',
  description: 'An organization request as an administrator reviews it',
  example: adminOrganizationExample,
});

export const AdminOrganizationsPage = pageOf(AdminOrganization, 'AdminOrganizationsPage', adminOrganizationExample);

export const ListOrganizationsQuery = PageQuery;

export const OrganizationAccountParams = z.object({
  accountId: Id.describe('Account id of the organization'),
});

export type OrganizationRequestBody = z.infer<typeof OrganizationRequestFields>;
export type Organization = z.infer<typeof OrganizationFields>;
export type AdminOrganization = z.infer<typeof AdminOrganizationFields>;
export type AdminOrganizationsPage = z.infer<typeof AdminOrganizationsPage>;
