// Written with the help of Claude
// AI Usage: font loading, global styles, the tab group and the guest dialog in the root layout; reviewed by Daryna
// Halytska.
import '../../global.css';

import { Alice_400Regular } from '@expo-google-fonts/alice';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { GuestDialog } from '@/components/guest-dialog';
import { useBlurOnNavigate } from '@/hooks/use-blur-on-navigate';
import { closeGuestDialog, useSession } from '@/state/session';

export default function RootLayout() {
  const router = useRouter();
  const { guestDialogOpen } = useSession();
  useBlurOnNavigate();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Alice_400Regular,
  });

  // The splash screen stays up until the fonts are ready, so text never renders in the fallback font first.
  if (!fontsLoaded) return null;

  // The matching, organization and system state screens open with the prototype's 250 ms dissolve.
  const dissolve = { headerShown: false, animation: 'fade', animationDuration: 250 } as const;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="events/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="events/[id]/search" options={dissolve} />
        <Stack.Screen name="proposal" options={dissolve} />
        <Stack.Screen name="mutual" options={dissolve} />
        <Stack.Screen name="organization/index" options={dissolve} />
        <Stack.Screen name="organization/event" options={dissolve} />
        <Stack.Screen name="offline" options={dissolve} />
        <Stack.Screen name="update" options={dissolve} />
        <Stack.Screen name="too-many-attempts" options={dissolve} />
        <Stack.Screen name="organizer" options={dissolve} />
        <Stack.Screen name="post-place" options={dissolve} />
      </Stack>
      {/* Opened by the tabs a guest cannot use; the event page has its own, which goes back when closed. */}
      <GuestDialog
        visible={guestDialogOpen}
        onClose={closeGuestDialog}
        onAuth={(route) => {
          closeGuestDialog();
          router.push(route);
        }}
      />
    </GestureHandlerRootView>
  );
}
