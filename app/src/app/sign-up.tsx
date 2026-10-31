// Written with the help of Claude
// AI Usage: sign-up screen based on the Figma "В5 Реєстрація" frame, with Google instead of the phone number.
import { Redirect, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { call, publicClient } from '@/api/public-client';
import { startSession } from '@/api/session';
import { failureSnackbar, googleSnackbars, messages } from '@/auth/messages';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { TextField } from '@/components/ui/text-field';
import { useSignIn } from '@/hooks/use-sign-in';
import { finishGoogleRegistration, googleProfile, googleRegistrationToken } from '@/state/google-registration';
import { colors } from '@/styles/tokens';

const MIN_AGE = 18;

// "ДД.ММ.РРРР" → whether the person is under 18 today; an incomplete date is not an error yet.
function isUnderAge(value: string, today = new Date()) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return false;
  const [, day, month, year] = match.map(Number);
  const adulthood = new Date(year + MIN_AGE, month - 1, day);
  return adulthood > today;
}

// "ДД.ММ.РРРР" → "РРРР-ММ-ДД"; undefined unless it is a real date.
function toIsoDate(value: string): string | undefined {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return date.getUTCDate() === Number(day) && date.getUTCMonth() + 1 === Number(month)
    ? `${year}-${month}-${day}`
    : undefined;
}

// Shown only to a Google account that has no Nearby account yet; the Google button sends it here with the ID token.
export default function SignUpScreen() {
  const router = useRouter();
  const openCatalog = useSignIn();
  const [idToken] = useState(googleRegistrationToken);
  const [birthDate, setBirthDate] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverUnderAge, setServerUnderAge] = useState(false);
  const { snackbar, show, hide } = useSnackbar();

  // E.g. the web page was reloaded: the token lived in memory only.
  if (!idToken) return <Redirect href="/onboarding" />;

  const { name, email } = googleProfile(idToken);
  const underAge = isUnderAge(birthDate) || serverUnderAge;
  const dateOfBirth = toIsoDate(birthDate);
  const ready = !!dateOfBirth && !underAge && agreed;

  const createAccount = async () => {
    if (!dateOfBirth) return;
    hide();
    setLoading(true);
    const registered = await call(() => publicClient.POST('/api/v1/auth/google/register', { body: { idToken } }));
    if (!registered.ok) {
      if (registered.status === 409) {
        // The account was finished meanwhile, e.g. on another device: sign in with the same token.
        const signedIn = await call(() => publicClient.POST('/api/v1/auth/google', { body: { idToken } }));
        setLoading(false);
        if (signedIn.ok) {
          finishGoogleRegistration();
          await startSession(signedIn.data);
          openCatalog();
        } else {
          show(failureSnackbar(signedIn));
        }
        return;
      }
      setLoading(false);
      if (registered.status === 429) router.push('/too-many-attempts');
      else if (registered.status === 422) show(googleSnackbars.expired);
      else show(failureSnackbar(registered));
      return;
    }
    const completed = await call(() =>
      publicClient.POST('/api/v1/auth/complete-registration', {
        body: { dateOfBirth },
        headers: { Authorization: `Bearer ${registered.data.accessToken}` },
      }),
    );
    setLoading(false);
    if (!completed.ok) {
      if (completed.status === 422) setServerUnderAge(true);
      else show(failureSnackbar(completed));
      return;
    }
    finishGoogleRegistration();
    await startSession(completed.data);
    router.replace('/profile-setup');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthLayout
        title="Ще один крок"
        subtitle="Nearby лише для людей від 18 років, тож нам потрібна дата народження."
        footer={
          <Button
            label="Створити акаунт"
            variant="dark"
            disabled={!ready}
            loading={loading}
            onPress={() => void createAccount()}
          />
        }
      >
        {/* The Google account that is registering, so someone with two accounts sees which one it is. */}
        <View className="flex-row items-center gap-3 rounded-2xl border border-border-default px-3.5 py-3">
          <View className="size-10 items-center justify-center rounded-full bg-brand-coral">
            <Text className="font-inter-semibold text-body text-text-on-dark">
              {(name ?? email ?? '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            {name && <Text className="font-inter-semibold text-body text-text-primary">{name}</Text>}
            {email && (
              <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
                {email}
              </Text>
            )}
          </View>
        </View>
        <TextField
          label="Дата народження"
          placeholder="ДД.ММ.РРРР"
          value={birthDate}
          onChangeText={(value) => {
            setBirthDate(value);
            setServerUnderAge(false);
          }}
          keyboardType="number-pad"
          error={
            underAge
              ? messages.underage
              : birthDate.length === 10 && !dateOfBirth
                ? 'Введи дату як ДД.ММ.РРРР'
                : undefined
          }
        />
        <View className="flex-row items-center gap-2.5">
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="Погоджуюсь з правилами спільноти та політикою конфіденційності"
            onPress={() => setAgreed((value) => !value)}
            hitSlop={8}
            className={`size-[22px] items-center justify-center rounded-[7px] ${
              agreed ? 'bg-brand-ink' : 'border-[1.5px] border-border-default bg-surface-card'
            }`}
          >
            {agreed && <Icon name="checkbox-check" size={16} color={colors.text['on-dark']} />}
          </Pressable>
          {/* The rules and the privacy policy have no prototype links; shown as in Figma. */}
          <Text className="flex-1 font-inter text-caption text-text-secondary">
            Погоджуюсь з <Text className="font-inter-semibold text-text-primary underline">правилами спільноти</Text> та{' '}
            <Text className="font-inter-semibold text-text-primary underline">політикою конфіденційності</Text>
          </Text>
        </View>
      </AuthLayout>
      {snackbar && <Snackbar {...snackbar} />}
    </>
  );
}
