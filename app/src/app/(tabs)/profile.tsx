// Written with the help of Claude
// AI Usage: Профіль tab from the Figma "Т4 Профіль" frame with the "П5 Вийти з акаунта" dialog, on mock data; reviewed
// by Daryna Halytska.
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

// Used by LinkGoogle below, hidden while sign-in is Google-only (ADR-004); it also needs useCallback from react.
// import { apiClient } from '@/api/client';
// import { call } from '@/api/public-client';
// import { failureMessage } from '@/auth/messages';
// import { GoogleButton } from '@/components/auth/google-button';
import { signOut } from '@/api/session';
import { SignOutDialog } from '@/components/sign-out-dialog';
import { EventCard } from '@/components/ui/event-card';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { BAR_HEIGHT, tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { formatEventDate } from '@/dates';
import { useProfile } from '@/hooks/use-profile';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent, type MockEvent } from '@/mocks/events';
import { mockProfile } from '@/mocks/profile';
import { toggleFavorite, useFavoriteIds } from '@/state/favorites';
import { colors } from '@/styles/tokens';

// "01.1 Обкладинка": 200 px high with a 56 px top padding (9 px below the iPhone 14 status bar); the avatar overlaps its
// bottom 46 px. The page keeps 120 px under it for the tab bar.
const COVER_HEIGHT = 200;
const COVER_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const AVATAR_OVERLAP = 46;
const LIST_BOTTOM_GAP = 26;

// "Затемнення": black at 35% fading out by 60% of the cover.
function CoverShade() {
  return (
    <Svg width="100%" height={COVER_HEIGHT} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <Defs>
        <LinearGradient id="profile-cover-shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset={0} stopColor="#000" stopOpacity={0.35} />
          <Stop offset={0.6} stopColor="#000" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#profile-cover-shade)" />
    </Svg>
  );
}

// "3 збережені події", "1 збережена подія", "5 збережених подій".
function savedLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo < 11 || lastTwo > 14) {
    if (last === 1) return `${count} збережена подія`;
    if (last >= 2 && last <= 4) return `${count} збережені події`;
  }
  return `${count} збережених подій`;
}

const profileTabs = [
  { key: 'about', label: 'Про мене' },
  { key: 'saved', label: 'Збережені' },
] as const;

type ProfileTab = (typeof profileTabs)[number]['key'];

// "03 Вкладки профілю" of Т4 and П6.
function ProfileTabs({ active, onSelect }: { active: ProfileTab; onSelect: (tab: ProfileTab) => void }) {
  return (
    <View accessibilityRole="tablist" className="h-11 flex-row items-end border-b border-border-default">
      {profileTabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(tab.key)}
            className="flex-1 items-center gap-2"
          >
            <Text className={`font-inter-medium text-label ${selected ? 'text-text-primary' : 'text-text-secondary'}`}>
              {tab.label}
            </Text>
            <View className={`h-[3px] w-14 rounded-sm ${selected ? 'bg-brand-coral' : ''}`} />
          </Pressable>
        );
      })}
    </View>
  );
}

function SavedEvents({ events, onOpen }: { events: MockEvent[]; onOpen: (id: string) => void }) {
  return (
    <View className="gap-4 px-5 pt-4">
      <Text className="font-inter text-caption text-text-secondary">{savedLabel(events.length)}</Text>
      {events.map((event) => (
        <EventCard
          key={event.id}
          title={event.title}
          category={event.category.name}
          dateLabel={formatEventDate(event.startsAt)}
          place={event.venue.name}
          cover={event.cover}
          favorite
          onToggleFavorite={() => toggleFavorite(event.id)}
          // The button opens the event page too, as on the catalog cards.
          onPress={() => onOpen(event.id)}
        />
      ))}
    </View>
  );
}

// Hidden while sign-in is Google-only (ADR-004): every account signs up with Google, so there is nothing to link.
// const linkGoogleMessages: Record<string, string> = {
//   GOOGLE_ACCOUNT_TAKEN: 'Цей Google-акаунт уже прив’язаний до іншого профілю',
//   GOOGLE_ALREADY_LINKED: 'До профілю вже прив’язаний інший Google-акаунт',
// };
//
// // Not in Figma: links a Google account, which "Увійти через Google" on В4 then signs in with. Web build only.
// function LinkGoogle() {
//   const [message, setMessage] = useState<string>();
//   const link = useCallback(async (idToken: string) => {
//     const result = await call(() => apiClient.PUT('/api/v1/me/google', { body: { idToken } }));
//     setMessage(
//       result.ok
//         ? 'Google прив’язано: тепер можна входити через нього'
//         : ((result.code && linkGoogleMessages[result.code]) ?? failureMessage(result)),
//     );
//   }, []);
//
//   return (
//     <View className="items-center gap-2">
//       <GoogleButton text="continue_with" onIdToken={link} />
//       {message && <Text className="text-center font-inter text-caption text-text-secondary">{message}</Text>}
//     </View>
//   );
// }

function AboutCard({ profile }: Readonly<{ profile: ReturnType<typeof useProfile> }>) {
  if (profile.loading) {
    return (
      <View className="items-center py-6">
        <Spinner size="lg" color={colors.brand.coral} />
      </View>
    );
  }
  if (!profile.data) {
    return (
      <View className="items-center gap-2 py-6">
        <Text className="text-center font-inter text-body text-text-secondary">Не вдалося завантажити профіль</Text>
        <Pressable accessibilityRole="button" onPress={profile.reload} hitSlop={8}>
          <Text className="font-inter-semibold text-label text-brand-coral">Ще раз</Text>
        </Pressable>
      </View>
    );
  }
  const { description, interests } = profile.data;

  return (
    <View className="gap-2.5 overflow-hidden rounded-[20px] bg-surface-card px-4 py-3.5">
      {description ? (
        <>
          <View className="gap-2">
            <Text className="font-inter-medium text-label text-text-secondary">Про себе</Text>
            <Text className="font-inter text-body text-text-primary">{description}</Text>
          </View>
          <View className="h-px bg-border-default" />
        </>
      ) : null}
      <View className="gap-2">
        <Text className="font-inter-medium text-label text-text-secondary">Інтереси</Text>
        <View className="flex-row flex-wrap gap-1.5">
          {interests.map((interest) => (
            <View key={interest.id} className="rounded-[14px] bg-brand-ink px-3 py-1.5">
              <Text className="font-inter-semibold text-tag text-text-on-dark">{interest.name}</Text>
            </View>
          ))}
        </View>
      </View>
      {/* Hidden: the API has no field for Telegram yet.
      <View className="h-px bg-border-default" />
      <View className="gap-2">
        <Text className="font-inter-medium text-label text-text-secondary">Контакти для метчів</Text>
        <View className="flex-row items-center gap-2.5">
          <Icon name="contact-send" size={18} />
          <Text className="font-inter-medium text-body text-text-primary">{mockProfile.telegram}</Text>
        </View>
      </View> */}
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [signOutOpen, setSignOutOpen] = useState(false);
  // Т4 shows "Про мене", П6 "Збережені"; С1 opens П6 with `saved`.
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const [chosenTab, setChosenTab] = useState<ProfileTab>('about');
  const tab = saved === '1' ? 'saved' : chosenTab;
  const selectTab = (next: ProfileTab) => {
    setChosenTab(next);
    if (saved) router.setParams({ saved: undefined });
  };
  const savedEvents = useFavoriteIds()
    .map(findMockEvent)
    .filter((event): event is MockEvent => !!event);
  useStatusBarStyle('light');
  const profile = useProfile();

  return (
    <View className="flex-1 bg-surface-background">
      <ScrollView
        contentContainerStyle={{ paddingBottom: BAR_HEIGHT + tabBarSafeArea(insets.bottom) + LIST_BOTTOM_GAP }}
      >
        <View
          className="flex-row items-start justify-between overflow-hidden px-5"
          style={{
            height: COVER_HEIGHT,
            paddingTop: Math.max(COVER_TOP, insets.top + GAP_BELOW_STATUS_BAR),
            marginBottom: -AVATAR_OVERLAP,
          }}
        >
          <View className="absolute inset-0">
            <Image source={mockProfile.cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          </View>
          <CoverShade />
          <Text accessibilityRole="header" className="font-inter-semibold text-title text-text-on-dark">
            Мій профіль
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Редагувати"
            onPress={() => router.push('/profile-edit')}
            className="size-10 items-center justify-center rounded-[20px] bg-white/[0.16]"
          >
            <Icon name="gallery-edit" size={20} color={colors.text['on-dark']} />
          </Pressable>
        </View>

        <View className="pl-5">
          <View className="size-[92px] items-center justify-center rounded-full border-4 border-surface-background bg-surface-card">
            <Text className="font-inter-semibold text-title text-text-secondary">
              {profile.data?.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        <View className="gap-3 px-5 pt-3.5">
          {profile.data && (
            <View className="gap-0.5">
              <Text className="font-inter-bold text-h1 text-text-primary">
                {profile.data.displayName}, {profile.data.age}
              </Text>
              <Text className="font-inter text-caption text-text-secondary">@{profile.data.username}</Text>
            </View>
          )}
          <ProfileTabs active={tab} onSelect={selectTab} />
          {tab === 'about' && <AboutCard profile={profile} />}
        </View>

        {tab === 'about' ? (
          <View className="items-center gap-4 px-5 pt-2.5">
            <Pressable accessibilityRole="button" onPress={() => setSignOutOpen(true)} hitSlop={8}>
              <Text className="font-inter-medium text-label text-brand-coral">Вийти з акаунта</Text>
            </Pressable>
          </View>
        ) : (
          <SavedEvents
            events={savedEvents}
            onOpen={(id) => router.push({ pathname: '/events/[id]', params: { id } })}
          />
        )}
      </ScrollView>

      <SignOutDialog
        visible={signOutOpen}
        icon="user"
        note="Твої метчі, запити й контакти збережуться. Повернутися можна будь-коли."
        onClose={() => setSignOutOpen(false)}
        onSignOut={() => {
          setSignOutOpen(false);
          void signOut();
          // Signing out starts a new history on the onboarding, so back cannot return to the account.
          router.dismissAll();
          router.replace('/onboarding');
        }}
      />
    </View>
  );
}
