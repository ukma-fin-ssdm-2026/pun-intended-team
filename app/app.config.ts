// Written with the help of Claude
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Google's iOS sign-in returns to the app through the iOS client id reversed
// (1234567890-abc.apps.googleusercontent.com → com.googleusercontent.apps.1234567890-abc).
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const iosUrlScheme = iosClientId?.split('.').reverse().join('.');

// app.json plus the Google sign-in plugin, which needs the URL scheme; without an iOS client id the plugin is left
// out and the iOS build has no Google sign-in. Production builds have no /_sitemap route.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    router: { ...config.extra?.router, sitemap: process.env.NODE_ENV !== 'production' },
  },
  plugins: [
    ...(config.plugins ?? []),
    ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }] as [string, unknown]] : []),
  ],
});
