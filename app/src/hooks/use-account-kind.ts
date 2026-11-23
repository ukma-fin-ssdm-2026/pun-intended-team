// Written with the help of Claude
import { useOwnOrganization } from '@/hooks/use-own-organization';
import { useSession } from '@/state/session';

// An organization is an account that has sent an organization request; it has no personal profile.
export type AccountKind = 'person' | 'organization' | 'admin';

// Undefined until the organization request has loaded; the token renewal before that request sets the role.
export function accountKind(
  role: string | undefined,
  organization: { loading: boolean; hasOrganization: boolean },
): AccountKind | undefined {
  if (organization.loading) return undefined;
  if (role === 'admin') return 'admin';
  return organization.hasOrganization ? 'organization' : 'person';
}

// Where the app's start sends a signed-in account instead of the tabs. Both panels are for a browser on a computer:
// on a phone an organization sees "Відкрий на компʼютері", and an administrator uses the app as anyone else.
export function accountHome(kind: AccountKind, web: boolean): '/admin' | '/organization' | null {
  if (kind === 'organization') return '/organization';
  if (kind === 'admin' && web) return '/admin';
  return null;
}

export function useAccountKind(): AccountKind | undefined {
  const { role } = useSession();
  const organization = useOwnOrganization();
  return accountKind(role, { loading: organization.loading, hasOrganization: !!organization.data });
}
