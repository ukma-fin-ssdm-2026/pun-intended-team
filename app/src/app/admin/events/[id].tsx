// Written with the help of Claude
import { useLocalSearchParams } from 'expo-router';
import { Linking, Text } from 'react-native';

import { getAdminEvent } from '@/api/admin';
import { BackLink, Fact, FactLink, Section } from '@/components/admin/admin-list';
import { eventStatusBadges, sourceLabels } from '@/components/admin/admin-labels';
import { Badge, Card, LoadState, PageHeader } from '@/components/admin/admin-ui';
import { formatEventDate } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';

export default function AdminEventDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = useApiQuery(`event:${id}`, () => getAdminEvent(id));
  const item = found.data;

  return (
    <>
      <BackLink href="/admin/events" label="Усі події" />

      {item ? (
        <>
          <PageHeader title={item.title} note={item.category.name} />

          <Card className="flex-row flex-wrap gap-10 px-6 py-5">
            <Fact label="Статус">
              <Badge label={eventStatusBadges[item.status].label} tone={eventStatusBadges[item.status].tone} />
            </Fact>
            <Fact label="Початок">{formatEventDate(item.startsAt, item.startTimeKnown)}</Fact>
            {item.endTimeKnown && <Fact label="Кінець">{formatEventDate(item.endsAt)}</Fact>}
            <Fact label="Місце">
              <FactLink
                href={{ pathname: '/admin/venues/[id]', params: { id: item.venue.id } }}
                label={item.venue.name}
              />
            </Fact>
            <Fact label="Додав">
              {item.organization ? (
                <FactLink
                  href={{
                    pathname: '/admin/organizations/[accountId]',
                    params: { accountId: item.organization.accountId },
                  }}
                  label={item.organization.name}
                />
              ) : (
                sourceLabels[item.source]
              )}
            </Fact>
            {item.sourceUrl && (
              <Fact label="Сторінка у джерелі">
                <Text
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(item.sourceUrl ?? '')}
                  className="font-inter-medium text-body text-brand-coral"
                >
                  Відкрити
                </Text>
              </Fact>
            )}
          </Card>

          <Section title="Опис">
            <Card className="px-6 py-5">
              <Text className="font-inter text-body text-text-primary">{item.description || 'Без опису.'}</Text>
            </Card>
          </Section>
        </>
      ) : (
        <LoadState failure={found.failure} onRetry={found.reload} />
      )}
    </>
  );
}
