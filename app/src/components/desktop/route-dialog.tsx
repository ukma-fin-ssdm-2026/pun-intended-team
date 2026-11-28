// Written with the help of Claude
// AI Usage: a route shown as a centered dialog on the desktop frames, as "DД2.1 Новий допис · Місце на мапі"; reviewed by
// Daryna Halytska.
import { useRouter, type Href } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { useIsDesktop } from '@/hooks/use-is-desktop';

// The dialog of DД2.1.
const WIDTH = 720;
const HEIGHT = 680;

type Props = {
  // Where closing leads when there is no history, e.g. after the page was reloaded.
  fallback: Href;
  children: ReactNode;
};

// On a phone the screen fills the window, as before. On a desktop it is a dialog over a dimmed backdrop, which closes
// on a click outside or on Esc. The tree is the same at every width, so crossing the breakpoint keeps the screen's state.
export function DesktopRouteDialog({ fallback, children }: Props) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const close = () => (router.canGoBack() ? router.back() : router.replace(fallback));

  useEffect(() => {
    if (!isDesktop || Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keyup', onKey);
    return () => document.removeEventListener('keyup', onKey);
  });

  return (
    <View className={`flex-1 ${isDesktop ? 'items-center justify-center p-10' : ''}`}>
      {isDesktop ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрити"
          onPress={close}
          className="absolute inset-0 bg-[rgba(18,18,18,0.6)]"
        />
      ) : null}
      <View
        className={isDesktop ? 'max-h-full max-w-full overflow-hidden rounded-[28px]' : 'flex-1'}
        style={isDesktop ? { width: WIDTH, height: HEIGHT } : undefined}
      >
        {children}
      </View>
    </View>
  );
}
