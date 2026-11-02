// Written with the help of Claude
// Parked while sign-in is Google-only (ADR-004): the phone sign-up screen (В5), commented out because the API has no routes for it.
// To restore it, uncomment it, put it in place of src/app/sign-up.tsx and regenerate src/api/schema.d.ts.
export {};

// // AI Usage: sign-up screen from the Figma "В5 Реєстрація" frame, connected to the auth API; reviewed by Daryna
// // Halytska.
// import { Stack, useRouter } from 'expo-router';
// import { useState } from 'react';
// import { Pressable, Text, View } from 'react-native';
//
// import { call, publicClient } from '@/api/public-client';
// import { failureMessage, messages } from '@/auth/messages';
// import { toApiPhone } from '@/auth/phone';
// import { AuthFooter, AuthLayout } from '@/components/auth/auth-layout';
// import { Button } from '@/components/ui/button';
// import { Icon } from '@/components/ui/icon';
// import { TextField } from '@/components/ui/text-field';
// import { startAuthFlow } from '@/state/auth-flow';
// import { colors } from '@/styles/tokens';
//
// const MIN_AGE = 18;
//
// // "ДД.ММ.РРРР" → whether the person is under 18 today; an incomplete date is not an error yet.
// function isUnderAge(value: string, today = new Date()) {
//   const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
//   if (!match) return false;
//   const [, day, month, year] = match.map(Number);
//   const adulthood = new Date(year + MIN_AGE, month - 1, day);
//   return adulthood > today;
// }
//
// // "ДД.ММ.РРРР" → "РРРР-ММ-ДД"; undefined unless it is a real date.
// function toIsoDate(value: string): string | undefined {
//   const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
//   if (!match) return undefined;
//   const [, day, month, year] = match;
//   const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
//   return date.getUTCDate() === Number(day) && date.getUTCMonth() + 1 === Number(month)
//     ? `${year}-${month}-${day}`
//     : undefined;
// }
//
// export default function SignUpScreen() {
//   const router = useRouter();
//   const [phone, setPhone] = useState('');
//   const [birthDate, setBirthDate] = useState('');
//   const [agreed, setAgreed] = useState(false);
//   const [phoneError, setPhoneError] = useState<string>();
//   const [dateError, setDateError] = useState<string>();
//   const [loading, setLoading] = useState(false);
//   const underAge = isUnderAge(birthDate);
//
//   const submit = async () => {
//     const apiPhone = toApiPhone(phone);
//     const dateOfBirth = toIsoDate(birthDate);
//     setPhoneError(apiPhone ? undefined : messages.phone);
//     setDateError(dateOfBirth ? undefined : 'Введи дату як ДД.ММ.РРРР');
//     if (!apiPhone || !dateOfBirth || underAge) return;
//     setLoading(true);
//     const result = await call(() => publicClient.POST('/api/v1/auth/register', { body: { phone: apiPhone } }));
//     setLoading(false);
//     if (result.ok) {
//       startAuthFlow({ purpose: 'register', phone: apiPhone, dateOfBirth });
//       router.push('/verify-code');
//     } else if (result.status === 429) {
//       router.push('/too-many-attempts');
//     } else {
//       setPhoneError(result.status === 400 ? messages.phone : failureMessage(result));
//     }
//   };
//
//   return (
//     <>
//       <Stack.Screen options={{ headerShown: false }} />
//       <AuthLayout
//         title="Створімо акаунт"
//         subtitle="Ми надішлемо тобі код, щоб переконатися, що що ти справді існуєш."
//         footer={<AuthFooter question="Вже є акаунт?" link="Увійти" onPress={() => router.replace('/sign-in')} />}
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
//           label="Дата народження"
//           placeholder="ДД.ММ.РРРР"
//           value={birthDate}
//           onChangeText={setBirthDate}
//           keyboardType="number-pad"
//           error={underAge ? messages.underage : dateError}
//         />
//         <View className="flex-row items-center gap-2.5">
//           <Pressable
//             accessibilityRole="checkbox"
//             accessibilityState={{ checked: agreed }}
//             accessibilityLabel="Погоджуюсь з правилами спільноти та політикою конфіденційності"
//             onPress={() => setAgreed((value) => !value)}
//             hitSlop={8}
//             className={`size-[22px] items-center justify-center rounded-[7px] ${
//               agreed ? 'bg-brand-ink' : 'border-[1.5px] border-border-default bg-surface-card'
//             }`}
//           >
//             {agreed && <Icon name="checkbox-check" size={16} color={colors.text['on-dark']} />}
//           </Pressable>
//           {/* The rules and the privacy policy have no prototype links; shown as in Figma. */}
//           <Text className="flex-1 font-inter text-caption text-text-secondary">
//             Погоджуюсь з <Text className="font-inter-semibold text-text-primary underline">правилами спільноти</Text> та{' '}
//             <Text className="font-inter-semibold text-text-primary underline">політикою конфіденційності</Text>
//           </Text>
//         </View>
//         <Button
//           label="Надіслати код"
//           variant="dark"
//           onPress={submit}
//           loading={loading}
//           disabled={!phone || !birthDate || underAge || !agreed}
//         />
//       </AuthLayout>
//     </>
//   );
// }
