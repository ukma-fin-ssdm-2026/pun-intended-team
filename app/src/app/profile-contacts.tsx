// Written with the help of Claude
// AI Usage: second sign-up profile step from the Figma "В8 Заповнення профілю · Крок 2" frame, on mock data; reviewed
// by Daryna Halytska.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ContactVisibility, FormScreen } from '@/components/profile/profile-form';
import { TextField } from '@/components/ui/text-field';
import { useSignIn } from '@/hooks/use-sign-in';

export default function ProfileContactsScreen() {
  const signIn = useSignIn();
  const [telegram, setTelegram] = useState('');
  // Hidden while sign-in is Google-only (ADR-004): there is no verified phone number.
  // const [phone, setPhone] = useState('');
  // Figma: Telegram is shared with a mutual match, the phone number is not.
  const [showTelegram, setShowTelegram] = useState(true);
  // const [showPhone, setShowPhone] = useState(false);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* "Готово" opens the catalog with a new history, as signing in does. */}
      <FormScreen step={{ current: 2, total: 2 }} action={{ label: 'Готово', onPress: signIn }}>
        <View className="gap-3 px-5 pt-2">
          <View className="gap-1.5 overflow-hidden pb-2">
            <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
              Як з тобою зв’язатися?
            </Text>
            <Text className="font-inter text-body text-text-secondary">
              Ці контакти побачить лише взаємний метч. До взаємної згоди вони приховані.
            </Text>
          </View>
          <TextField label="Нікнейм у Telegram" value={telegram} onChangeText={setTelegram} />
          {/* Hidden while sign-in is Google-only (ADR-004): there is no verified phone number.
          <TextField label="Номер телефону" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /> */}
          {/* "+ Додати соцмережу" has no prototype link; shown as in Figma. */}
          <Text className="font-inter-medium text-label text-brand-coral">+ Додати соцмережу</Text>
          <ContactVisibility telegram={telegram} showTelegram={showTelegram} onShowTelegramChange={setShowTelegram} />
        </View>
      </FormScreen>
    </>
  );
}
