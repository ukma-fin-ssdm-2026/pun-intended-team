// Written with the help of Claude
// AI Usage: password recovery screen from the Figma "В4.1 Забули пароль" frame, on mock data; reviewed by Daryna
// Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { AuthFooter, AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { mockCredentials } from '@/mocks/auth';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState(mockCredentials.phone);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthLayout
        title="Забули пароль?"
        subtitle="Введи номер телефону, і ми надішлемо код, щоб відновити доступ."
        footer={<AuthFooter question="Пам’ятаєш пароль?" link="Увійти" onPress={() => router.dismissTo('/sign-in')} />}
      >
        <TextField label="Номер телефону" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button label="Надіслати код" variant="dark" onPress={() => router.push('/new-password')} />
      </AuthLayout>
    </>
  );
}
