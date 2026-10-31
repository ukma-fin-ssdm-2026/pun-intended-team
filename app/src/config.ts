// Written with the help of Claude
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4100;

// Uses the host that served the client, so a phone on the same network reaches the API on the same computer.
// Static web rendering runs in Node without `window`; the browser re-evaluates this module with the real host.
function detectApiUrl(): string {
  const host =
    Platform.OS !== 'web'
      ? Constants.expoConfig?.hostUri?.split(':')[0]
      : typeof window === 'undefined'
        ? 'localhost'
        : window.location.hostname;
  if (!host) {
    throw new Error('Cannot detect the API host. Set EXPO_PUBLIC_API_URL in app/.env.');
  }
  return `http://${host}:${API_PORT}`;
}

// Expo inlines EXPO_PUBLIC_* values only for direct `process.env.EXPO_PUBLIC_...` access, so keep the names literal.
export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || detectApiUrl(),
  // The "Web application" client: Google's button on the web, and the audience of the ID tokens on iOS and Android.
  googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};
