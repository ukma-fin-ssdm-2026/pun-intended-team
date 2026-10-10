# Nearby client (Expo)

Mobile and web client for the Nearby API, built with [Expo](https://expo.dev) and [Expo Router](https://docs.expo.dev/router/introduction/) (TypeScript). It contains placeholder screens only for now.

## Getting started

```bash
cd app
npm install
cp .env.example .env   # then adjust the values if needed
npx expo start --web   # or: npx expo start, then open in Expo Go / an emulator
```

The API must be running separately (see the root [README](../README.md)); by default the client expects it at `http://localhost:4100`.

## Environment variables

| Variable                | Example                 | Purpose                         |
| ----------------------- | ----------------------- | ------------------------------- |
| `EXPO_PUBLIC_API_URL`   | `http://localhost:4100` | Base URL of the Nearby API      |
| `EXPO_PUBLIC_API_TOKEN` | `stub-guest`            | Stub bearer token for local dev |

`EXPO_PUBLIC_*` values are inlined into the JavaScript bundle, so they must never contain real secrets. `.env` is ignored by git; `.env.example` is committed.

## Scripts

| Command             | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm start`         | Start the Expo dev server                          |
| `npm run web`       | Start the dev server and open the web build        |
| `npm run lint`      | Lint with `expo lint` (eslint-config-expo)         |
| `npm run typecheck` | Type-check with `tsc --noEmit`                     |
| `npm run format`    | Format with Prettier (uses the root `.prettierrc`) |

## Project structure

```
app/
├─ app.json, tsconfig.json, eslint.config.js
├─ .env.example
├─ assets/              icons and splash images
└─ src/
   ├─ app/              Expo Router routes (every file is a screen)
   │  ├─ _layout.tsx    root Stack navigator
   │  ├─ index.tsx      home screen
   │  └─ events/[id].tsx event details screen
   ├─ api/              (later) generated schema types and the API client
   ├─ hooks/            (later) data hooks, e.g. use-events.ts
   ├─ components/       (later) shared UI, e.g. event-card.tsx
   ├─ styles/           (later) shared styles
   └─ config.ts         (later) reads EXPO_PUBLIC_* values
```

Import from `src/` with the `@/` alias, for example `import { EventCard } from '@/components/event-card'`.

## Code style

- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html), with two exceptions: a line length of 120, and file names in lowercase kebab-case (`event-card.tsx`, `use-events.ts`), the same as on the NestJS side.
- Expo Router route files keep the names the router requires (`_layout.tsx`, `[id].tsx`).
- Formatting comes from the root `.prettierrc` (single quotes, `printWidth` 120).

## AI Usage Note

Generated with Claude (Claude Code) from the `create-expo-app` template and verified by Daryna Halytska.
