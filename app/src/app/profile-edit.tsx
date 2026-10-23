// Written with the help of Claude
// AI Usage: profile editor from the Figma "П1 Редагувати профіль" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  ContactVisibility,
  FormScreen,
  InterestPicker,
  ProfilePhoto,
  toggleInList,
} from '@/components/profile/profile-form';
import { AddSocialSheet, InterestsSheet } from '@/components/profile/profile-sheets';
import { TextField } from '@/components/ui/text-field';
import { mockProfile } from '@/mocks/profile';

export default function ProfileEditScreen() {
  const router = useRouter();
  const [name, setName] = useState(mockProfile.firstName);
  const [occupation, setOccupation] = useState('');
  const [about, setAbout] = useState('');
  const [interests, setInterests] = useState(mockProfile.interests);
  // Interests saved on П1.2 join the chips shown here.
  const [interestOptions, setInterestOptions] = useState([...mockProfile.interests, ...mockProfile.moreInterests]);
  // "+ ще" opens П1.2 Інтереси, "+ Додати соцмережу" П1.1.
  const [sheet, setSheet] = useState<'interests' | 'social' | null>(null);
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
            options={interestOptions}
            selected={interests}
            onToggle={(interest) => setInterests((current) => toggleInList(current, interest))}
            note={`обрано ${interests.length}`}
            onMore={() => setSheet('interests')}
          />

          <View className="gap-3 pt-3">
            <Text className="font-inter-semibold text-title text-text-primary">Контакти для метчів</Text>
            <TextField label="Нікнейм у Telegram" value={telegram} onChangeText={setTelegram} />
            <TextField label="Номер телефону" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <Pressable accessibilityRole="button" onPress={() => setSheet('social')} className="self-start">
              <Text className="font-inter-medium text-label text-brand-coral">+ Додати соцмережу</Text>
            </Pressable>
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

      {sheet === 'interests' && (
        <InterestsSheet
          visible
          selected={interests}
          onClose={() => setSheet(null)}
          onSave={(saved) => {
            setInterests(saved);
            setInterestOptions((current) => [...saved, ...current.filter((interest) => !saved.includes(interest))]);
            setSheet(null);
          }}
        />
      )}
      <AddSocialSheet visible={sheet === 'social'} onClose={() => setSheet(null)} />
    </>
  );
}
