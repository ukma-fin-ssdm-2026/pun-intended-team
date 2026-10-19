// Written with the help of Claude
// AI Usage: confirmation code screen from the Figma "В6 Код підтвердження" frame, on mock data; reviewed by Daryna
// Halytska.
import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { mockCredentials } from '@/mocks/auth';
import { colors } from '@/styles/tokens';

const CODE_LENGTH = 6;

export default function VerifyCodeScreen() {
  const router = useRouter();
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState(mockCredentials.code);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthLayout
        title="Введи код"
        subtitle={'Ми надіслали 6-значний код у Telegram\nна номер +380 •• ••• •• 67'}
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
            <Button label="Підтвердити" variant="dark" onPress={() => router.push('/profile-setup')} />
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
      </AuthLayout>
    </>
  );
}
