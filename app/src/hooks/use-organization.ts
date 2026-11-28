// Written with the help of Claude
import { getOrganization, loadOrganizationEvents } from '@/api/organizations';
import { useApiQuery } from '@/hooks/use-api-query';

// The organizer page: the organization and its upcoming events. Loads nothing while `id` is undefined.
export function useOrganization(id: string | undefined) {
  const organization = useApiQuery(id ?? null, () => getOrganization(id ?? ''));
  const events = useApiQuery(id ? `${id}/events` : null, () => loadOrganizationEvents(id ?? ''));
  const failure = organization.failure ?? events.failure;
  return {
    organization: organization.data,
    events: events.data,
    loading: organization.loading || events.loading,
    notFound: failure?.status === 404,
    error: Boolean(failure),
    reload: () => {
      organization.reload();
      events.reload();
    },
  };
}
