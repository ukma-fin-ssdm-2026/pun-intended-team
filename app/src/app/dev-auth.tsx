// Written with the help of Claude
// Temporary screen for trying the sign-in flow by hand until the real auth screens exist; delete it together
// with its link on the home screen and EXPO_PUBLIC_GOOGLE_CLIENT_ID.
import { Stack } from 'expo-router';
import createClient from 'openapi-fetch';
import { useEffect, useState } from 'react';
import { Button, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { paths } from '@/api/schema';
import { config } from '@/config';
import { colors, fontSizes, spacing } from '@/styles/theme';

// No guest-token middleware: this screen sends the account token it got itself.
const client = createClient<paths>({ baseUrl: config.apiUrl });

const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

type Outcome = { data?: unknown; error?: unknown; response: Response };
type Result = { label: string; status: number; body: unknown };

export default function DevAuthScreen() {
  const [phone, setPhone] = useState('+380501110001');
  const [code, setCode] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('2000-05-17');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [idToken, setIdToken] = useState('');
  const [token, setToken] = useState('');
  const [result, setResult] = useState<Result>();

  const auth = { Authorization: `Bearer ${token}` };

  async function run(label: string, request: () => Promise<Outcome>) {
    try {
      const { data, error, response } = await request();
      setResult({ label, status: response.status, body: error ?? data ?? null });
      if (data && typeof data === 'object' && 'accessToken' in data) {
        setToken(String(data.accessToken));
      }
    } catch (error) {
      setResult({ label, status: 0, body: String(error) });
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: 'Sign-in test (temporary)' }} />

      <Section title="Phone (used by every step)">
        <Field value={phone} onChangeText={setPhone} placeholder="+380XXXXXXXXX" />
      </Section>

      <Section title="1. Register: send a code (read it in the API console)">
        <Button
          title="Send registration code"
          onPress={() => run('register', () => client.POST('/api/v1/auth/register', { body: { phone } }))}
        />
      </Section>

      <Section title="2. Verify the code → registration token (only step 3 accepts it)">
        <Field value={code} onChangeText={setCode} placeholder="6-digit code" />
        <Button
          title="Verify code"
          onPress={() => run('verify', () => client.POST('/api/v1/auth/verify', { body: { phone, code } }))}
        />
      </Section>

      <Section title="3. Date of birth → account active and signed in (under 18: start again)">
        <Field value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" />
        <Button
          title="Finish registration"
          disabled={!token}
          onPress={() =>
            run('completeRegistration', () =>
              client.POST('/api/v1/auth/complete-registration', { body: { dateOfBirth }, headers: auth }),
            )
          }
        />
      </Section>

      <Section title="4. Signed in: set a first password, or change it (current password needed only to change)">
        <Field value={password} onChangeText={setPassword} placeholder="New password, 8+ characters" secure />
        <Field
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Current password, only when changing"
          secure
        />
        <Button
          title="Save password"
          disabled={!token}
          onPress={() =>
            run('setPassword', () =>
              client.PUT('/api/v1/me/password', {
                body: { password, currentPassword: currentPassword || undefined },
                headers: auth,
              }),
            )
          }
        />
      </Section>

      <Section title="5. Sign in with phone + password (password field from step 4)">
        <Button
          title="Sign in"
          onPress={() => run('signIn', () => client.POST('/api/v1/auth/sign-in', { body: { phone, password } }))}
        />
      </Section>

      <Section title="6. Forgot the password: a code proves it is you, then set a new one (no current password)">
        <Button
          title="Send reset code"
          onPress={() => run('passwordReset', () => client.POST('/api/v1/auth/password-reset', { body: { phone } }))}
        />
        <Field value={resetCode} onChangeText={setResetCode} placeholder="6-digit reset code" />
        <Field value={resetPassword} onChangeText={setResetPassword} placeholder="New password, 8+ characters" secure />
        <Button
          title="Set new password and sign in"
          onPress={() =>
            run('resetPassword', () =>
              client.POST('/api/v1/auth/password-reset/confirm', {
                body: { phone, code: resetCode, password: resetPassword },
              }),
            )
          }
        />
      </Section>

      <Section title="7. Google: get an ID token, then sign in or link it">
        <GoogleButton onIdToken={setIdToken} />
        <Text style={styles.muted}>{idToken ? `ID token: ${idToken.slice(0, 24)}…` : 'No Google ID token yet'}</Text>
        <Button
          title="Sign in with Google"
          disabled={!idToken}
          onPress={() => run('signInWithGoogle', () => client.POST('/api/v1/auth/google', { body: { idToken } }))}
        />
        <Button
          title="Link Google to this account"
          disabled={!idToken || !token}
          onPress={() => run('linkGoogle', () => client.PUT('/api/v1/me/google', { body: { idToken }, headers: auth }))}
        />
      </Section>

      <Section title="Current token">
        <Text style={styles.mono}>{token ? JSON.stringify(decodeClaims(token), null, 2) : 'Not signed in'}</Text>
        <Button
          title="Check it on a signed-in endpoint"
          disabled={!token}
          onPress={() => run('listListings', () => client.GET('/api/v1/listings', { headers: auth }))}
        />
        <Button title="Forget it (sign out)" disabled={!token} onPress={() => setToken('')} />
      </Section>

      <Section title="Last response">
        <Text style={styles.mono}>
          {result ? `${result.label}: ${result.status}\n${JSON.stringify(result.body, null, 2)}` : '—'}
        </Text>
      </Section>
    </ScrollView>
  );
}

/** Google Identity Services, web build only; on a phone use the browser build instead. */
function GoogleButton({ onIdToken }: { onIdToken: (idToken: string) => void }) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !googleClientId) {
      return;
    }
    receiveIdToken = onIdToken;
    let mounted = true;
    loadGoogle(googleClientId)
      .then((google) => {
        if (mounted) {
          google.accounts.id.renderButton(document.getElementById('google-button'), {
            theme: 'outline',
            size: 'large',
          });
        }
      })
      .catch((error: unknown) => console.warn(error));
    return () => {
      mounted = false;
    };
  }, [onIdToken]);

  if (Platform.OS !== 'web') {
    return <Text style={styles.muted}>Google sign-in works in the web build only (npm run web).</Text>;
  }
  if (!googleClientId) {
    return <Text style={styles.muted}>Set EXPO_PUBLIC_GOOGLE_CLIENT_ID in app/.env to show the Google button.</Text>;
  }
  return <View nativeID="google-button" />;
}

// Google's library stays on the page once loaded and must be initialised only once, so a remounted
// screen reuses it and only takes over where the ID token goes.
let google: Promise<GoogleIdentity> | undefined;
let receiveIdToken: (idToken: string) => void = () => {};

function loadGoogle(clientId: string): Promise<GoogleIdentity> {
  google ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      const loaded = (window as unknown as { google: GoogleIdentity }).google;
      loaded.accounts.id.initialize({ client_id: clientId, callback: ({ credential }) => receiveIdToken(credential) });
      resolve(loaded);
    };
    script.onerror = () => {
      google = undefined;
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return google;
}

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
      renderButton(element: HTMLElement | null, options: { theme: string; size: string }): void;
    };
  };
};

/** The token's claims, for display only; the API is what checks the signature. */
function decodeClaims(token: string): unknown {
  try {
    const payload = token.split('.')[1] ?? '';
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return 'Cannot decode the token';
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  secure = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secure?: boolean;
}) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secure}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, padding: spacing.md, backgroundColor: colors.background },
  section: { gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: 8 },
  title: { fontSize: fontSizes.md, fontWeight: '600', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: spacing.sm,
    fontSize: fontSizes.md,
    color: colors.text,
  },
  muted: { fontSize: fontSizes.sm, color: colors.textMuted },
  mono: { fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: fontSizes.sm, color: colors.text },
});
