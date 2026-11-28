// Written with the help of Claude
// AI Usage: font loading, global styles, the session restore, the tab group and the guest dialog in the root layout;
// reviewed by Daryna Halytska.
import '../../global.css';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { OtomanopeeOne_400Regular } from '@expo-google-fonts/otomanopee-one';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { restoreSession } from '@/api/session';
import { DesktopShell } from '@/components/desktop/desktop-shell';
import { GuestDialog } from '@/components/guest-dialog';
import { useBlurOnNavigate } from '@/hooks/use-blur-on-navigate';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { closeGuestDialog, useSession } from '@/state/session';

export default function RootLayout() {
  const { guestDialogOpen, restored } = useSession();
  const isDesktop = useIsDesktop();
  useBlurOnNavigate();
  useEffect(() => {
    void restoreSession();
  }, []);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    OtomanopeeOne_400Regular,
  });

  // The splash screen stays up until the fonts are ready, so text never renders in the fallback font first, and until the
  // stored session is read, so the first screen is the right one.
  if (!fontsLoaded || !restored) return null;

  // The matching and system state screens open with the prototype's 250 ms dissolve.
  const dissolve = { headerShown: false, animation: 'fade', animationDuration: 250 } as const;
  // DД2.1: on a desktop the place screens are dialogs over the page they were opened from.
  const placeDialog = isDesktop ? ({ ...dissolve, presentation: 'transparentModal' } as const) : dissolve;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <DesktopShell>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="events/[id]/index" options={{ headerShown: false }} />
          <Stack.Screen name="events/[id]/search" options={dissolve} />
          <Stack.Screen name="proposal" options={dissolve} />
          <Stack.Screen name="mutual" options={dissolve} />
          <Stack.Screen name="organization" options={{ headerShown: false, title: 'Nearby · Кабінет організації' }} />
          <Stack.Screen name="offline" options={dissolve} />
          <Stack.Screen name="update" options={dissolve} />
          <Stack.Screen name="too-many-attempts" options={dissolve} />
          <Stack.Screen name="organizers/[id]" options={dissolve} />
          <Stack.Screen name="post-place" options={placeDialog} />
          <Stack.Screen name="listing-place" options={placeDialog} />
          <Stack.Screen name="admin" options={{ headerShown: false, title: 'Nearby · Адмін-панель' }} />
        </Stack>
      </DesktopShell>
      {/* Opened by the tabs a guest cannot use; the event page has its own, which goes back when closed. */}
      <GuestDialog visible={guestDialogOpen} onClose={closeGuestDialog} onLeave={closeGuestDialog} />
    </GestureHandlerRootView>
  );
}
