// Written with the help of Claude
// AI Usage: tab navigator with the Figma tab bar; reviewed by Daryna Halytska.
import { Redirect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Platform, View } from 'react-native';

import { signedInTabs, TabBar, type TabName } from '@/components/ui/tab-bar';
import { tabBarSafeArea } from '@/components/ui/tab-bar-shape';
import { accountHome, useAccountKind } from '@/hooks/use-account-kind';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useProfile } from '@/hooks/use-profile';
import { isOrganizationSignUp } from '@/state/google-registration';
import { openGuestDialog, useSession } from '@/state/session';

// Route file of each tab; the catalog is the app's start screen, so it is `index`.
const tabRoutes: Record<TabName, string> = {
  events: 'index',
  map: 'map',
  matches: 'matches',
  announcements: 'announcements',
  profile: 'profile',
};

const routeTabs = Object.fromEntries(Object.entries(tabRoutes).map(([tab, route]) => [route, tab as TabName]));

function NearbyTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const { isGuest } = useSession();
  const current = state.routes[state.index];

  const onTabPress = (tab: TabName) => {
    if (isGuest && signedInTabs.includes(tab)) {
      openGuestDialog();
      return;
    }
    const route = state.routes.find((item) => item.name === tabRoutes[tab]);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (route.key !== current.key && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  // The bar floats over the screen, as in Figma: content scrolls under the notch and the raised active circle. Its own
  // shape reaches the bottom edge, so there is no separate strip and no seam under it.
  return (
    <View className="absolute bottom-0 left-0 right-0">
      <TabBar
        active={routeTabs[current.name] ?? 'events'}
        onTabPress={onTabPress}
        bottomPadding={tabBarSafeArea(insets.bottom)}
      />
    </View>
  );
}

export default function TabsLayout() {
  const { signedIn, isGuest } = useSession();
  const profile = useProfile();
  const kind = useAccountKind();
  const isDesktop = useIsDesktop();
  // Without an account or the guest choice, the app opens on the onboarding (В1).
  if (!signedIn && !isGuest) return <Redirect href="/onboarding" />;
  if (signedIn) {
    // Nothing until the account's kind is known, so an organization or an administrator never sees the app first.
    if (!kind) return <View className="flex-1 bg-surface-background" />;
    const home = accountHome(kind, Platform.OS === 'web');
    if (home) return <Redirect href={home} />;
  }
  // An account that left before finishing В7, or before an organization's first request, and signed in again later.
  if (profile.missing) return <Redirect href={isOrganizationSignUp() ? '/organization/settings' : '/profile-setup'} />;
  // One that left on В8: a mutual match needs a social network to reveal.
  if (profile.data?.linkedAccounts.length === 0) return <Redirect href="/profile-contacts" />;

  return (
    // On a desktop the header of the desktop shell takes the tab bar's place.
    <Tabs tabBar={(props) => (isDesktop ? null : <NearbyTabBar {...props} />)} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="matches" />
      <Tabs.Screen name="announcements" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
