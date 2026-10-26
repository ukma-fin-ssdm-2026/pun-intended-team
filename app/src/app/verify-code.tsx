// Written with the help of Claude
// AI Usage: confirmation code screen from the Figma "В6 Код підтвердження" frame, connected to the auth API; reviewed
// by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { call, publicClient } from '@/api/public-client';
import { startSession } from '@/api/session';
import { failureMessage, messages } from '@/auth/messages';
import { maskPhone } from '@/auth/phone';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { getAuthFlow, updateAuthFlow } from '@/state/auth-flow';
import { colors } from '@/styles/tokens';

const CODE_LENGTH = 6;

// Registration: `verify`, then `completeRegistration` with the date of birth from В5, then a password on В4.2.
// Password reset: the code is checked together with the new password on В4.2.
export default function VerifyCodeScreen() {
  const router = useRouter();
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const flow = getAuthFlow();

  const confirm = async () => {
    setError(undefined);
    if (flow.purpose === 'reset') {
      updateAuthFlow({ code });
      router.push('/new-password');
      return;
    }
    setLoading(true);
    const failure = await register();
    setLoading(false);
    if (failure) setError(failure);
  };

  // Returns what to show when it fails.
  const register = async (): Promise<string | undefined> => {
    let registrationToken = flow.registrationToken;
    if (!registrationToken) {
      const verified = await call(() =>
        publicClient.POST('/api/v1/auth/verify', { body: { phone: flow.phone, code } }),
      );
      if (!verified.ok) {
        if (verified.status === 429) {
          router.push('/too-many-attempts');
          return undefined;
        }
        if (verified.status === 409) return 'Цей номер уже зареєстрований. Увійди з ним.';
        return verified.status === 422 || verified.status === 400 ? messages.code : failureMessage(verified);
      }
      registrationToken = verified.data.accessToken;
      updateAuthFlow({ registrationToken });
    }
    const completed = await call(() =>
      publicClient.POST('/api/v1/auth/complete-registration', {
        body: { dateOfBirth: flow.dateOfBirth ?? '' },
        headers: { Authorization: `Bearer ${registrationToken}` },
      }),
    );
    if (!completed.ok) {
      if (completed.status === 422) return messages.underage;
      // The registration token expired or the registration was removed: start again on В5.
      if (completed.status === 401 || completed.status === 404) {
        updateAuthFlow({ registrationToken: undefined });
        return 'Реєстрація застаріла. Почни ще раз.';
      }
      return failureMessage(completed);
    }
    await startSession(completed.data);
    router.replace('/new-password');
    return undefined;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthLayout
        title="Введи код"
        subtitle={`Ми надіслали 6-значний код у Telegram\nна номер ${maskPhone(flow.phone)}`}
        footer={
          <View className="gap-4">
            <View className="items-center gap-2.5 overflow-hidden">
              {/* The timer and "Отримати код через SMS" have no prototype links; shown as in Figma. */}
              <View className="flex-row items-center gap-1.5">
                <Icon name="clock" size={16} color={colors.text.secondary} />
                <Text className="font-inter text-caption text-text-secondary">Надіслати ще раз через 0:42</Text>
              </View>
              <Text className="font-inter-medium text-label text-brand-coral">Отримати код через SMS</Text>
            </View>
            <View className="flex-row items-center gap-2.5 rounded-2xl bg-surface-background px-3.5 py-3">
              <Icon name="shield" size={18} color={colors.text.secondary} />
              <Text className="flex-1 font-inter text-caption text-text-secondary">
                Код діє 10 хвилин. Нікому його не повідомляй.
              </Text>
            </View>
            <Button
              label="Підтвердити"
              variant="dark"
              onPress={confirm}
              loading={loading}
              disabled={code.length !== CODE_LENGTH}
            />
          </View>
        }
      >
        {/* "02.1 Комірки коду": one hidden input under six cells; the next empty cell shows the cursor. */}
        <Pressable accessibilityLabel="Код підтвердження" onPress={() => input.current?.focus()}>
          <View className="flex-row gap-2">
            {Array.from({ length: CODE_LENGTH }, (_, index) => {
              const current = index === code.length;
              return (
                <View
                  key={index}
                  className={`h-[72px] flex-1 items-center justify-center rounded-2xl border-[1.5px] bg-surface-background ${
                    current ? 'border-brand-ink' : 'border-transparent'
                  }`}
                >
                  {current ? (
                    <View className="h-[30px] w-0.5 bg-brand-coral" />
                  ) : (
                    <Text className="font-inter-bold text-[30px] text-text-primary">{code[index]}</Text>
                  )}
                </View>
              );
            })}
          </View>
          <TextInput
            ref={input}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            caretHidden
            className="absolute inset-0 opacity-0"
          />
        </Pressable>
        {error && <Text className="font-inter text-caption text-brand-coral">{error}</Text>}
      </AuthLayout>
    </>
  );
}
