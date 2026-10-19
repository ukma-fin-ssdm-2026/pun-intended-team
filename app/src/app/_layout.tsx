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

import { GuestDialog } from '@/components/guest-dialog';
import { closeGuestDialog, useSession } from '@/state/session';

export default function RootLayout() {
  const router = useRouter();
  const { guestDialogOpen } = useSession();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Alice_400Regular,
  });

  // The splash screen stays up until the fonts are ready, so text never renders in the fallback font first.
  if (!fontsLoaded) return null;

  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="events/[id]/index" options={{ headerShown: false }} />
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
    </>
  );
}
