// Written with the help of Claude
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = 4100;

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy app/.env.example to app/.env and restart the Expo dev server.`);
  }
  return value;
}

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
  apiToken: requireEnv('EXPO_PUBLIC_API_TOKEN', process.env.EXPO_PUBLIC_API_TOKEN),
};
