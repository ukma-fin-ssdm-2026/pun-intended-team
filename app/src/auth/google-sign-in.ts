// Written with the help of Claude
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { config } from '@/config';

export type GoogleSignInResult =
  | { type: 'success'; idToken: string }
  | { type: 'cancelled' }
  // Expo Go has no native Google module, and a build without the client ids cannot ask Google.
  | { type: 'unavailable' }
  | { type: 'failed'; reason: 'play-services' | 'other' };

export function isNativeGoogleAvailable(): boolean {
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  return !!config.googleClientId && (Platform.OS !== 'ios' || !!config.googleIosClientId);
}

let configured = false;

// Google's account picker on iOS and Android. Imported on first use, so the app still starts in Expo Go.
export async function requestGoogleIdToken(): Promise<GoogleSignInResult> {
  if (!isNativeGoogleAvailable()) return { type: 'unavailable' };
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } =
    await import('@react-native-google-signin/google-signin');

  if (!configured) {
    GoogleSignin.configure({ webClientId: config.googleClientId, iosClientId: config.googleIosClientId });
    configured = true;
  }
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { type: 'cancelled' };
    // Nearby keeps its own session, so Google's is not needed; without it the picker asks for an account every time.
    await GoogleSignin.signOut().catch(() => undefined);
    const { idToken } = response.data;
    return idToken ? { type: 'success', idToken } : { type: 'failed', reason: 'other' };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.IN_PROGRESS) return { type: 'cancelled' };
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) return { type: 'failed', reason: 'play-services' };
    }
    console.warn(error);
    return { type: 'failed', reason: 'other' };
  }
}
