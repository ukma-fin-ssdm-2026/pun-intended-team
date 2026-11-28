// Written with the help of Claude
// AI Usage: organizer page from the Figma "Сторінка організатора" frame; reviewed by Daryna Halytska. The loading,
// empty and failed states have no Figma frame and follow the event page's.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiPicture } from '@/components/pictures/picture';
import { Button } from '@/components/ui/button';
import { CardGrid } from '@/components/desktop/card-grid';
import { EventCard } from '@/components/ui/event-card';
import { coverOf } from '@/components/ui/event-cover';
import { Icon } from '@/components/ui/icon';
import { formatEventDate } from '@/dates';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useOrganization } from '@/hooks/use-organization';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { plural } from '@/plural';
import { toggleFavorite, useFavoriteIds } from '@/state/favorites';
import { colors, shadows } from '@/styles/tokens';

// "01 Навігація" starts 56 px from the top (9 px below the iPhone 14 status bar); "02 Організатор" has a 40 px bottom
// padding.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const CONTENT_BOTTOM = 40;

function LinkChip({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      className="rounded-[18px] bg-surface-background px-4 py-[9px] active:opacity-80"
    >
      <Text className="font-inter-medium text-label text-text-primary">{label}</Text>
    </Pressable>
  );
}

export default function OrganizerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const favoriteIds = useFavoriteIds();
  const { organization, events, loading, notFound, error, reload } = useOrganization(id);
  const isDesktop = useIsDesktop();
  useStatusBarStyle('dark');

  const openEvent = (eventId: string) => router.push({ pathname: '/events/[id]', params: { id: eventId } });
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const renderEvent = (event: NonNullable<typeof events>[number]) => (
    <EventCard
      key={event.id}
      title={event.title}
      category={event.category.name}
      dateLabel={formatEventDate(event.startsAt, event.startTimeKnown)}
      place={event.venue.name}
      cover={coverOf(event.imageUrl)}
      photo={event.photo}
      favorite={favoriteIds.includes(event.id)}
      onToggleFavorite={() => toggleFavorite(event.id)}
      // The button opens the event page too, as on the catalog cards.
      onPress={() => openEvent(event.id)}
    />
  );

  let body;
  if (loading) {
    body = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.coral} />
      </View>
    );
  } else if (!organization || !events) {
    body = (
      <View className="flex-1 items-center justify-center gap-4 px-5">
        <Text className="text-center font-inter-semibold text-title text-text-primary">
          {notFound || !error ? 'Організатора не знайдено' : 'Не вдалося завантажити організатора'}
        </Text>
        {!notFound && error && <Button label="Спробувати ще раз" variant="dark" onPress={reload} />}
        <Button label="До каталогу" variant="light" onPress={() => router.replace('/')} />
      </View>
    );
  } else if (isDesktop) {
    const info = (
      <>
        <View className="flex-row items-center gap-3.5">
          <View className="size-[72px] items-center justify-center overflow-hidden rounded-[36px] bg-brand-coral-soft">
            {organization.logo ? (
              <ApiPicture image={organization.logo} />
            ) : (
              <Icon name="building" size={32} color={colors.brand.coral} />
            )}
          </View>
          <View className="flex-1 gap-1">
            <Text className="font-inter-bold text-h1 text-text-primary">{organization.name}</Text>
            <Text className="font-inter text-caption text-text-secondary">Організація</Text>
          </View>
        </View>

        {organization.description ? (
          <Text className="font-inter text-body text-text-secondary">{organization.description}</Text>
        ) : null}

        {(organization.officialLink || organization.instagram) && (
          <View className="flex-row gap-2">
            {organization.officialLink && <LinkChip label="Сайт" url={organization.officialLink} />}
            {organization.instagram && (
              <LinkChip label="Instagram" url={`https://instagram.com/${organization.instagram}`} />
            )}
          </View>
        )}
      </>
    );
    const count = `${events.length} ${plural(events.length, ['подія', 'події', 'подій'])}`;
    // "Сторінка організатора": the organization in a card on the left, its events in the grid on the right.
    body = (
      <ScrollView>
        <View className="w-full max-w-[1440px] flex-row items-start gap-6 self-center px-[120px] pb-24 pt-10">
          <View className="w-[360px] gap-5 rounded-[28px] bg-surface-card p-5" style={{ boxShadow: shadows.small }}>
            {info}
          </View>
          <View className="flex-1 gap-6">
            <View className="flex-row items-center justify-between">
              <Text accessibilityRole="header" className="font-inter-bold text-desktop-h1 text-text-primary">
                Найближчі події
              </Text>
              <Text className="font-inter text-body text-text-secondary">{count}</Text>
            </View>
            {events.length === 0 ? (
              <Text className="py-6 text-center font-inter text-body text-text-secondary">Поки немає подій</Text>
            ) : (
              <CardGrid items={events} keyOf={(event) => event.id} render={renderEvent} />
            )}
          </View>
        </View>
      </ScrollView>
    );
  } else {
    const info = (
      <>
        <View className="flex-row items-center gap-3.5">
          <View className="size-[72px] items-center justify-center overflow-hidden rounded-[36px] bg-brand-coral-soft">
            {organization.logo ? (
              <ApiPicture image={organization.logo} />
            ) : (
              <Icon name="building" size={32} color={colors.brand.coral} />
            )}
          </View>
          <View className="flex-1 gap-1">
            <Text className="font-inter-bold text-h1 text-text-primary">{organization.name}</Text>
            <Text className="font-inter text-caption text-text-secondary">Організація</Text>
          </View>
        </View>

        {organization.description ? (
          <Text className="font-inter text-body text-text-secondary">{organization.description}</Text>
        ) : null}

        {(organization.officialLink || organization.instagram) && (
          <View className="flex-row gap-2">
            {organization.officialLink && <LinkChip label="Сайт" url={organization.officialLink} />}
            {organization.instagram && (
              <LinkChip label="Instagram" url={`https://instagram.com/${organization.instagram}`} />
            )}
          </View>
        )}
      </>
    );
    body = (
      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-2"
        contentContainerStyle={{ paddingBottom: Math.max(CONTENT_BOTTOM, insets.bottom) }}
      >
        {info}

        <View className="flex-row items-center justify-between">
          <Text className="font-inter-semibold text-title text-text-primary">Найближчі події</Text>
          <Text className="font-inter text-caption text-text-secondary">
            {`${events.length} ${plural(events.length, ['подія', 'події', 'подій'])}`}
          </Text>
        </View>

        {events.length === 0 ? (
          <Text className="py-6 text-center font-inter text-body text-text-secondary">Поки немає подій</Text>
        ) : (
          events.map(renderEvent)
        )}
      </ScrollView>
    );
  }

  return (
    <View className={`flex-1 ${isDesktop ? 'bg-surface-background' : 'bg-surface-card'}`}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* On a desktop the header leads back. */}
      {!isDesktop && (
        <View
          className="flex-row items-center justify-between px-5 pb-4"
          style={{ paddingTop: Math.max(NAV_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Назад"
            onPress={goBack}
            className="size-10 items-center justify-center rounded-[20px] bg-surface-background"
          >
            <Icon name="arrow-left" size={20} />
          </Pressable>
          <Text accessibilityRole="header" className="font-inter-semibold text-title text-text-primary">
            Організатор
          </Text>
          <View className="size-10" />
        </View>
      )}
      {body}
    </View>
  );
}
