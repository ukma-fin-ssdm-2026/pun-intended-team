// Written with the help of Claude
// AI Usage: sign-up screen from the Figma "В5 Реєстрація" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthFooter, AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { mockCredentials } from '@/mocks/auth';
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

export default function SignUpScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState(mockCredentials.phone);
  const [birthDate, setBirthDate] = useState(mockCredentials.birthDate);
  const [agreed, setAgreed] = useState(true);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthLayout
        title="Створімо акаунт"
        subtitle="Ми надішлемо тобі код, щоб переконатися, що що ти справді існуєш."
        footer={<AuthFooter question="Вже є акаунт?" link="Увійти" onPress={() => router.replace('/sign-in')} />}
      >
        <TextField label="Номер телефону" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField
          label="Дата народження"
          value={birthDate}
          onChangeText={setBirthDate}
          keyboardType="number-pad"
          error={isUnderAge(birthDate) ? 'Nearby лише для людей від 18 років' : undefined}
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
        <Button label="Надіслати код" variant="dark" onPress={() => router.push('/verify-code')} />
      </AuthLayout>
    </>
  );
}
