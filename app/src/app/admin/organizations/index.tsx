// Written with the help of Claude
// The organization requests page has no Figma frame; it follows the other admin pages.
import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { listOrganizations, type AdminOrganization, type OrganizationsFilter } from '@/api/admin';
import {
  Cell,
  filterOf,
  offsetOf,
  SearchBox,
  Table,
  Tabs,
  useUrlListState,
  type Column,
} from '@/components/admin/admin-list';
import { organizationStatusBadges } from '@/components/admin/admin-labels';
import { Badge, PageHeader } from '@/components/admin/admin-ui';
import { useOrganizationDecision, type Decision } from '@/components/admin/organization-decision';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';

const statuses = ['pending', 'verified', 'rejected', 'revoked'] as const;

const columns: Column[] = [
  { label: 'Організація', className: 'flex-[2]' },
  { label: 'Акаунт', className: 'flex-[1.5]' },
  { label: 'Статус', className: 'w-36' },
  { label: '', className: 'w-[260px]' },
];

function RequestRow({ item, onDecide }: { item: AdminOrganization; onDecide: (decision: Decision) => void }) {
  const badge = organizationStatusBadges[item.verificationStatus];
  return (
    <View className="flex-row items-center gap-4 border-t border-border-default px-6 py-4">
      <View className="flex-[2] gap-0.5">
        <Link href={{ pathname: '/admin/organizations/[accountId]', params: { accountId: item.accountId } }}>
          <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary hover:text-brand-coral">
            {item.name}
          </Text>
        </Link>
        {item.officialLink && (
          <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
            {item.officialLink}
          </Text>
        )}
      </View>
      <Cell
        className="flex-[1.5]"
        title={item.account.displayName ?? 'Без профілю'}
        note={item.account.username ? `@${item.account.username}` : item.accountId}
      />
      <View className="w-36">
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      <View className="w-[260px] flex-row justify-end gap-3">
        {item.verificationStatus === 'pending' && (
          <>
            <Button label="Відхилити" size="sm" variant="light" onPress={() => onDecide('reject')} />
            <Button label="Підтвердити" size="sm" onPress={() => onDecide('approve')} />
          </>
        )}
      </View>
    </View>
  );
}

export default function AdminOrganizations() {
  const [state, set] = useUrlListState();
  const offset = offsetOf(state);
  const filter: OrganizationsFilter = {
    search: state.search || undefined,
    status: filterOf(state.status, statuses),
  };
  const requests = useApiQuery(`organizations:${JSON.stringify(filter)}:${offset}`, () =>
    listOrganizations(filter, offset),
  );
  const { decide, dialog } = useOrganizationDecision(requests.reload);

  return (
    <>
      <PageHeader title="Організації" />

      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <Tabs
          options={[
            { value: '', label: 'Усі' },
            { value: 'pending', label: 'Очікують' },
            { value: 'verified', label: 'Підтверджені' },
            { value: 'rejected', label: 'Відхилені' },
            { value: 'revoked', label: 'Відкликані' },
          ]}
          value={filter.status}
          onChange={(status) => set({ status })}
        />
        <SearchBox value={filter.search} placeholder="Пошук" onSearch={(search) => set({ search })} />
      </View>

      <Table
        columns={columns}
        query={requests}
        offset={offset}
        onOffset={(next) => set({ offset: String(next) })}
        row={(item) => (
          <RequestRow
            key={item.accountId}
            item={item}
            onDecide={(decision) => decide({ accountId: item.accountId, name: item.name, decision })}
          />
        )}
      />

      {dialog}
    </>
  );
}
