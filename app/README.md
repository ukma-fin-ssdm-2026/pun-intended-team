# Nearby client (Expo)

Mobile and web client for the Nearby API, built with [Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction/) (TypeScript). It shows the event catalog under a five-tab bar, filters it by search, category, day and district, and shows an event's page, for a signed-in user or a guest. The screens run on mock data for now (`src/mocks/`); the API hooks in `src/hooks/` are kept for connecting them.

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
     - On WSL, Expo puts the WSL IP address into the QR code by default and the phone cannot connect; run `REACT_NATIVE_PACKAGER_HOSTNAME=<IP> npx expo start` instead.
     - On iPhone, Expo Go opens the project only when Expo Go and Expo CLI are logged in to the same Expo account (free, expo.dev): Profile → Log in in the app, `npx expo login` in `app/` on the computer.
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

| Variable              | Example                 | Purpose                                                     |
| --------------------- | ----------------------- | ----------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL` | `http://localhost:4100` | Base URL of the Nearby API; optional, detected when not set |

`EXPO_PUBLIC_*` values are inlined into the JavaScript bundle, so they must never contain real secrets. The client needs no token setting: it gets a guest token from `POST /api/v1/auth/guest` and renews it before it expires. `.env` is ignored by git; `.env.example` is committed.

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

## Checks in CI

The client steps of the "CI passed" job ([`ci.yml`](../.github/workflows/ci.yml)) run on every pull request and must pass to merge. They run these checks in `app/`, after `npm ci`:

| Check                | Run it locally                                                       |
| -------------------- | -------------------------------------------------------------------- |
| Lint                 | `npm run lint`                                                       |
| Types                | `npm run typecheck`                                                  |
| Formatting           | `npx prettier --check .` (fix with `npm run format`)                 |
| API types match spec | `npm run api:types`, then `git diff --exit-code src/api/schema.d.ts` |

After any change to the API spec (`docs/api/openapi-generated.yaml`), run `npm run api:types` and commit the regenerated `src/api/schema.d.ts`; otherwise the last check fails in CI. The client has no tests, and its dependencies are not audited in CI.

## Project structure

```
app/
├─ app.json, tsconfig.json, eslint.config.js
├─ babel.config.js, metro.config.js   NativeWind and SVG imports
├─ tailwind.config.ts   Tailwind theme built from src/styles/tokens.ts
├─ global.css           Tailwind entry file
├─ .svgrrc              turns the icons' stroke (#121212, white, or the grey and coral of a few exports) into currentColor at build time
├─ .env.example
├─ assets/
│  ├─ icons/            Solar Linear icons exported from Figma
│  └─ images/           app icons, splash, spinner and mock event covers
└─ src/
   ├─ app/              Expo Router routes (every file is a screen)
   │  ├─ _layout.tsx    root Stack navigator; loads the fonts and global.css
   │  ├─ (tabs)/        tab screens under the Figma tab bar
   │  │  ├─ _layout.tsx tab navigator
   │  │  ├─ index.tsx   event catalog (mock data)
   │  │  ├─ map.tsx     Т1 Мапа, a static map
   │  │  ├─ matches.tsx Т2 Метчі, with Т2.1 and Т2.2
   │  │  ├─ announcements.tsx   Т3 Оголошення, with Т3.1 and the Д2 editor
   │  │  └─ profile.tsx Т4 Профіль with the П5 dialog
   │  ├─ events/[id]/
   │  │  ├─ index.tsx   event page with the 03 request sheet (mock data)
   │  │  └─ search.tsx  04 Пошук компанії
   │  ├─ proposal.tsx   05 Запропонований метч with 05.2 / 05.3 and the 06 sheet
   │  ├─ mutual.tsx     07 Взаємний метч
   │  ├─ notifications.tsx   Т5 Сповіщення
   │  ├─ profile-edit.tsx    П1 Редагувати профіль
   │  ├─ onboarding.tsx, sign-in.tsx, forgot-password.tsx, new-password.tsx   В1–В3, В4, В4.1, В4.2
   │  ├─ sign-up.tsx, verify-code.tsx, profile-contacts.tsx, profile-setup.tsx   В5–В8
   │  ├─ post-place.tsx Д2.1 Місце на мапі
│  ├─ organizer.tsx  organizer placeholder page
   │  ├─ organization/
   │  │  ├─ index.tsx   О1 Мої події with the О3 cancel sheet
   │  │  └─ event.tsx   О2 Нова подія
   │  ├─ offline.tsx, update.tsx, too-many-attempts.tsx   С1–С3 system states
   │  └─ dev/components.tsx gallery of the UI kit, development only
   ├─ api/
   │  ├─ schema.d.ts    types generated from the API spec (npm run api:types)
   │  └─ client.ts      typed API client; gets and renews the guest token
   ├─ hooks/            API data hooks (not used by the mock screens yet), use-status-bar-style.ts and use-blur-on-navigate.ts
   ├─ components/
   │  ├─ ui/            UI kit from the Figma design (see below)
   │  ├─ catalog-header.tsx   logo, notifications, avatar and greeting of the catalog
   │  ├─ filters-sheet.tsx    Д1 Фільтри
   │  ├─ guest-dialog.tsx     "Увійди, щоб знайти компанію"
   │  ├─ matching/      screens' parts of the matching flow: request and safety sheets, report flow, radar, card, slider
   │  ├─ announcements/ post and post editor of the Оголошення tab
   │  ├─ organization/  the О3 cancel event sheet
   │  └─ system-state.tsx   shared layout of С1–С3
   ├─ mocks/            mock data for screens that have no endpoint yet
   ├─ state/            app-wide client state: the mock session, the catalog filters, favourites and the Метчі tab
   ├─ styles/
   │  └─ tokens.ts      design tokens from the Figma variables
   ├─ config.ts         reads EXPO_PUBLIC_* values
   └─ dates.ts          formats dates in Kyiv time
```

Import from `src/` with the `@/` alias, for example `import { Button } from '@/components/ui/button'`.

## UI kit

The screens are built from the [Figma design](https://www.figma.com/design/SxoD0EfoWYmJ5zehxl7rtX/nearby?node-id=0-1) with [NativeWind](https://www.nativewind.dev/) (Tailwind classes in React Native).

- **Tokens.** `src/styles/tokens.ts` holds the Figma variables under their Figma names, so `brand/coral` becomes the class `bg-brand-coral`. Text sizes are `text-title`, `text-body`, `text-caption` and so on; the weight comes from the font family: `font-inter`, `font-inter-medium`, `font-inter-semibold`, `font-inter-bold`; the logo uses `font-alice`. Change a colour or text style here, not in components.
- **Components.** `src/components/ui/` has the Figma components: `Button`, `IconButton`, `TextField`, `SearchField`, `Chip`, `Toggle`, `EventCard`, `EventCardSkeleton`, `FilterChip`, `TabBar`, `Overlay` (modal layer with the backdrop for dialogs and sheets), `Sheet` (the "01 Шторка" bottom sheet over `Overlay`), `RadioOption` (the option rows of 03 and П1.1), `SelectChip` (the coral chips of П1.2 and Д1.1) and `CoralGradient` (the radial gradient of the catalog header and of covers without an image).
- **Icons.** `<Icon name="calendar" size={16} color={…} />`; `name` is typed, so a wrong name fails `npm run typecheck`. To add an icon, export it from Figma as SVG into `assets/icons/`, keep the file as exported, and add it to the map in `icon.tsx`. Most Figma icons are the Solar icons at another size; where Figma draws one with a heavier stroke than the scaled icon (for example the 16 px tick with a 2.2 px stroke), the Figma export is added under its own name instead of scaling the Solar one.
- **`className` only on React Native components.** NativeWind applies classes to React Native's own components (`View`, `Text`, `Pressable`, `ScrollView`, `TextInput`, `Image`…), not to `Animated.View` from Reanimated, `expo-image` or `react-native-svg`. Give those a `style`, or put the classes on a `View` inside them.
- **Glass.** Elements with a background blur in Figma use `Glass` (`src/components/ui/glass.tsx`) with the Figma corner radius, fill, border and blur radius. The web gets the exact Figma CSS (`backdrop-filter: blur(radius / 2)`), iOS the system blur. Android 12 and newer blur only what is inside a `BlurTargetView` passed as `blurTarget` (the card and event covers); without one, and on older Android, the glass shows its fill alone.
- **Shadows.** Use the `boxShadow` strings from `shadows` in `tokens.ts`; they render on iOS, Android and web. Take the radius and spread from the Figma effect itself: Figma's CSS export writes half the radius into `drop-shadow()`. Do not use SVG filters for shadows: they do not render on every platform.
- **Navigation.** Links follow the Figma prototype: the tabs open Т1–Т4, the bell opens Т5 Сповіщення, the avatar the profile tab, the categories arrow the Д1 Фільтри sheet, and a card the event page. On the event page the main button opens 03 Запит на компанію, or 04 Пошук компанії when the user is already in the pool (02.1, shown with the development switch), and the address row and the map preview the map tab; the organizer row the organizer placeholder page. A guest has no bell or greeting, the avatar opens В4 Вхід, and the event page and the Метчі, Оголошення and Профіль tabs open the sign-in dialog (02.2). Dialogs and sheets close on a backdrop tap. The matching flow follows the prototype too: the request sheet opens 04, which shows 05 after 4 s; "Ще" on 04 opens the 04.1 menu, whose "Змінити побажання" opens 03 on the event page and "Вийти з пулу" the 04.2 dialog ("Вийти з пулу" returns to the event page, "Залишитися" to the menu); on 05 dragging the arrow along "Прийняти" accepts and the cross declines, and 1.8 s after the answer the Метчі tab opens as Т2.2, with its toast after accepting or declining; there the mutual card and "Написати" open the 06 safety sheet over 07. Т5 "Це взаємно!" opens 05 with the 06 safety sheet, whose "Зрозуміло" opens 07. Back on 05 and 07 and "Зрозуміло" after a report open the Метчі tab. On Т3 the "create post" row opens the inline editor (Д2), whose "+ Місце" opens Д2.1 Місце на мапі (the map drags under the pin; "Обрати місце" returns to the editor) and "Опублікувати" returns to the feed, and "Ще" on a post opens the report flow; 04 "Створити оголошення" opens the tab with the editor. On Т4 the edit button opens П1, where "+ ще" opens the П1.2 Інтереси sheet (its "Зберегти" applies the choice) and "+ Додати соцмережу" the П1.1 sheet; and "Вийти з акаунта" the П5 dialog. In Д1 "Обрати дати" opens the Д1.1 calendar sheet (a day or a range, or a quick choice; "Застосувати" filters by it and returns to Д1) and "Поруч зі мною" the Д1.2 location dialog, whose "Дозволити" marks the chip (there is no location yet, so it does not narrow the list). On Т1 the filter button opens Д1 and the venue's events open the event page. Onboarding (В1–В3) is a swipe carousel: only the slides move, the step indicator and the buttons stay, and the dots and "Далі" page it; "Зареєструватися" is on В3 only. On О1 "Нова", "Редагувати" and "Продовжити" open О2, where the "Категорія" field opens its О2.1 list in place (picking a category closes it), whose "Чернетка" and "Опублікувати подію" return to О1, and "Скасувати" opens the О3 sheet. С1 "Спробувати ще раз" opens the catalog, and С3 "Зрозуміло" opens В4 Вхід. No prototype screen links to О1 or С1–С3 yet; open them from the gallery.
- **Motion.** Animations take their values from Figma's motion data and prototype (Smart Animate durations and easing) and run on Reanimated; with reduced motion they rest on their first frame or switch at once.
- **State.** `src/state/` holds client state shared between screens in small stores (`createStore`, over `useSyncExternalStore`): the mock session and the catalog filters, which the search, the category row and the filters sheet all change. Favourite events are one store too, so a heart toggled on a catalog card shows on the event page and back. Post likes on the Оголошення tab are kept the same way.
- **Status bar.** Call `useStatusBarStyle('light')` on a screen with a dark top, `'dark'` otherwise; it applies when the screen gets focus.
- **Gallery and modes.** Run `npm run web` and open `http://localhost:8081/dev/components` to see every component and state. Its first section switches the mock session: guest or signed in, whether the catalog shows its skeleton for 1.5 s first (on by default, as in the prototype), whether the event page shows 02.1 "Ти вже в пошуку" (off by default), whether the Метчі tab is empty (Т2.1), and whether the Оголошення tab is empty (Т3.1). Its "Інші екрани" section opens О1 and С1–С3. It also shows the other titles of 07 ("Концерту бути!", "Вечір врятовано!", "Гірко!"). Catalog cards always show the default "Знайти компанію" button; the gallery shows the "У пулі" card. Open the catalog with the button there: reloading the page resets the switches. The route only works in development; in a production build it redirects to the catalog.

## Code style

The client follows the team's [coding standard](../TeamCharter.md#5-code-quality-and-review-policy) (TeamCharter.md §5). Expo Router route files keep the names the router requires (`_layout.tsx`, `[id].tsx`).

## AI Usage Note

Generated with Claude (Claude Code) from the `create-expo-app` template and verified by Daryna Halytska.
