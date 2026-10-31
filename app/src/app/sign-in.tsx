// Written with the help of Claude
// AI Usage: sign-in screen based on the Figma "В4 Вхід" frame, with Google only.
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { call, publicClient } from '@/api/public-client';
import { startSession } from '@/api/session';
import { failureMessage } from '@/auth/messages';
import { AuthFooter, AuthLayout } from '@/components/auth/auth-layout';
import { GoogleButton } from '@/components/auth/google-button';
import { useSignIn } from '@/hooks/use-sign-in';

export default function SignInScreen() {
  const router = useRouter();
  const openCatalog = useSignIn();
  const [error, setError] = useState<string>();

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      setError(undefined);
      const result = await call(() => publicClient.POST('/api/v1/auth/google', { body: { idToken } }));
      if (result.ok) {
        await startSession(result.data);
        openCatalog();
      } else if (result.status === 429) {
        router.push('/too-many-attempts');
      } else {
        setError(
          result.status === 401 ? 'Цей Google-акаунт ще не зареєстрований. Зареєструйся.' : failureMessage(result),
        );
      }
    },
    [openCatalog, router],
  );

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
        <GoogleButton text="signin_with" onIdToken={signInWithGoogle} />
        {error && <Text className="text-center font-inter text-caption text-brand-coral">{error}</Text>}
      </AuthLayout>
    </>
  );
}
