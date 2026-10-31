// Written with the help of Claude
// Parked while sign-in is Google-only (ADR-004): the password reset screen (В4.1), commented out because the API has no routes for it.
// To restore it, uncomment it, move it back to src/app/forgot-password.tsx and regenerate src/api/schema.d.ts.
export {};

// // AI Usage: password recovery screen from the Figma "В4.1 Забули пароль" frame, connected to the auth API; reviewed by
// // Daryna Halytska.
// import { Stack, useRouter } from 'expo-router';
// import { useState } from 'react';
//
// import { call, publicClient } from '@/api/public-client';
// import { failureMessage, messages } from '@/auth/messages';
// import { toApiPhone } from '@/auth/phone';
// import { AuthFooter, AuthLayout } from '@/components/auth/auth-layout';
// import { Button } from '@/components/ui/button';
// import { TextField } from '@/components/ui/text-field';
// import { startAuthFlow } from '@/state/auth-flow';
//
// export default function ForgotPasswordScreen() {
//   const router = useRouter();
//   const [phone, setPhone] = useState('');
//   const [error, setError] = useState<string>();
//   const [loading, setLoading] = useState(false);
//
//   const submit = async () => {
//     const apiPhone = toApiPhone(phone);
//     setError(apiPhone ? undefined : messages.phone);
//     if (!apiPhone) return;
//     setLoading(true);
//     // The API answers the same whether or not the number has an account.
//     const result = await call(() => publicClient.POST('/api/v1/auth/password-reset', { body: { phone: apiPhone } }));
//     setLoading(false);
//     if (result.ok) {
//       startAuthFlow({ purpose: 'reset', phone: apiPhone });
//       router.push('/verify-code');
//     } else if (result.status === 429) {
//       router.push('/too-many-attempts');
//     } else {
//       setError(failureMessage(result));
//     }
//   };
//
//   return (
//     <>
//       <Stack.Screen options={{ headerShown: false }} />
//       <AuthLayout
//         title="Забули пароль?"
//         subtitle="Введи номер телефону, і ми надішлемо код, щоб відновити доступ."
//         footer={<AuthFooter question="Пам’ятаєш пароль?" link="Увійти" onPress={() => router.dismissTo('/sign-in')} />}
//       >
//         <TextField
//           label="Номер телефону"
//           placeholder="+380 67 123 45 67"
//           value={phone}
//           onChangeText={setPhone}
//           keyboardType="phone-pad"
//           autoComplete="tel"
//           error={error}
//         />
//         <Button label="Надіслати код" variant="dark" onPress={submit} loading={loading} disabled={!phone} />
//       </AuthLayout>
//     </>
//   );
// }
