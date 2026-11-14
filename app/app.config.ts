// Written with the help of Claude
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Google's iOS sign-in returns to the app through the iOS client id reversed
// (1234567890-abc.apps.googleusercontent.com → com.googleusercontent.apps.1234567890-abc).
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const iosUrlScheme = iosClientId?.split('.').reverse().join('.');

// Google Maps draws the venue map on Android and needs a key, set in the EAS environment, never in the repository
// (docs/operations/external-services.md). Without it the Android map has no streets. iOS uses Apple Maps and the web
// MapLibre, without keys.
const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

// app.json plus the maps plugin and the Google sign-in plugin, which needs the URL scheme; without an iOS client id the
// sign-in plugin is left out and the iOS build has no Google sign-in. Production builds have no /_sitemap route.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    router: { ...config.extra?.router, sitemap: process.env.NODE_ENV !== 'production' },
  },
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey }],
    ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }] as [string, unknown]] : []),
  ],
});
