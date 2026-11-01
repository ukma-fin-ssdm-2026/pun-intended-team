# External Services

Services the API and the app depend on outside the repository. Amounts paid and team contributions are tracked in the team's finance sheet (Google Sheets), not here. Secret values are never written in this file or in issues.

| Service | Used for | Account owner | Payment | Price | Env variables | Status |
|---|---|---|---|---|---|---|
| Telegram Gateway API | Verification codes (FR-005) | Nearby (team number) | Prepaid balance, topped up through Fragment; at least $100 per top-up | Per delivered code; free to the owner's own number | `TELEGRAM_GATEWAY_TOKEN` | **Paused** until the app is live and funded |
| TurboSMS | SMS fallback for codes | Viktoriia Baran (FOP) | Prepaid balance | ≈ 1.3 UAH per SMS to Ukrainian numbers | `TURBOSMS_TOKEN`, `TURBOSMS_SENDER` | **Paused**: account and sender name in verification until mid-November 2026 |
| Hetzner Cloud | Staging host: one CX23 server (API, web app, Postgres, reverse proxy) | Viktoriia Baran | Card, monthly | CX23, billed by the hour up to a monthly cap | — (set on the host) | Active |
| name.com | Domain `nearbystaging.app` | Viktoriia Baran | GitHub Student Developer Pack | Free until about October 2027, then ≈ $24 per year | — | Active |
| Google Cloud | OAuth clients for Google sign-in: web, iOS and Android (`ua.nearby.app`; the Android client has the SHA-1 of the EAS keystore) | Viktoriia Baran | — | Free | `GOOGLE_CLIENT_IDS` (API); `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (app) | Active |
| Expo (EAS) | Development builds of the app; keeps the Android signing keystore | Nearby (`nearby.ukma`, project `@nearbyukmas-team/nearby`) | — | Free plan | The app's `EXPO_PUBLIC_GOOGLE_*`, set in the EAS `development` environment | Active |

## Phone codes while paused

Sign-up and sign-in are Google-only while codes are paused ([ADR-004](../architecture/decisions/ADR-004.md)): the routes that send codes are removed, and `MESSAGING_PROVIDER=disabled`, the production default, lets the API start without a Telegram token. To bring codes back, restore the routes, set `MESSAGING_PROVIDER=telegram` with a funded `TELEGRAM_GATEWAY_TOKEN`, and the TurboSMS variables for the SMS fallback.

## AI Usage Note

Drafted with Claude from the Viktoriia's notes on payments; reviewed by Viktoriia Baran.
