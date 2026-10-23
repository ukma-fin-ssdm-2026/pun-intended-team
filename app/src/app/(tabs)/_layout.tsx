// Written with the help of Claude
// AI Usage: tab navigator with the Figma tab bar; reviewed by Daryna Halytska.
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { View } from 'react-native';

import { TabBar, type TabName } from '@/components/ui/tab-bar';
import { tabBarSafeArea } from '@/components/ui/tab-bar-shape';
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

// A guest can browse events and the map; these tabs ask to sign in first (02.2).
const signedInTabs: TabName[] = ['matches', 'announcements', 'profile'];

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
  return (
    <Tabs tabBar={(props) => <NearbyTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="matches" />
      <Tabs.Screen name="announcements" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
