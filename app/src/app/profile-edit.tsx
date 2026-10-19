// Written with the help of Claude
// AI Usage: profile editor from the Figma "П1 Редагувати профіль" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  ContactVisibility,
  FormScreen,
  InterestPicker,
  ProfilePhoto,
  toggleInList,
} from '@/components/profile/profile-form';
import { TextField } from '@/components/ui/text-field';
import { mockProfile } from '@/mocks/profile';

export default function ProfileEditScreen() {
  const router = useRouter();
  const [name, setName] = useState(mockProfile.firstName);
  const [occupation, setOccupation] = useState('');
  const [about, setAbout] = useState('');
  const [interests, setInterests] = useState(mockProfile.interests);
  const [telegram, setTelegram] = useState(mockProfile.telegram);
  const [phone, setPhone] = useState(mockProfile.phone);
  // Figma: Telegram is shared with a mutual match, the phone number is not.
  const [showTelegram, setShowTelegram] = useState(true);
  const [showPhone, setShowPhone] = useState(false);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* "Зберегти" returns to the profile (Т4), as in the prototype. */}
      <FormScreen title="Редагувати профіль" action={{ label: 'Зберегти', onPress: () => router.back() }}>
        <ProfilePhoto />

        <View className="gap-3 px-5 pt-4">
          <TextField label="Ім'я" required value={name} onChangeText={setName} />
          <TextField
            label="Чим займаєшся?"
            placeholder="Наприклад, студентка КМА"
            value={occupation}
            onChangeText={setOccupation}
          />
          <TextField
            label="Про себе"
            placeholder="Що любиш, куди ходиш, з ким цікаво"
            value={about}
            onChangeText={setAbout}
          />
          <InterestPicker
            options={[...mockProfile.interests, ...mockProfile.moreInterests]}
            selected={interests}
            onToggle={(interest) => setInterests((current) => toggleInList(current, interest))}
            note={`обрано ${interests.length}`}
          />

          <View className="gap-3 pt-3">
            <Text className="font-inter-semibold text-title text-text-primary">Контакти для метчів</Text>
            <TextField label="Нікнейм у Telegram" value={telegram} onChangeText={setTelegram} />
            <TextField label="Номер телефону" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            {/* "+ Додати соцмережу" has no prototype link; shown as in Figma. */}
            <Text className="font-inter-medium text-label text-brand-coral">+ Додати соцмережу</Text>
            <ContactVisibility
              telegram={telegram}
              showTelegram={showTelegram}
              onShowTelegramChange={setShowTelegram}
              showPhone={showPhone}
              onShowPhoneChange={setShowPhone}
            />
          </View>
        </View>
      </FormScreen>
    </>
  );
}
