// Written with the help of Claude
// Parked while sign-in is Google-only (ADR-004): the phone and password sign-in screen (В4), commented out because the API has no routes for it.
// To restore it, uncomment it, put it in place of src/app/sign-in.tsx and regenerate src/api/schema.d.ts.
export {};

// // AI Usage: sign-in screen from the Figma "В4 Вхід" frame, connected to the auth API; reviewed by Daryna Halytska.
// import { Stack, useRouter } from 'expo-router';
// import { useCallback, useState } from 'react';
// import { Pressable, Text, View } from 'react-native';
//
// import { call, publicClient, type ApiResult } from '@/api/public-client';
// import type { components } from '@/api/schema';
// import { startSession } from '@/api/session';
// import { failureMessage, messages } from '@/auth/messages';
// import { toApiPhone } from '@/auth/phone';
// import { AuthFooter, AuthLayout } from '@/components/auth/auth-layout';
// import { GoogleButton } from '@/components/auth/google-button';
// import { Button } from '@/components/ui/button';
// import { TextField } from '@/components/ui/text-field';
// import { useSignIn } from '@/hooks/use-sign-in';
//
// type SessionTokens = components['schemas']['SessionTokensResponse'];
//
// export default function SignInScreen() {
//   const router = useRouter();
//   const openCatalog = useSignIn();
//   const [phone, setPhone] = useState('');
//   const [password, setPassword] = useState('');
//   const [phoneError, setPhoneError] = useState<string>();
//   const [error, setError] = useState<string>();
//   const [loading, setLoading] = useState(false);
//
//   const finish = useCallback(
//     async (result: ApiResult<SessionTokens>, onUnauthorized: string) => {
//       if (result.ok) {
//         await startSession(result.data);
//         openCatalog();
//       } else if (result.status === 429) {
//         router.push('/too-many-attempts');
//       } else {
//         setError(result.status === 401 ? onUnauthorized : failureMessage(result));
//       }
//     },
//     [openCatalog, router],
//   );
//
//   const submit = async () => {
//     const apiPhone = toApiPhone(phone);
//     setPhoneError(apiPhone ? undefined : messages.phone);
//     setError(undefined);
//     if (!apiPhone || !password) return;
//     setLoading(true);
//     const result = await call(() => publicClient.POST('/api/v1/auth/sign-in', { body: { phone: apiPhone, password } }));
//     await finish(result, messages.credentials);
//     setLoading(false);
//   };
//
//   const signInWithGoogle = useCallback(
//     async (idToken: string) => {
//       setError(undefined);
//       const result = await call(() => publicClient.POST('/api/v1/auth/google', { body: { idToken } }));
//       // The API signs in only with a Google account linked from the profile.
//       await finish(result, 'Цей Google-акаунт не прив’язаний. Увійди з номером і паролем і прив’яжи його в профілі.');
//     },
//     [finish],
//   );
//
//   return (
//     <>
//       <Stack.Screen options={{ headerShown: false }} />
//       <AuthLayout
//         title="З поверненням"
//         subtitle="Увійди, щоб бачити свої метчі й події."
//         footer={
//           <AuthFooter question="Немає акаунта?" link="Зареєструватися" onPress={() => router.replace('/sign-up')} />
//         }
//       >
//         <TextField
//           label="Номер телефону"
//           placeholder="+380 67 123 45 67"
//           value={phone}
//           onChangeText={setPhone}
//           keyboardType="phone-pad"
//           autoComplete="tel"
//           error={phoneError}
//         />
//         <TextField
//           label="Пароль"
//           value={password}
//           onChangeText={setPassword}
//           secureTextEntry
//           autoComplete="current-password"
//           onSubmitEditing={submit}
//           error={error}
//         />
//         <View className="items-end">
//           <Pressable accessibilityRole="link" onPress={() => router.push('/forgot-password')}>
//             <Text className="font-inter-medium text-label text-brand-coral">Забули пароль?</Text>
//           </Pressable>
//         </View>
//         <Button label="Увійти" variant="dark" onPress={submit} loading={loading} disabled={!phone || !password} />
//         <GoogleButton text="signin_with" onIdToken={signInWithGoogle} />
//       </AuthLayout>
//     </>
//   );
// }
