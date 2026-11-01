// Written with the help of Claude
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { CASES_PAGE_SIZE, listReportCases, type CaseStatus, type ReportCase } from '@/api/admin';
import { Badge, Card, LoadState, PageHeader, resolutionLabels } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';

const statusTabs: { value: CaseStatus; label: string }[] = [
  { value: 'open', label: 'Відкриті' },
  { value: 'resolved', label: 'Розглянуті' },
];

const columns = [
  { label: 'Користувач', className: 'flex-[2]' },
  { label: 'Скарг', className: 'w-20' },
  { label: 'Перша скарга', className: 'flex-1' },
  { label: 'Остання скарга', className: 'flex-1' },
  { label: 'Статус', className: 'w-36' },
];

function CaseRow({ item, onOpen }: { item: ReportCase; onOpen: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onOpen}
      className="flex-row items-center gap-4 border-t border-border-default px-6 py-4 hover:bg-surface-background"
    >
      <View className="flex-[2] gap-0.5">
        <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
          {item.account.displayName ?? 'Без профілю'}
        </Text>
        <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
          {item.account.username ? `@${item.account.username}` : item.account.id}
        </Text>
      </View>
      <Text className="w-20 font-inter-semibold text-body text-text-primary">{item.reportCount}</Text>
      <Text className="flex-1 font-inter text-caption text-text-secondary">{formatDateTime(item.firstReportedAt)}</Text>
      <Text className="flex-1 font-inter text-caption text-text-secondary">{formatDateTime(item.lastReportedAt)}</Text>
      <View className="w-36">
        {item.resolution ? (
          <Badge label={resolutionLabels[item.resolution]} tone={item.resolution === 'banned' ? 'dark' : 'muted'} />
        ) : (
          <Badge label="Відкрита" tone="coral" />
        )}
      </View>
    </Pressable>
  );
}

export default function AdminReports() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; offset?: string }>();
  const status: CaseStatus = params.status === 'resolved' ? 'resolved' : 'open';
  const offset = Math.max(0, Number(params.offset) || 0);
  const cases = useApiQuery(`${status}:${offset}`, () => listReportCases(status, offset));

  return (
    <>
      <PageHeader title="Скарги" note="Скарги на одного користувача збираються в одну справу." />

      <View accessibilityRole="tablist" className="flex-row gap-2">
        {statusTabs.map((tab) => (
          <Button
            key={tab.value}
            label={tab.label}
            size="sm"
            variant={tab.value === status ? 'dark' : 'light'}
            onPress={() => router.setParams({ status: tab.value, offset: '0' })}
          />
        ))}
      </View>

      <Card>
        <View className="flex-row gap-4 px-6 py-3">
          {columns.map((column) => (
            <Text
              key={column.label}
              className={`font-inter-medium text-caption text-text-secondary ${column.className}`}
            >
              {column.label}
            </Text>
          ))}
        </View>
        {cases.data ? (
          cases.data.items.length === 0 ? (
            <Text className="border-t border-border-default px-6 py-10 text-center font-inter text-body text-text-secondary">
              {status === 'open' ? 'Відкритих скарг немає.' : 'Розглянутих скарг поки немає.'}
            </Text>
          ) : (
            cases.data.items.map((item) => (
              <CaseRow
                key={item.id}
                item={item}
                onOpen={() => router.push({ pathname: '/admin/reports/[id]', params: { id: item.id } })}
              />
            ))
          )
        ) : (
          <LoadState failure={cases.failure} onRetry={cases.reload} />
        )}
      </Card>

      {cases.data && (offset > 0 || cases.data.page.hasMore) && (
        <View className="flex-row items-center justify-end gap-3">
          <Button
            label="Назад"
            size="sm"
            variant="light"
            disabled={offset === 0}
            onPress={() => router.setParams({ offset: String(Math.max(0, offset - CASES_PAGE_SIZE)) })}
          />
          <Button
            label="Далі"
            size="sm"
            variant="light"
            disabled={!cases.data.page.hasMore}
            onPress={() => router.setParams({ offset: String(offset + CASES_PAGE_SIZE) })}
          />
        </View>
      )}
    </>
  );
}
