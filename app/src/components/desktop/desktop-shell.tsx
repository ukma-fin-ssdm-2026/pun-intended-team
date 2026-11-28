// Written with the help of Claude
// AI Usage: the frame of the Figma desktop screens: the "Desktop / Шапка" header in place of the tab bar and the
// centered columns; reviewed by Daryna Halytska.
import { useSegments } from 'expo-router';
import { createContext, useContext, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { DesktopHeader, type DesktopSection } from '@/components/desktop/desktop-header';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { desktop } from '@/styles/tokens';

// header: the ink header above the screen. overlay: a header without fill over a screen that fills the window with its
// gradient. own: the screen draws the header itself (the catalog, where it scrolls away with the hero). none: no header.
type HeaderMode = 'header' | 'overlay' | 'own' | 'none';

type RouteLayout = { header: HeaderMode; active?: DesktopSection; column?: number };

// Narrow screens of the phone frames sit in a centered column as wide as their desktop frame.
const NOTIFICATIONS_COLUMN = 760;

// Route (Expo Router segments joined with "/") → desktop layout. A route that is not listed has no header: the
// onboarding and sign-up screens, the organization area and the admin panel have their own.
const routes: Record<string, RouteLayout> = {
  '(tabs)': { header: 'own', active: 'events' },
  '(tabs)/index': { header: 'own', active: 'events' },
  '(tabs)/map': { header: 'header', active: 'map' },
  '(tabs)/matches': { header: 'header', active: 'matches' },
  '(tabs)/announcements': { header: 'header', active: 'announcements' },
  '(tabs)/profile': { header: 'header', active: 'profile' },
  'events/[id]': { header: 'header', active: 'events' },
  'events/[id]/index': { header: 'header', active: 'events' },
  'events/[id]/search': { header: 'header', active: 'matches' },
  'organizers/[id]': { header: 'header', active: 'events' },
  proposal: { header: 'overlay', active: 'matches' },
  mutual: { header: 'header', active: 'matches' },
  notifications: { header: 'header', active: 'none', column: NOTIFICATIONS_COLUMN },
  'profile-edit': { header: 'header', active: 'profile' },
  'post-place': { header: 'header', active: 'announcements' },
  'listing-place': { header: 'header', active: 'announcements' },
  offline: { header: 'overlay', active: 'none' },
  update: { header: 'overlay', active: 'none' },
};

const ShellContext = createContext<{ header: HeaderMode }>({ header: 'none' });

// The space a screen under an overlay header leaves at its top; 0 on phones and with any other header.
export function useDesktopHeaderInset(): number {
  return useContext(ShellContext).header === 'overlay' ? desktop.headerHeight : 0;
}

// Wraps the root stack. The stack always stays at the same place in the tree, so crossing the breakpoint or moving
// between screens never remounts it and no screen loses its state.
export function DesktopShell({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();
  const segments = useSegments();
  if (Platform.OS !== 'web') return <>{children}</>;

  const layout: RouteLayout = (isDesktop && routes[segments.join('/')]) || { header: 'none' };
  const active = layout.active ?? 'none';

  return (
    <ShellContext.Provider value={{ header: layout.header }}>
      <View className="flex-1 bg-surface-background">
        {layout.header === 'header' ? <DesktopHeader active={active} /> : null}
        <View style={{ flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center' }}>{children}</View>
        {layout.header === 'overlay' ? (
          <View className="absolute left-0 right-0 top-0">
            <DesktopHeader active={active} transparent />
          </View>
        ) : null}
      </View>
    </ShellContext.Provider>
  );
}
