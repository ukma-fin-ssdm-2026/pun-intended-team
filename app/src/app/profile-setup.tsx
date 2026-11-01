// Written with the help of Claude
// AI Usage: first sign-up profile step from the Figma "В7 Заповнення профілю" frame, connected to the API; reviewed by
// Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { createProfile, replaceInterests, updateProfile } from '@/api/profile';
import type { components } from '@/api/schema';
import { failureSnackbar } from '@/auth/messages';
import {
  FormatPicker,
  FormScreen,
  InterestPicker,
  interestChips,
  isValidUsername,
  ProfilePhoto,
  toggleInList,
} from '@/components/profile/profile-form';
import { InterestsSheet } from '@/components/profile/profile-sheets';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { TextField } from '@/components/ui/text-field';
import { useInterests } from '@/hooks/use-interests';
import { takeProfileSuggestion } from '@/state/google-registration';

type CommunicationFormat = components['schemas']['CommunicationFormat'];

const MIN_INTERESTS = 3;
const INTEREST_CHIPS = 7;

export default function ProfileSetupScreen() {
  const router = useRouter();
  const [suggestion] = useState(takeProfileSuggestion);
  const [name, setName] = useState(suggestion.displayName);
  const [username, setUsername] = useState(suggestion.username);
  const [usernameTaken, setUsernameTaken] = useState(false);
  // Hidden: the API has no field for it yet.
  // const [occupation, setOccupation] = useState('');
  const [about, setAbout] = useState('');
  const [format, setFormat] = useState<CommunicationFormat | null>(null);
  const [interestIds, setInterestIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const interests = useInterests();
  const { snackbar, show, hide } = useSnackbar();

  const usernameValid = isValidUsername(username);
  let usernameError: string | undefined;
  if (usernameTaken) usernameError = 'Цей нікнейм уже зайнятий';
  else if (username && !usernameValid) usernameError = 'Від 3 до 30 латинських літер, цифр, крапок або _';
  const ready = !!name.trim() && usernameValid && !!format && interestIds.length >= MIN_INTERESTS;

  const save = async () => {
    if (!format) return;
    hide();
    setSaving(true);
    const identity = { username: username.trim(), displayName: name.trim() };
    const created = await createProfile(identity);
    const exists = !created.ok && created.code === 'PROFILE_EXISTS';
    if (!created.ok && !exists) {
      setSaving(false);
      if (created.code === 'USERNAME_TAKEN') setUsernameTaken(true);
      else show(failureSnackbar(created));
      return;
    }
    const updated = await updateProfile({
      ...(exists ? identity : {}),
      description: about.trim(),
      communicationFormat: format,
    });
    const saved = updated.ok ? await replaceInterests(interestIds) : updated;
    setSaving(false);
    if (!saved.ok) {
      if (saved.code === 'USERNAME_TAKEN') setUsernameTaken(true);
      else show(failureSnackbar(saved));
      return;
    }
    router.push('/profile-contacts');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FormScreen
        step={{ current: 1, total: 2 }}
        action={{ label: 'Далі', onPress: () => void save(), disabled: !ready, loading: saving }}
      >
        <ProfilePhoto />
        <View className="gap-3 px-5 pt-4">
          <TextField label="Ім'я" required value={name} onChangeText={setName} />
          <TextField
            label="Нікнейм"
            required
            value={username}
            onChangeText={(value) => {
              setUsername(value);
              setUsernameTaken(false);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            error={usernameError}
          />
          {/* Hidden: the API has no field for it yet.
          <TextField
            label="Чим займаєшся?"
            placeholder="Наприклад, студентка КМА"
            value={occupation}
            onChangeText={setOccupation}
          /> */}
          <TextField
            label="Про себе"
            placeholder="Що любиш, куди ходиш, з ким цікаво"
            value={about}
            onChangeText={setAbout}
            maxLength={500}
          />
          <FormatPicker value={format} onChange={setFormat} />
          <InterestPicker
            options={interestChips(interests.data ?? [], interestIds, INTEREST_CHIPS)}
            selected={interestIds}
            onToggle={(id) => setInterestIds((current) => toggleInList(current, id))}
            note={`обрано ${interestIds.length} · мін. ${MIN_INTERESTS}`}
            onMore={interests.data ? () => setSheetOpen(true) : undefined}
          />
          {interests.error && (
            <Text className="font-inter text-caption text-brand-coral">Не вдалося завантажити інтереси</Text>
          )}
        </View>
      </FormScreen>

      {sheetOpen && (
        <InterestsSheet
          visible
          options={interests.data ?? []}
          selected={interestIds}
          onClose={() => setSheetOpen(false)}
          onSave={(saved) => {
            setInterestIds(saved);
            setSheetOpen(false);
          }}
        />
      )}
      {snackbar && <Snackbar {...snackbar} />}
    </>
  );
}
