// Written with the help of Claude
import { z } from 'zod';
import { DateTime, Id, PageQuery, pageOf, SearchText } from '../../common/schemas/common.ts';
import { Image } from '../../images/schemas/images.ts';

const OrganizationRequestFields = z.strictObject({
  name: z.string().trim().min(1).max(100).describe('The organization’s name, as users will see it'),
  description: z.string().trim().min(1).max(1000).describe('What the organization does'),
  officialLink: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .describe('The organization’s official site or page, where an administrator can check it'),
  instagram: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .describe(
      'The organization’s Instagram: a username with or without "@", or an instagram.com profile link. Kept as the ' +
        'bare username (up to 30 letters, digits, underscores or single dots); one that does not fit is ' +
        'INVALID_SOCIAL_HANDLE. Omitted, null or empty: none',
    ),
});

export const organizationRequestExample: OrganizationRequestBody = {
  name: 'Мистецький Арсенал',
  description: 'Культурний комплекс у центрі Києва: виставки, концерти, лекції.',
  officialLink: 'https://artarsenal.in.ua',
  instagram: '@artarsenal',
};

export const OrganizationRequestBody = OrganizationRequestFields.meta({
  id: 'OrganizationRequestBody',
  example: organizationRequestExample,
});

export const VerificationStatus = z.enum(['pending', 'verified', 'rejected', 'revoked']);

const OrganizationFields = z.object({
  name: z.string(),
  description: z.string().nullable(),
  officialLink: z.string().nullable(),
  instagram: z.string().nullable().describe('The Instagram username, without "@"; null when none'),
  verificationStatus: VerificationStatus.describe(
    'pending: waits for an administrator; only a verified organization publishes events',
  ),
  verifiedAt: DateTime.nullable().describe('When an administrator verified it; null otherwise'),
  logo: Image.nullable().describe('A square shown as a circle; null shows the building icon'),
});

export const organizationExample: Organization = {
  ...organizationRequestExample,
  instagram: 'artarsenal',
  verificationStatus: 'pending',
  verifiedAt: null,
  logo: null,
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

export const ListOrganizationsQuery = PageQuery.extend({
  search: SearchText.optional().describe('Part of the organization’s name, in any case'),
  status: VerificationStatus.optional().describe('Only organizations in this status'),
});

const PublicOrganizationFields = z.object({
  id: Id.describe('The organization’s id; the same as the organizer id of its events'),
  name: z.string(),
  description: z.string().nullable(),
  officialLink: z.string().nullable().describe('The organization’s site'),
  instagram: z.string().nullable().describe('The Instagram username, without "@"; null when none'),
  logo: Image.nullable().describe('A square shown as a circle; null shows the building icon'),
});

export const publicOrganizationExample: PublicOrganization = {
  id: 'f4b6d8e0-2c4a-4e6f-9b1d-5a7c9e1f3b4d',
  name: organizationExample.name,
  description: organizationExample.description,
  officialLink: organizationExample.officialLink,
  instagram: 'artarsenal',
  logo: null,
};

export const PublicOrganization = PublicOrganizationFields.meta({
  id: 'PublicOrganization',
  description: 'A verified organization as anyone sees it, on its page',
  example: publicOrganizationExample,
});

export const OrganizationIdParams = z.object({
  id: Id.describe('The organization’s id: `organizer.id` of its events'),
});

/** The organization an event or a venue belongs to, for administrators. */
export const OrganizationName = z
  .object({ accountId: Id.describe('Get it with adminGetOrganization'), name: z.string() })
  .nullable()
  .describe('The organization that added it; null for an imported one');

export const OrganizationAccountParams = z.object({
  accountId: Id.describe('Account id of the organization'),
});

export type OrganizationRequestBody = z.infer<typeof OrganizationRequestFields>;
export type Organization = z.infer<typeof OrganizationFields>;
export type AdminOrganization = z.infer<typeof AdminOrganizationFields>;
export type PublicOrganization = z.infer<typeof PublicOrganizationFields>;
export type AdminOrganizationsPage = z.infer<typeof AdminOrganizationsPage>;
