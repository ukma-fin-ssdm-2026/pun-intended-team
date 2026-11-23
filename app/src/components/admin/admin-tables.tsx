// Written with the help of Claude
import { View } from 'react-native';

import {
  listAccounts,
  listAdminEvents,
  listAdminVenues,
  type AccountsFilter,
  type AdminAccount,
  type AdminEvent,
  type AdminVenue,
  type EventsFilter,
  type VenuesFilter,
} from '@/api/admin';
import {
  Cell,
  filterOf,
  offsetOf,
  RowLink,
  SearchBox,
  Table,
  Tabs,
  type Column,
  type ListControl,
} from '@/components/admin/admin-list';
import { Badge } from '@/components/admin/admin-ui';
import {
  accountStatusBadges,
  eventStatusBadges,
  organizationStatusBadges,
  roleLabels,
  sourceLabels,
} from '@/components/admin/admin-labels';
import { formatDateTime, formatEventDate } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';

const statuses = ['active', 'pending', 'banned'] as const;
const roles = ['user', 'admin'] as const;
const periods = ['upcoming', 'past'] as const;
const eventStatuses = ['published', 'cancelled'] as const;
const sources = ['organization', 'import'] as const;

const accountColumns: Column[] = [
  { label: 'Користувач', className: 'flex-[2]' },
  { label: 'Роль', className: 'w-32' },
  { label: 'Вік', className: 'w-14' },
  { label: 'Організація', className: 'flex-[1.5]' },
  { label: 'Зареєстровано', className: 'flex-1' },
  { label: 'Статус', className: 'w-48' },
];

function AccountRow({ item }: { item: AdminAccount }) {
  const status = accountStatusBadges[item.status];
  const organization = item.organization && organizationStatusBadges[item.organization.verificationStatus];
  return (
    <RowLink href={{ pathname: '/admin/users/[id]', params: { id: item.id } }}>
      <Cell
        className="flex-[2]"
        title={item.profile?.displayName ?? 'Без профілю'}
        note={item.profile ? `@${item.profile.username}` : item.id}
      />
      <Cell className="w-32" title={roleLabels[item.role]} />
      <Cell className="w-14" title={item.age === null ? '–' : String(item.age)} />
      <Cell
        className="flex-[1.5]"
        title={item.organization?.name ?? '–'}
        note={organization ? organization.label : null}
      />
      <Cell className="flex-1" title={formatDateTime(item.createdAt)} />
      <View className="w-48">
        <Badge label={status.label} tone={status.tone} />
      </View>
    </RowLink>
  );
}

// Every account, or only the administrators when `role` is fixed.
export function AccountsList({ control, role }: { control: ListControl; role?: AccountsFilter['role'] }) {
  const [state, set] = control;
  const offset = offsetOf(state);
  const filter: AccountsFilter = {
    search: state.search || undefined,
    role: role ?? filterOf(state.role, roles),
    status: filterOf(state.status, statuses),
  };
  const accounts = useApiQuery(`accounts:${JSON.stringify(filter)}:${offset}`, () => listAccounts(filter, offset));

  return (
    <>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row flex-wrap gap-4">
          <Tabs
            options={[
              { value: '', label: 'Усі' },
              { value: 'active', label: 'Активні' },
              { value: 'pending', label: 'Очікують' },
              { value: 'banned', label: 'Заблоковані' },
            ]}
            value={filter.status}
            onChange={(status) => set({ status })}
          />
          {!role && (
            <Tabs
              options={[
                { value: '', label: 'Усі ролі' },
                { value: 'user', label: 'Користувачі' },
                { value: 'admin', label: 'Адміністратори' },
              ]}
              value={filter.role}
              onChange={(value) => set({ role: value })}
            />
          )}
        </View>
        <SearchBox value={filter.search} placeholder="Пошук" onSearch={(search) => set({ search })} />
      </View>
      <Table
        columns={accountColumns}
        query={accounts}
        offset={offset}
        onOffset={(next) => set({ offset: String(next) })}
        row={(item) => <AccountRow key={item.id} item={item} />}
      />
    </>
  );
}

const eventColumns: Column[] = [
  { label: 'Подія', className: 'flex-[2.5]' },
  { label: 'Коли', className: 'flex-[1.5]' },
  { label: 'Місце', className: 'flex-[1.5]' },
  { label: 'Додав', className: 'flex-[1.5]' },
  { label: 'Статус', className: 'w-36' },
];

function EventRow({ item }: { item: AdminEvent }) {
  const status = eventStatusBadges[item.status];
  return (
    <RowLink href={{ pathname: '/admin/events/[id]', params: { id: item.id } }}>
      <Cell className="flex-[2.5]" title={item.title} note={item.category.name} />
      <Cell className="flex-[1.5]" title={formatEventDate(item.startsAt, item.startTimeKnown)} />
      <Cell className="flex-[1.5]" title={item.venue.name} note={item.venue.address} />
      <Cell className="flex-[1.5]" title={item.organization?.name ?? sourceLabels.import} />
      <View className="w-36">
        <Badge label={status.label} tone={status.tone} />
      </View>
    </RowLink>
  );
}

// Every event, or those of one organization or venue when `fixed` says so.
export function EventsList({
  control,
  fixed = {},
}: {
  control: ListControl;
  fixed?: Pick<EventsFilter, 'organizationId' | 'venueId'>;
}) {
  const [state, set] = control;
  const offset = offsetOf(state);
  const filter: EventsFilter = {
    ...fixed,
    period: filterOf(state.period, periods) ?? 'upcoming',
    search: state.search || undefined,
    status: filterOf(state.status, eventStatuses),
    source: fixed.organizationId ? undefined : filterOf(state.source, sources),
  };
  const events = useApiQuery(`events:${JSON.stringify(filter)}:${offset}`, () => listAdminEvents(filter, offset));

  return (
    <>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <View className="flex-row flex-wrap gap-4">
          <Tabs
            options={[
              { value: 'upcoming', label: 'Майбутні' },
              { value: 'past', label: 'Минулі' },
            ]}
            value={filter.period}
            onChange={(period) => set({ period })}
          />
          <Tabs
            options={[
              { value: '', label: 'Усі' },
              { value: 'published', label: 'Опубліковані' },
              { value: 'cancelled', label: 'Скасовані' },
            ]}
            value={filter.status}
            onChange={(status) => set({ status })}
          />
          {!fixed.organizationId && (
            <Tabs
              options={[
                { value: '', label: 'Усі джерела' },
                { value: 'organization', label: 'Від організацій' },
                { value: 'import', label: 'Імпортовані' },
              ]}
              value={filter.source}
              onChange={(source) => set({ source })}
            />
          )}
        </View>
        <SearchBox value={filter.search} placeholder="Пошук" onSearch={(search) => set({ search })} />
      </View>
      <Table
        columns={eventColumns}
        query={events}
        offset={offset}
        onOffset={(next) => set({ offset: String(next) })}
        row={(item) => <EventRow key={item.id} item={item} />}
      />
    </>
  );
}

const venueColumns: Column[] = [
  { label: 'Місце', className: 'flex-[2]' },
  { label: 'Адреса', className: 'flex-[2]' },
  { label: 'Додав', className: 'flex-[1.5]' },
];

function VenueRow({ item }: { item: AdminVenue }) {
  return (
    <RowLink href={{ pathname: '/admin/venues/[id]', params: { id: item.id } }}>
      <Cell className="flex-[2]" title={item.name} />
      <Cell className="flex-[2]" title={item.address} />
      <Cell className="flex-[1.5]" title={item.organization?.name ?? sourceLabels[item.source]} />
    </RowLink>
  );
}

// Every venue, or one organization's when `organizationId` is fixed.
export function VenuesList({ control, organizationId }: { control: ListControl; organizationId?: string }) {
  const [state, set] = control;
  const offset = offsetOf(state);
  const filter: VenuesFilter = {
    organizationId,
    search: state.search || undefined,
    source: organizationId ? undefined : filterOf(state.source, sources),
  };
  const venues = useApiQuery(`venues:${JSON.stringify(filter)}:${offset}`, () => listAdminVenues(filter, offset));

  return (
    <>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        {organizationId ? (
          <View />
        ) : (
          <Tabs
            options={[
              { value: '', label: 'Усі' },
              { value: 'organization', label: 'Від організацій' },
              { value: 'import', label: 'Імпортовані' },
            ]}
            value={filter.source}
            onChange={(source) => set({ source })}
          />
        )}
        <SearchBox value={filter.search} placeholder="Пошук" onSearch={(search) => set({ search })} />
      </View>
      <Table
        columns={venueColumns}
        query={venues}
        offset={offset}
        onOffset={(next) => set({ offset: String(next) })}
        row={(item) => <VenueRow key={item.id} item={item} />}
      />
    </>
  );
}
