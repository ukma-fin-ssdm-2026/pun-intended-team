// Written with the help of Claude
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { banReportedUser, dismissReportCase, getReportCase, type ReportCaseDetails } from '@/api/admin';
import type { ApiResult } from '@/api/public-client';
import {
  Badge,
  Card,
  ConfirmDialog,
  failureText,
  LoadState,
  PageHeader,
  resolutionLabels,
} from '@/components/admin/admin-ui';
import { reportReasons } from '@/components/matching/report-flow';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { formatDateTime } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';
import { colors } from '@/styles/tokens';

type Action = 'ban' | 'dismiss';

const actions: Record<
  Action,
  { run: (id: string) => Promise<ApiResult<ReportCaseDetails>>; title: string; text: string; label: string }
> = {
  ban: {
    run: banReportedUser,
    title: 'Заблокувати користувача?',
    text: 'Акаунт буде заблоковано, усі його сесії завершаться, і він більше не зможе увійти. Скасувати це з панелі не можна.',
    label: 'Заблокувати',
  },
  dismiss: {
    run: dismissReportCase,
    title: 'Відхилити скарги?',
    text: 'Справу буде закрито без покарання. Нові скарги на цього користувача відкриють нову справу.',
    label: 'Відхилити',
  },
};

const reasonLabel = (reason: string) => reportReasons.find((option) => option.value === reason)?.label ?? reason;

function Person({ person }: { person: ReportCaseDetails['account'] }) {
  return (
    <Text className="font-inter-medium text-body text-text-primary">
      {person.displayName ?? 'Без профілю'}
      <Text className="font-inter text-caption text-text-secondary">
        {'  '}
        {person.username ? `@${person.username}` : person.id}
      </Text>
    </Text>
  );
}

export default function AdminReportCase() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = useApiQuery(`case:${id}`, () => getReportCase(id));
  const [action, setAction] = useState<Action>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const item = found.data;

  const close = () => {
    setAction(undefined);
    setError(undefined);
  };

  const confirm = async () => {
    if (!action) return;
    setBusy(true);
    setError(undefined);
    const result = await actions[action].run(id);
    setBusy(false);
    if (result.ok) {
      found.setData(result.data);
      close();
    } else if (result.code === 'CANNOT_BAN_ADMIN') {
      setError('Адміністратора не можна заблокувати.');
    } else if (result.code === 'CANNOT_RESOLVE_OWN_CASE') {
      setError('Скаргу на тебе має розглянути інший адміністратор.');
    } else if (result.status === 409) {
      setError('Цю справу вже розглянули.');
      found.reload();
    } else {
      setError(failureText(result));
    }
  };

  return (
    <>
      <Link href="/admin/reports" asChild>
        <Pressable accessibilityRole="link" className="flex-row items-center gap-2 self-start">
          <Icon name="arrow-left" size={18} color={colors.text.secondary} />
          <Text className="font-inter-medium text-label text-text-secondary">Усі скарги</Text>
        </Pressable>
      </Link>

      {item ? (
        <>
          <PageHeader
            title={item.account.displayName ?? 'Без профілю'}
            note={item.account.username ? `@${item.account.username}` : item.account.id}
          >
            {item.status === 'open' && (
              <View className="flex-row gap-3">
                <Button label="Відхилити" variant="light" onPress={() => setAction('dismiss')} />
                <Button label="Заблокувати" onPress={() => setAction('ban')} />
              </View>
            )}
          </PageHeader>

          <Card className="flex-row gap-10 px-6 py-5">
            <View className="gap-1.5">
              <Text className="font-inter text-caption text-text-secondary">Статус</Text>
              {item.resolution ? (
                <Badge
                  label={resolutionLabels[item.resolution]}
                  tone={item.resolution === 'banned' ? 'dark' : 'muted'}
                />
              ) : (
                <Badge label="Відкрита" tone="coral" />
              )}
            </View>
            <View className="gap-1.5">
              <Text className="font-inter text-caption text-text-secondary">Скарг</Text>
              <Text className="font-inter-semibold text-body text-text-primary">{item.reportCount}</Text>
            </View>
            <View className="gap-1.5">
              <Text className="font-inter text-caption text-text-secondary">Перша скарга</Text>
              <Text className="font-inter text-body text-text-primary">{formatDateTime(item.firstReportedAt)}</Text>
            </View>
            <View className="gap-1.5">
              <Text className="font-inter text-caption text-text-secondary">Остання скарга</Text>
              <Text className="font-inter text-body text-text-primary">{formatDateTime(item.lastReportedAt)}</Text>
            </View>
            {item.resolvedAt && (
              <View className="gap-1.5">
                <Text className="font-inter text-caption text-text-secondary">Рішення</Text>
                <Text className="font-inter text-body text-text-primary">{formatDateTime(item.resolvedAt)}</Text>
              </View>
            )}
          </Card>

          <View className="gap-3">
            <Text className="font-inter-semibold text-h2 text-text-primary">Скарги</Text>
            <Card>
              {item.reports.map((report, index) => (
                <View
                  key={report.id}
                  className={`gap-2 px-6 py-5 ${index > 0 ? 'border-t border-border-default' : ''}`}
                >
                  <View className="flex-row items-center justify-between gap-4">
                    <Text className="font-inter-semibold text-body text-text-primary">
                      {reasonLabel(report.reason)}
                    </Text>
                    <Text className="font-inter text-caption text-text-secondary">
                      {formatDateTime(report.reportedAt)}
                    </Text>
                  </View>
                  {report.comment && <Text className="font-inter text-body text-text-primary">{report.comment}</Text>}
                  <View className="flex-row items-center gap-1.5">
                    <Text className="font-inter text-caption text-text-secondary">Від</Text>
                    <Person person={report.reporter} />
                  </View>
                </View>
              ))}
            </Card>
          </View>
        </>
      ) : (
        <LoadState failure={found.failure} onRetry={found.reload} />
      )}

      <ConfirmDialog
        visible={!!action}
        title={action ? actions[action].title : ''}
        text={action ? actions[action].text : ''}
        confirmLabel={action ? actions[action].label : ''}
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        onClose={close}
      />
    </>
  );
}
