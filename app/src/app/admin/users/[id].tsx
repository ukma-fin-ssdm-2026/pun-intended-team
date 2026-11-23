// Written with the help of Claude
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { getAccount } from '@/api/admin';
import { BackLink, Fact, FactLink, Section } from '@/components/admin/admin-list';
import {
  accountStatusBadges,
  organizationStatusBadges,
  roleLabels,
  signInLabels,
} from '@/components/admin/admin-labels';
import { Badge, Card, LoadState, PageHeader } from '@/components/admin/admin-ui';
import { ApiPicture } from '@/components/pictures/picture';
import { formatDateTime } from '@/dates';
import { useApiQuery } from '@/hooks/use-api-query';

export default function AdminUserDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = useApiQuery(`account:${id}`, () => getAccount(id));
  const item = found.data;

  return (
    <>
      {item?.role === 'admin' ? (
        <BackLink href="/admin/admins" label="Усі адміністратори" />
      ) : (
        <BackLink href="/admin/users" label="Усі користувачі" />
      )}

      {item ? (
        <>
          <PageHeader
            title={item.profile?.displayName ?? 'Без профілю'}
            note={item.profile ? `@${item.profile.username}` : undefined}
          />

          <Card className="flex-row flex-wrap gap-10 px-6 py-5">
            <Fact label="Статус">
              <Badge label={accountStatusBadges[item.status].label} tone={accountStatusBadges[item.status].tone} />
            </Fact>
            <Fact label="Роль">{roleLabels[item.role]}</Fact>
            <Fact label="Вік">{item.age === null ? '–' : String(item.age)}</Fact>
            <Fact label="Вхід">{item.signInMethods.map((method) => signInLabels[method]).join(', ') || '–'}</Fact>
            <Fact label="Зареєстровано">{formatDateTime(item.createdAt)}</Fact>
            <Fact label="Id">
              <Text selectable className="font-inter text-caption text-text-primary">
                {item.id}
              </Text>
            </Fact>
          </Card>

          <Section title="Профіль">
            {item.profile ? (
              <Card className="flex-row gap-6 px-6 py-5">
                {item.profile.photo && (
                  <View className="h-24 w-24 overflow-hidden rounded-full">
                    <ApiPicture image={item.profile.photo} />
                  </View>
                )}
                <View className="flex-1 gap-4">
                  <Fact label="Про себе">{item.profile.description || '–'}</Fact>
                  <Fact label="Чим займається">{item.profile.occupation || '–'}</Fact>
                  <Fact label="Інтереси">
                    {item.profile.interests.length === 0 ? (
                      '–'
                    ) : (
                      <View className="flex-row flex-wrap gap-2">
                        {item.profile.interests.map((interest) => (
                          <Badge key={interest.id} label={interest.name} tone="muted" />
                        ))}
                      </View>
                    )}
                  </Fact>
                </View>
              </Card>
            ) : (
              <Card className="px-6 py-5">
                <Text className="font-inter text-body text-text-secondary">Немає профілю.</Text>
              </Card>
            )}
          </Section>

          {item.organization && (
            <Section title="Організація">
              <Card className="flex-row flex-wrap gap-10 px-6 py-5">
                <Fact label="Назва">
                  <FactLink
                    href={{ pathname: '/admin/organizations/[accountId]', params: { accountId: item.id } }}
                    label={item.organization.name}
                  />
                </Fact>
                <Fact label="Статус">
                  <Badge
                    label={organizationStatusBadges[item.organization.verificationStatus].label}
                    tone={organizationStatusBadges[item.organization.verificationStatus].tone}
                  />
                </Fact>
              </Card>
            </Section>
          )}
        </>
      ) : (
        <LoadState failure={found.failure} onRetry={found.reload} />
      )}
    </>
  );
}
