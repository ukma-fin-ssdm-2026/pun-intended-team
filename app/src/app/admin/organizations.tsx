// Written with the help of Claude
// The organization requests page has no Figma frame; it follows the other admin pages.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import {
  approveOrganization,
  CASES_PAGE_SIZE,
  listOrganizations,
  rejectOrganization,
  type AdminOrganization,
} from '@/api/admin';
import { Badge, Card, ConfirmDialog, failureText, LoadState, PageHeader } from '@/components/admin/admin-ui';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';

type Decision = 'approve' | 'reject';

const statusBadges: Record<
  AdminOrganization['verificationStatus'],
  { label: string; tone: 'coral' | 'muted' | 'green' }
> = {
  pending: { label: 'Очікує', tone: 'coral' },
  verified: { label: 'Підтверджено', tone: 'green' },
  rejected: { label: 'Відхилено', tone: 'muted' },
  revoked: { label: 'Відкликано', tone: 'muted' },
};

const decisions: Record<Decision, { run: typeof approveOrganization; title: string; text: string; label: string }> = {
  approve: {
    run: approveOrganization,
    title: 'Підтвердити організацію?',
    text: 'Організація зможе публікувати події.',
    label: 'Підтвердити',
  },
  reject: {
    run: rejectOrganization,
    title: 'Відхилити заявку?',
    text: 'Організація не зможе публікувати події, але зможе надіслати заявку ще раз.',
    label: 'Відхилити',
  },
};

function RequestRow({ item, onDecide }: { item: AdminOrganization; onDecide: (decision: Decision) => void }) {
  const badge = statusBadges[item.verificationStatus];
  return (
    <View className="gap-3 border-t border-border-default px-6 py-5">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1 gap-1">
          <Text className="font-inter-semibold text-body text-text-primary">{item.name}</Text>
          <Text className="font-inter text-caption text-text-secondary">
            {item.account.username ? `@${item.account.username}` : item.accountId}
          </Text>
        </View>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
      {item.description && <Text className="font-inter text-body text-text-primary">{item.description}</Text>}
      {item.officialLink && (
        <Text
          accessibilityRole="link"
          onPress={() => void Linking.openURL(item.officialLink ?? '')}
          className="self-start font-inter-medium text-label text-brand-coral"
        >
          {item.officialLink}
        </Text>
      )}
      {item.verificationStatus === 'pending' && (
        <View className="flex-row gap-3">
          <Button label="Відхилити" size="sm" variant="light" onPress={() => onDecide('reject')} />
          <Button label="Підтвердити" size="sm" onPress={() => onDecide('approve')} />
        </View>
      )}
    </View>
  );
}

export default function AdminOrganizations() {
  const router = useRouter();
  const params = useLocalSearchParams<{ offset?: string }>();
  const offset = Math.max(0, Number(params.offset) || 0);
  const requests = useApiQuery(`organizations:${offset}`, () => listOrganizations(offset));
  const [pending, setPending] = useState<{ item: AdminOrganization; decision: Decision }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const close = () => {
    setPending(undefined);
    setError(undefined);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    setError(undefined);
    const result = await decisions[pending.decision].run(pending.item.accountId);
    setBusy(false);
    if (result.ok) {
      requests.reload();
      close();
    } else if (result.code === 'CANNOT_DECIDE_OWN_REQUEST') {
      setError('Твою заявку має розглянути інший адміністратор.');
    } else if (result.status === 409) {
      setError('Цю заявку вже розглянули.');
      requests.reload();
    } else {
      setError(failureText(result));
    }
  };

  return (
    <>
      <PageHeader title="Організації" note="Заявки на статус організації: спершу ті, що очікують рішення." />

      <Card>
        {requests.data ? (
          requests.data.items.length === 0 ? (
            <Text className="px-6 py-10 text-center font-inter text-body text-text-secondary">Заявок поки немає.</Text>
          ) : (
            requests.data.items.map((item) => (
              <RequestRow key={item.accountId} item={item} onDecide={(decision) => setPending({ item, decision })} />
            ))
          )
        ) : (
          <LoadState failure={requests.failure} onRetry={requests.reload} />
        )}
      </Card>

      {requests.data && (offset > 0 || requests.data.page.hasMore) && (
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
            disabled={!requests.data.page.hasMore}
            onPress={() => router.setParams({ offset: String(offset + CASES_PAGE_SIZE) })}
          />
        </View>
      )}

      <ConfirmDialog
        visible={!!pending}
        title={pending ? decisions[pending.decision].title : ''}
        text={pending ? `${pending.item.name}. ${decisions[pending.decision].text}` : ''}
        confirmLabel={pending ? decisions[pending.decision].label : ''}
        busy={busy}
        error={error}
        onConfirm={() => void confirm()}
        onClose={close}
      />
    </>
  );
}
