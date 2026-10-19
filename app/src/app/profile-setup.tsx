// Written with the help of Claude
// AI Usage: first sign-up profile step from the Figma "В7 Заповнення профілю" frame, on mock data; reviewed by Daryna
// Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { FormScreen, InterestPicker, ProfilePhoto, toggleInList } from '@/components/profile/profile-form';
import { TextField } from '@/components/ui/text-field';
import { mockProfile } from '@/mocks/profile';

const MIN_INTERESTS = 3;

export default function ProfileSetupScreen() {
  const router = useRouter();
  const [name, setName] = useState(mockProfile.firstName);
  const [occupation, setOccupation] = useState('');
  const [about, setAbout] = useState('');
  const [interests, setInterests] = useState(mockProfile.interests);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FormScreen
        step={{ current: 1, total: 2 }}
        action={{
          label: 'Далі',
          onPress: () => router.push('/profile-contacts'),
          // Ім'я and at least three interests are required (marked * in Figma).
          disabled: !name.trim() || interests.length < MIN_INTERESTS,
        }}
      >
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
            note={`обрано ${interests.length} · мін. ${MIN_INTERESTS}`}
          />
        </View>
      </FormScreen>
    </>
  );
}
