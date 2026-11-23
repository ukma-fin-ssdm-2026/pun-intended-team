// Written with the help of Claude
import { useLocalSearchParams } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { getOrganization } from '@/api/admin';
import { BackLink, Fact, FactLink, Section, useLocalListState } from '@/components/admin/admin-list';
import { organizationStatusBadges } from '@/components/admin/admin-labels';
import { EventsList, VenuesList } from '@/components/admin/admin-tables';
import { Badge, Card, LoadState, PageHeader } from '@/components/admin/admin-ui';
import { useOrganizationDecision } from '@/components/admin/organization-decision';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';

export default function AdminOrganizationDetails() {
  const { accountId } = useLocalSearchParams<{ accountId: string }>();
  const found = useApiQuery(`organization:${accountId}`, () => getOrganization(accountId));
  const { decide, dialog } = useOrganizationDecision(found.reload);
  const venues = useLocalListState();
  const events = useLocalListState();
  const item = found.data;

  return (
    <>
      <BackLink href="/admin/organizations" label="Усі організації" />

      {item ? (
        <>
          <PageHeader title={item.name} note={item.description ?? undefined}>
            {item.verificationStatus === 'pending' && (
              <View className="flex-row gap-3">
                <Button
                  label="Відхилити"
                  variant="light"
                  onPress={() => decide({ accountId, name: item.name, decision: 'reject' })}
                />
                <Button
                  label="Підтвердити"
                  onPress={() => decide({ accountId, name: item.name, decision: 'approve' })}
                />
              </View>
            )}
          </PageHeader>

          <Card className="flex-row flex-wrap gap-10 px-6 py-5">
            <Fact label="Статус">
              <Badge
                label={organizationStatusBadges[item.verificationStatus].label}
                tone={organizationStatusBadges[item.verificationStatus].tone}
              />
            </Fact>
            <Fact label="Акаунт">
              <FactLink
                href={{ pathname: '/admin/users/[id]', params: { id: accountId } }}
                label={item.account.username ? `@${item.account.username}` : 'Без профілю'}
              />
            </Fact>
            {item.verifiedAt && <Fact label="Підтверджено">{formatDateTime(item.verifiedAt)}</Fact>}
            {item.officialLink && (
              <Fact label="Офіційний сайт">
                <Text
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(item.officialLink ?? '')}
                  className="font-inter-medium text-body text-brand-coral"
                >
                  {item.officialLink}
                </Text>
              </Fact>
            )}
          </Card>

          <Section title="Місця">
            <VenuesList control={venues} organizationId={accountId} />
          </Section>

          <Section title="Події">
            <EventsList control={events} fixed={{ organizationId: accountId }} />
          </Section>
        </>
      ) : (
        <LoadState failure={found.failure} onRetry={found.reload} />
      )}

      {dialog}
    </>
  );
}
