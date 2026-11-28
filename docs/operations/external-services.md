# External Services

Services the API and the app depend on outside the repository. Amounts paid and team contributions are tracked in the team's finance sheet (Google Sheets), not here. Secret values are never written in this file or in issues.

| Service | Used for | Account owner | Payment | Price | Env variables | Status |
|---|---|---|---|---|---|---|
| Telegram Gateway API | Verification codes (FR-005) | Nearby (team number) | Prepaid balance, topped up through Fragment; at least $100 per top-up | Per delivered code; free to the owner's own number | `TELEGRAM_GATEWAY_TOKEN` | **Paused** until the app is live and funded |
| TurboSMS | SMS fallback for codes | Viktoriia Baran (FOP) | Prepaid balance | ≈ 1.3 UAH per SMS to Ukrainian numbers | `TURBOSMS_TOKEN`, `TURBOSMS_SENDER` | **Paused**: account and sender name in verification until mid-November 2026 |
| Hetzner Cloud | Staging host: one CX23 server (API, web app, Postgres, reverse proxy) | Viktoriia Baran | Card, monthly | CX23, billed by the hour up to a monthly cap | — (set on the host) | Active |
| name.com | Domain `nearbystaging.app` | Viktoriia Baran | GitHub Student Developer Pack | Free until about October 2027, then ≈ $24 per year | — | Active |
| Google Cloud | OAuth clients for Google sign-in: web, iOS and Android (`ua.nearby.app`; the Android client has the SHA-1 of the EAS keystore) | Viktoriia Baran | — | Free | `GOOGLE_CLIENT_IDS` (API); `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (app) | Active |
| Google Maps Platform (Maps SDK for Android) | The venue map in the Android app (FR-012, FR-013) | Viktoriia Baran (the Google Cloud project of the sign-in clients) | The project needs a billing account | Map loads of the Android SDK are free under Google's price list; check it before release | `GOOGLE_MAPS_ANDROID_API_KEY`, read by `app/app.config.ts` at build time, set in the EAS `development` environment; the key is restricted to the Maps SDK for Android and to the app (`ua.nearby.app` with the SHA-1 of the EAS keystore) | **To set up**: without the key the Android map shows the pins on a blank map |
| Apple Maps (MapKit) | The venue map in the iOS app | — | — | Free, no key | — | Active with the first iOS build |
| OpenStreetMap Nominatim | Coordinates of imported venues without them (CMP-03, [`nominatim-geocoder.ts`](../../src/infra/geocoding/nominatim-geocoder.ts)); names of the point picked as a listing's place (`GET /places/reverse`, [`nominatim-place-lookup.ts`](../../src/infra/geocoding/nominatim-place-lookup.ts)). Data © OpenStreetMap contributors, ODbL | — | — | Free, no key; the usage policy allows at most 1 request/s with a User-Agent naming the app, which both callers keep | `IMPORT_USER_AGENT`, `NOMINATIM_BASE_URL` (tests only) | Active |
| OpenFreeMap | Map tiles of the venue map in the web app ([`venue-map.web.tsx`](../../app/src/components/map/venue-map.web.tsx)) | — | — | Free, no registration or key; the public instance has no guaranteed availability | — | Active |
| Expo (EAS) | Development builds of the app; keeps the Android signing keystore | Nearby (`nearby.ukma`, project `@nearbyukmas-team/nearby`) | — | Free plan | The app's `EXPO_PUBLIC_GOOGLE_*`, set in the EAS `development` environment | Active |
| Expo Push | Push notifications to the app (HLD I5, [`expo-push-provider.ts`](../../src/infra/push/expo-push-provider.ts)) | Nearby (the Expo project above) | — | Free | — (the API sends without an Expo access token) | Active on Android; iOS has no push yet |
| Firebase Cloud Messaging | Delivers Expo's pushes to Android phones | The Firebase project of the Google Cloud project above (`nearby-511918`) | — | Free | — (the app's [`google-services.json`](../../app/google-services.json); the FCM V1 service account key is uploaded to the EAS credentials of `ua.nearby.app`, never to the repository) | Active |

## Maps

The map tab shows only Kyiv, the catalog's city: it cannot be moved away from the city, so no regional borders are shown. Android draws it with Google Maps and iOS with Apple Maps through `react-native-maps`; the web app uses MapLibre with OpenFreeMap's tiles, which are built from OpenStreetMap data (ODbL). The attribution each provider requires stays on the map. No key is kept in the repository.

## Phone codes while paused

Sign-up and sign-in are Google-only while codes are paused ([ADR-004](../architecture/decisions/ADR-004.md)): the routes that send codes are removed, and `MESSAGING_PROVIDER=disabled`, the production default, lets the API start without a Telegram token. To bring codes back, restore the routes, set `MESSAGING_PROVIDER=telegram` with a funded `TELEGRAM_GATEWAY_TOKEN`, and the TurboSMS variables for the SMS fallback.

## AI Usage Note

Drafted with Claude from the Viktoriia's notes on payments; reviewed by Viktoriia Baran.
