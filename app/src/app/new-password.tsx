// Written with the help of Claude
// AI Usage: new password screen from the Figma "В4.2 Новий пароль" frame, on mock data; reviewed by Daryna Halytska.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useSignIn } from '@/hooks/use-sign-in';
import { mockCredentials } from '@/mocks/auth';

export default function NewPasswordScreen() {
  const signIn = useSignIn();
  const [password, setPassword] = useState(mockCredentials.password);
  const [repeat, setRepeat] = useState(mockCredentials.password);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthLayout title="Новий пароль" subtitle="Код підтверджено. Придумай новий пароль для входу.">
        <TextField label="Новий пароль" value={password} onChangeText={setPassword} secureTextEntry />
        <TextField label="Повтори пароль" value={repeat} onChangeText={setRepeat} secureTextEntry />
        <Text className="font-inter text-caption text-text-secondary">Щонайменше 8 символів, з літерами й цифрами</Text>
        <Button label="Зберегти й увійти" variant="dark" onPress={signIn} />
      </AuthLayout>
    </>
  );
}
