// Written with the help of Claude
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The keychain or keystore on a phone; on the web, localStorage. Static web rendering has neither.
export const deviceStorage =
  Platform.OS === 'web'
    ? {
        get: async (key: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
        set: async (key: string, value: string) => localStorage.setItem(key, value),
        remove: async (key: string) => localStorage.removeItem(key),
      }
    : { get: SecureStore.getItemAsync, set: SecureStore.setItemAsync, remove: SecureStore.deleteItemAsync };
