// Written with the help of Claude
// AI Usage: status bar style per focused screen; reviewed by Daryna Halytska.
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

// Set on focus, not on mount: tab screens stay mounted, so a <StatusBar> element would keep the last mounted style.
export function useStatusBarStyle(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
    }, [style]),
  );
}
