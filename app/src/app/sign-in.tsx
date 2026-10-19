// Written with the help of Claude
// AI Usage: sign-in screen from the Figma "В4 Вхід" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthFooter, AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useSignIn } from '@/hooks/use-sign-in';
import { mockCredentials } from '@/mocks/auth';

export default function SignInScreen() {
  const router = useRouter();
  const signIn = useSignIn();
  const [phone, setPhone] = useState(mockCredentials.phone);
  const [password, setPassword] = useState(mockCredentials.password);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthLayout
        title="З поверненням"
        subtitle="Увійди, щоб бачити свої метчі й події."
        footer={
          <AuthFooter question="Немає акаунта?" link="Зареєструватися" onPress={() => router.replace('/sign-up')} />
        }
      >
        <TextField label="Номер телефону" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Пароль" value={password} onChangeText={setPassword} secureTextEntry />
        <View className="items-end">
          <Pressable accessibilityRole="link" onPress={() => router.push('/forgot-password')}>
            <Text className="font-inter-medium text-label text-brand-coral">Забули пароль?</Text>
          </Pressable>
        </View>
        <Button label="Увійти" variant="dark" onPress={signIn} />
      </AuthLayout>
    </>
  );
}
