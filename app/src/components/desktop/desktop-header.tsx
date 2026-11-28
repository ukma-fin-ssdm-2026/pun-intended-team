// Written with the help of Claude
// AI Usage: "Desktop / Шапка" from the Figma desktop frames, with the guest's "Увійти" of the "Гість" catalog frame;
// reviewed by Daryna Halytska.
import { useRouter, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { loadNotifications } from '@/api/notifications';
import { ApiPicture } from '@/components/pictures/picture';
import { Icon } from '@/components/ui/icon';
import { signedInTabs, tabs, type TabName } from '@/components/ui/tab-bar';
import { useProfile } from '@/hooks/use-profile';
import { unreadCount, useNotificationsState } from '@/state/notifications';
import { openGuestDialog, useSession } from '@/state/session';
import { colors, desktop } from '@/styles/tokens';

export type DesktopSection = TabName | 'none';

const tabHrefs: Record<TabName, Href> = {
  events: '/',
  map: '/map',
  matches: '/matches',
  announcements: '/announcements',
  profile: '/profile',
};

// The header has no Профіль item: the avatar opens the profile.
const navigation = tabs.filter((tab) => tab.name !== 'profile');

type Props = {
  active: DesktopSection;
  // Over the catalog hero and the full-screen gradients the header has no fill of its own.
  transparent?: boolean;
};

export function DesktopHeader({ active, transparent = false }: Props) {
  const router = useRouter();
  const { isGuest, signedIn } = useSession();
  const profile = useProfile();
  const inbox = useNotificationsState();
  const hasUnread = inbox.status === 'loaded' && unreadCount(inbox.notifications) > 0;

  useEffect(() => {
    if (signedIn) void loadNotifications();
  }, [signedIn]);

  // The same rules as the tab bar: a guest is asked to sign in before the tabs that need an account.
  const open = (tab: TabName) => {
    if (isGuest && signedInTabs.includes(tab)) {
      openGuestDialog();
      return;
    }
    router.navigate(tabHrefs[tab]);
  };

  const photo = profile.data?.photo;
  const initial = profile.data?.displayName.trim().charAt(0).toUpperCase();

  return (
    <View
      accessibilityRole="header"
      className={`flex-row items-center justify-between px-12 ${transparent ? '' : 'bg-brand-ink'}`}
      style={{ height: desktop.headerHeight }}
    >
      <Pressable accessibilityRole="link" accessibilityLabel="Події" onPress={() => open('events')}>
        <Text className="font-logo text-logo text-text-on-dark">Nearby</Text>
      </Pressable>

      <View accessibilityRole="tablist" className="flex-row gap-1">
        {navigation.map((tab) => {
          const selected = tab.name === active;
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => open(tab.name)}
              className={`group flex-row items-center gap-2 rounded-full px-[18px] py-2.5 ${
                selected ? 'bg-brand-coral' : 'hover:bg-white/10'
              }`}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={selected ? colors.text['on-dark'] : colors.text['on-dark-muted']}
              />
              <Text
                className={`font-inter-medium text-body ${
                  selected ? 'text-text-on-dark' : 'text-text-on-dark-muted group-hover:text-text-on-dark'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {signedIn ? (
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={hasUnread ? 'Сповіщення, є нові' : 'Сповіщення'}
            onPress={() => router.navigate('/notifications')}
            className="size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          >
            <Icon name="bell" size={20} color={colors.text['on-dark']} />
            {hasUnread && <View className="absolute right-3 top-2.5 size-2 rounded-full bg-brand-coral" />}
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Профіль"
            accessibilityState={{ selected: active === 'profile' }}
            onPress={() => open('profile')}
            className={`size-11 items-center justify-center overflow-hidden rounded-full bg-brand-coral-soft ${
              active === 'profile' ? 'border-2 border-brand-coral' : ''
            }`}
          >
            {photo ? (
              <ApiPicture image={photo} />
            ) : initial ? (
              <Text className="font-inter-semibold text-[17px] text-brand-coral">{initial}</Text>
            ) : (
              <Icon name="user" size={20} color={colors.brand.coral} />
            )}
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={openGuestDialog}
          className="h-11 items-center justify-center rounded-full bg-surface-card px-6 hover:bg-border-default"
        >
          <Text className="font-inter-semibold text-button-sm text-text-primary">Увійти</Text>
        </Pressable>
      )}
    </View>
  );
}
