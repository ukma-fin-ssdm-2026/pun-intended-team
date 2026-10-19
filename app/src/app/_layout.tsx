// Written with the help of Claude
// AI Usage: font loading and global styles added to the root layout; reviewed by Daryna Halytska.
import '../../global.css';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });

  // The splash screen stays up until the fonts are ready, so text never renders in the fallback font first.
  if (!fontsLoaded) return null;

  return <Stack />;
}
