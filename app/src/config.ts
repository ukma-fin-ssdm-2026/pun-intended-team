// Written with the help of Claude
function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Copy app/.env.example to app/.env and restart the Expo dev server.`);
  }
  return value;
}

// Expo inlines EXPO_PUBLIC_* values only for direct `process.env.EXPO_PUBLIC_...` access, so keep the names literal.
export const config = {
  apiUrl: requireEnv('EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL),
  apiToken: requireEnv('EXPO_PUBLIC_API_TOKEN', process.env.EXPO_PUBLIC_API_TOKEN),
};
