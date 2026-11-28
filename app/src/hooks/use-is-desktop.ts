// Written with the help of Claude
// AI Usage: breakpoint for the desktop web layout of the Figma "desktop" page; reviewed by Daryna Halytska.
import { Platform, useWindowDimensions } from 'react-native';

// From this window width a browser gets the desktop frames; below it, and in the phone apps, the mobile ones.
export const DESKTOP_MIN_WIDTH = 1024;

export const isDesktopWidth = (width: number) => Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH;

// Follows the window, so resizing across the breakpoint switches the layout without a reload.
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return isDesktopWidth(width);
}
