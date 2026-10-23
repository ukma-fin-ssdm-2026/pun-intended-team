// Written with the help of Claude
// AI Usage: web fix for the "Blocked aria-hidden" warning on navigation; reviewed by Daryna Halytska.
import { useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// On the web the navigator hides the screens it leaves with aria-hidden. If the pressed button keeps focus, the browser
// blocks that and warns, so focus is dropped as soon as a navigation action is dispatched, before the screen is hidden.
// "__unsafe_action__" is the only container event that fires before the state changes; react-navigation marks it as
// meant for debugging, so check this warning again after a navigation update.
export function useBlurOnNavigate() {
  const navigation = useNavigationContainerRef();

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return navigation.addListener('__unsafe_action__', () => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
    });
  }, [navigation]);
}
