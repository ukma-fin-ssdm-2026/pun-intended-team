// Written with the help of Claude
// AI Usage: sign-up screen based on the Figma "В5 Реєстрація" frame, with Google instead of the phone number.
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { call, publicClient } from '@/api/public-client';
import { startSession } from '@/api/session';
import { failureMessage, messages } from '@/auth/messages';
import { AuthFooter, AuthLayout } from '@/components/auth/auth-layout';
import { GoogleButton } from '@/components/auth/google-button';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
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

export default function SignUpScreen() {
  const router = useRouter();
  const [birthDate, setBirthDate] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const underAge = isUnderAge(birthDate);
  const dateOfBirth = toIsoDate(birthDate);
  const ready = !!dateOfBirth && !underAge && agreed;

  const register = useCallback(
    async (idToken: string) => {
      if (!dateOfBirth) return;
      setError(undefined);
      setLoading(true);
      const registered = await call(() => publicClient.POST('/api/v1/auth/google/register', { body: { idToken } }));
      if (!registered.ok) {
        setLoading(false);
        if (registered.status === 429) {
          router.push('/too-many-attempts');
        } else if (registered.status === 409) {
          setError('Цей Google-акаунт уже зареєстрований. Увійди.');
        } else {
          setError(failureMessage(registered));
        }
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
        setError(completed.status === 422 ? messages.underage : failureMessage(completed));
        return;
      }
      await startSession(completed.data);
      router.replace('/profile-setup');
    },
    [dateOfBirth, router],
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthLayout
        title="Створімо акаунт"
        subtitle="Вкажи дату народження і продовж з Google."
        footer={<AuthFooter question="Вже є акаунт?" link="Увійти" onPress={() => router.replace('/sign-in')} />}
      >
        <TextField
          label="Дата народження"
          placeholder="ДД.ММ.РРРР"
          value={birthDate}
          onChangeText={setBirthDate}
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
        {/* Google draws its own button, which cannot be disabled, so it appears once the form is filled in. */}
        {ready && !loading ? (
          <GoogleButton text="signup_with" onIdToken={register} />
        ) : (
          <Button label="Зареєструватися через Google" variant="dark" loading={loading} disabled />
        )}
        {error && <Text className="text-center font-inter text-caption text-brand-coral">{error}</Text>}
      </AuthLayout>
    </>
  );
}
