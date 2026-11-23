// Written with the help of Claude
import { useLocalSearchParams } from 'expo-router';
import { Linking, Text } from 'react-native';

import { getAdminVenue } from '@/api/admin';
import { BackLink, Fact, FactLink, Section, useLocalListState } from '@/components/admin/admin-list';
import { sourceLabels } from '@/components/admin/admin-labels';
import { EventsList } from '@/components/admin/admin-tables';
import { Card, LoadState, PageHeader } from '@/components/admin/admin-ui';
import { useApiQuery } from '@/hooks/use-api-query';

export default function AdminVenueDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = useApiQuery(`venue:${id}`, () => getAdminVenue(id));
  const events = useLocalListState();
  const item = found.data;

  return (
    <>
      <BackLink href="/admin/venues" label="Усі місця" />

      {item ? (
        <>
          <PageHeader title={item.name} note={item.address} />

          <Card className="flex-row flex-wrap gap-10 px-6 py-5">
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
            <Fact label="Координати">
              <Text
                accessibilityRole="link"
                onPress={() =>
                  void Linking.openURL(
                    `https://www.openstreetmap.org/?mlat=${item.location.lat}&mlon=${item.location.lng}#map=17/${item.location.lat}/${item.location.lng}`,
                  )
                }
                className="font-inter-medium text-body text-brand-coral"
              >
                {`${item.location.lat}, ${item.location.lng}`}
              </Text>
            </Fact>
          </Card>

          <Section title="Події">
            <EventsList control={events} fixed={{ venueId: id }} />
          </Section>
        </>
      ) : (
        <LoadState failure={found.failure} onRetry={found.reload} />
      )}
    </>
  );
}
