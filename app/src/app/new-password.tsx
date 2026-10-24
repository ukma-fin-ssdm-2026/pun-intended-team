// Written with the help of Claude
// AI Usage: new password screen from the Figma "В4.2 Новий пароль" frame, connected to the auth API; reviewed by Daryna
// Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { apiClient } from '@/api/client';
import { call, publicClient } from '@/api/public-client';
import { startSession } from '@/api/session';
import { failureMessage, messages } from '@/auth/messages';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useSignIn } from '@/hooks/use-sign-in';
import { getAuthFlow } from '@/state/auth-flow';

// The hint under the fields; the API itself asks only for 8 characters.
function isStrongEnough(password: string) {
  return password.length >= 8 && /\p{L}/u.test(password) && /\d/.test(password);
}

// After a password reset it sets the new password and signs in; during sign-up, the same frame sets the first password
// of the account that is already signed in, and the profile steps (В7, В8) follow.
export default function NewPasswordScreen() {
  const router = useRouter();
  const openCatalog = useSignIn();
  const flow = getAuthFlow();
  const registering = flow.purpose === 'register';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!isStrongEnough(password)) return setError('Пароль закороткий або без літер чи цифр');
    if (password !== repeat) return setError('Паролі не збігаються');
    setError(undefined);
    setLoading(true);
    if (registering) {
      const result = await call(() => apiClient.PUT('/api/v1/me/password', { body: { password } }));
      setLoading(false);
      if (result.ok) router.replace('/profile-setup');
      else setError(failureMessage(result));
      return;
    }
    const result = await call(() =>
      publicClient.POST('/api/v1/auth/password-reset/confirm', {
        body: { phone: flow.phone, code: flow.code ?? '', password },
      }),
    );
    setLoading(false);
    if (result.ok) {
      await startSession(result.data);
      openCatalog();
    } else if (result.status === 429) {
      router.push('/too-many-attempts');
    } else {
      setError(result.status === 422 ? `${messages.code}. Повернись і введи його ще раз.` : failureMessage(result));
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthLayout
        title={registering ? 'Пароль для входу' : 'Новий пароль'}
        subtitle={
          registering
            ? 'Номер підтверджено. Придумай пароль, щоб входити з ним.'
            : 'Код підтверджено. Придумай новий пароль для входу.'
        }
      >
        <TextField
          label="Новий пароль"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <TextField
          label="Повтори пароль"
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
          autoComplete="new-password"
          onSubmitEditing={submit}
          error={error}
        />
        <Text className="font-inter text-caption text-text-secondary">Щонайменше 8 символів, з літерами й цифрами</Text>
        <Button
          label={registering ? 'Далі' : 'Зберегти й увійти'}
          variant="dark"
          onPress={submit}
          loading={loading}
          disabled={!password || !repeat}
        />
      </AuthLayout>
    </>
  );
}
