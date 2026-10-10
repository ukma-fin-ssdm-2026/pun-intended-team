# Nearby client (Expo)

Mobile and web client for the Nearby API, built with [Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction/) (TypeScript). It lists upcoming events, filters them by category and shows an event's details.

## Getting started

Once, install the dependencies and create `.env`:

```bash
cd app
npm install
cp .env.example .env   # then adjust the values if needed
```

Then run the API and the client in two terminals:

```bash
# terminal 1, in the repository root: the API on http://localhost:4100
CORS_ORIGINS=http://localhost:8081 npm run dev

# terminal 2: the client on http://localhost:8081
cd app && npm run web
```

`CORS_ORIGINS` lets the web client, served from `http://localhost:8081`, call the API from the browser; without it the browser blocks the requests. To open the client on a phone, see [Running on a phone](#running-on-a-phone). See the root [README](../README.md) for the API itself.

## Running on a phone

1. Connect the phone and the computer to the same Wi-Fi network.
2. Find the computer's IP address: `ipconfig` on Windows (IPv4 Address), `ipconfig getifaddr en0` on Mac.
3. Run the API as in [Getting started](#getting-started).
4. Open the client:
   - Expo Go: run `npm start` and scan the QR code.
   - Phone browser: run `npx expo start --web`, start the API with `CORS_ORIGINS=http://localhost:8081,http://<IP>:8081` and open `http://<IP>:8081`.

The client calls the API on the same host it was opened from, port 4100, unless `EXPO_PUBLIC_API_URL` is set.

On WSL, the phone cannot reach servers inside WSL by default. Once:

1. Add to `%USERPROFILE%\.wslconfig`:

   ```ini
   [wsl2]
   networkingMode=mirrored
   ```

2. Run `wsl --shutdown` and reopen WSL.
3. In PowerShell as administrator:

   ```powershell
   Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow
   ```

Without mirrored mode (Windows 10 and older Windows 11, where `Set-NetFirewallHyperVVMSetting` is missing):

1. Find the WSL IP address: `hostname -I` in WSL (the first address).
2. In PowerShell as administrator:

   ```powershell
   netsh interface portproxy add v4tov4 listenaddress=<IP> listenport=8081 connectaddress=<WSL IP> connectport=8081
   netsh interface portproxy add v4tov4 listenaddress=<IP> listenport=4100 connectaddress=<WSL IP> connectport=4100
   New-NetFirewallRule -DisplayName "Nearby dev" -Direction Inbound -Protocol TCP -LocalPort 8081,4100 -Action Allow
   ```

3. The WSL IP address may change after a restart: run `netsh interface portproxy reset` and repeat both `portproxy` commands (not the firewall rule).

The warning `error while installing React Native DevTools ... libnspr4.so` in WSL can be ignored.

## Environment variables

| Variable                | Example                 | Purpose                                                     |
| ----------------------- | ----------------------- | ----------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`   | `http://localhost:4100` | Base URL of the Nearby API; optional, detected when not set |
| `EXPO_PUBLIC_API_TOKEN` | `stub-guest`            | Stub bearer token for local dev                             |

`EXPO_PUBLIC_*` values are inlined into the JavaScript bundle, so they must never contain real secrets. `.env` is ignored by git; `.env.example` is committed.

## Scripts

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm start`         | Start the Expo dev server                          |
| `npm run web`       | Start the dev server and open the web build        |
| `npm run lint`      | Lint with `expo lint` (eslint-config-expo)         |
| `npm run typecheck` | Type-check with `tsc --noEmit`                     |
| `npm run format`    | Format with Prettier (uses the root `.prettierrc`) |
| `npm run api:types` | Regenerate `src/api/schema.d.ts` from the API spec |

Run `npm run api:types` after the API spec (`docs/api/openapi-generated.yaml`) changes, and commit the regenerated `src/api/schema.d.ts` as is: it is generated, so do not edit or format it by hand.

## Project structure

```
app/
├─ app.json, tsconfig.json, eslint.config.js
├─ .env.example
├─ assets/              icons and splash images
└─ src/
   ├─ app/              Expo Router routes (every file is a screen)
   │  ├─ _layout.tsx    root Stack navigator
   │  ├─ index.tsx      event list with the category filter
   │  └─ events/[id].tsx event details screen
   ├─ api/
   │  ├─ schema.d.ts    types generated from the API spec (npm run api:types)
   │  └─ client.ts      typed API client with the bearer token
   ├─ hooks/            data hooks: use-categories.ts, use-events.ts, use-event.ts
   ├─ components/       shared UI: category filter, event card, loading and error states
   ├─ styles/           theme.ts with shared spacing, colors and font sizes
   ├─ config.ts         reads EXPO_PUBLIC_* values
   └─ dates.ts          formats dates in Kyiv time
```

Import from `src/` with the `@/` alias, for example `import { EventCard } from '@/components/event-card'`.

## Code style

The client follows the team's [coding standard](../TeamCharter.md#5-quality-and-code-review-policy) (TeamCharter.md §5). Expo Router route files keep the names the router requires (`_layout.tsx`, `[id].tsx`).

## AI Usage Note

Generated with Claude (Claude Code) from the `create-expo-app` template and verified by Daryna Halytska.
