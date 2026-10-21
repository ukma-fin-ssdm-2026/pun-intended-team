// Written with the help of Claude
// AI Usage: Профіль tab from the Figma "Т4 Профіль" frame with the "П5 Вийти з акаунта" dialog, on mock data; reviewed
// by Daryna Halytska.
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Button } from '@/components/ui/button';
import { EventCard } from '@/components/ui/event-card';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { BAR_HEIGHT, tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { formatEventDate } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent, type MockEvent } from '@/mocks/events';
import { mockProfile } from '@/mocks/profile';
import { toggleFavorite, useFavoriteIds } from '@/state/favorites';
import { colors, shadows } from '@/styles/tokens';

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

function SignOutDialog({
  visible,
  onClose,
  onSignOut,
}: {
  visible: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <Overlay visible={visible} onClose={onClose} placement="center">
      <View
        accessibilityViewIsModal
        className="gap-5 rounded-[28px] bg-surface-card px-5 pb-5 pt-7"
        style={{ boxShadow: shadows.medium }}
      >
        <View className="items-center gap-2.5">
          <View className="size-14 items-center justify-center rounded-full bg-brand-coral">
            <Icon name="user" size={26} color={colors.text['on-dark']} />
          </View>
          <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
            Вийти з акаунта?
          </Text>
          <Text className="text-center font-inter text-caption text-text-secondary">
            Твої метчі, запити й контакти збережуться. Повернутися можна будь-коли.
          </Text>
        </View>
        <Button label="Вийти" variant="dark" onPress={onSignOut} />
        <Button label="Залишитися" variant="light" onPress={onClose} />
      </View>
    </Overlay>
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
            <Text className="font-inter-semibold text-title text-text-secondary">{mockProfile.initial}</Text>
          </View>
        </View>

        <View className="gap-3 px-5 pt-3.5">
          <View className="gap-0.5">
            <Text className="font-inter-bold text-h1 text-text-primary">{mockProfile.nameAge}</Text>
            <Text className="font-inter text-caption text-text-secondary">{mockProfile.occupation}</Text>
          </View>
          <ProfileTabs active={tab} onSelect={selectTab} />
          {tab === 'about' && (
            <View className="gap-2.5 overflow-hidden rounded-[20px] bg-surface-card px-4 py-3.5">
              <View className="gap-2">
                <Text className="font-inter-medium text-label text-text-secondary">Про себе</Text>
                <Text className="font-inter text-body text-text-primary">{mockProfile.about}</Text>
              </View>
              <View className="h-px bg-border-default" />
              <View className="gap-2">
                <Text className="font-inter-medium text-label text-text-secondary">Інтереси</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {mockProfile.interests.map((interest) => (
                    <View key={interest} className="rounded-[14px] bg-brand-ink px-3 py-1.5">
                      <Text className="font-inter-semibold text-tag text-text-on-dark">{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className="h-px bg-border-default" />
              <View className="gap-2">
                <Text className="font-inter-medium text-label text-text-secondary">Контакти для метчів</Text>
                <View className="gap-1.5">
                  <View className="flex-row items-center gap-2.5">
                    <Icon name="contact-send" size={18} />
                    <Text className="font-inter-medium text-body text-text-primary">{mockProfile.telegram}</Text>
                  </View>
                  <View className="flex-row items-center gap-2.5">
                    <Icon name="contact-phone" size={18} />
                    <Text className="font-inter-medium text-body text-text-primary">{mockProfile.phoneMasked}</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </View>

        {tab === 'about' ? (
          <View className="items-center px-5 pt-2.5">
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
        onClose={() => setSignOutOpen(false)}
        onSignOut={() => {
          setSignOutOpen(false);
          // Signing out starts a new history on the onboarding, so back cannot return to the account.
          router.dismissAll();
          router.replace('/onboarding');
        }}
      />
    </View>
  );
}
