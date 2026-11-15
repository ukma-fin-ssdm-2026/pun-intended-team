// Written with the help of Claude
export const devicePlatforms = ['ios', 'android'] as const;

export type DevicePlatform = (typeof devicePlatforms)[number];

/** A device that gets the account's pushes while the session that registered it lasts (data model). */
export interface DeviceToken {
  accountId: string;
  /** The refresh token (session) the device signed in with; the token goes when the session ends. */
  sessionId: string;
  /** The Expo push token; personal data, never returned by the API. */
  pushToken: string;
  platform: DevicePlatform;
}

/** What the app sends to register the device it runs on. */
export type DeviceRegistration = Pick<DeviceToken, 'pushToken' | 'platform'>;
