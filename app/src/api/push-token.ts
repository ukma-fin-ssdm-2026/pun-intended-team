// Written with the help of Claude
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiClient } from './client';

/**
 * Registers this device's Expo push token for the signed-in session. The API removes it when the session ends. Never
 * fails: without permission, a token or an answer the device gets no pushes, and the inbox still shows everything.
 */
export async function registerPushToken(): Promise<void> {
  // The web build shows the inbox without push.
  if (Platform.OS === 'web') return;
  try {
    // Android 13 and later show the permission prompt only once the app has a notification channel.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Сповіщення',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    await apiClient.PUT('/api/v1/me/push-token', {
      body: { pushToken, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
  } catch {
    // Nothing to do: the next sign-in or start tries again.
  }
}
