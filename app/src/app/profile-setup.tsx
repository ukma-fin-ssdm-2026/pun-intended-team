// Written with the help of Claude
// AI Usage: first sign-up profile step from the Figma "В7 Заповнення профілю" frame, connected to the API; reviewed by
// Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { createProfile, replaceInterests, updateProfile } from '@/api/profile';
import type { components } from '@/api/schema';
import { failureSnackbar, pictureFailureSnackbar, pictureRefusalSnackbar } from '@/auth/messages';
import {
  FormatPicker,
  FormScreen,
  GenderField,
  genderFields,
  isGenderComplete,
  type GenderAnswer,
  InterestPicker,
  useInterestChips,
  isValidUsername,
  MIN_INTERESTS,
  toggleInList,
} from '@/components/profile/profile-form';
import { picturesOf, ProfilePhoto, savePictures } from '@/components/profile/profile-pictures';
import { InterestsSheet } from '@/components/profile/profile-sheets';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { TextField } from '@/components/ui/text-field';
import { useInterests } from '@/hooks/use-interests';
import { takeProfileSuggestion } from '@/state/google-registration';
import { restoredDraftSnackbar, useProfileDraft, useStoredProfileDraft } from '@/state/profile-drafts';
import { useRandomText } from '@/random-texts';

type CommunicationFormat = components['schemas']['CommunicationFormat'];

type SetupDraft = {
  name: string;
  username: string;
  occupation: string;
  about: string;
  gender: GenderAnswer;
  format: CommunicationFormat | null;
  interestIds: string[];
};

export default function ProfileSetupScreen() {
  // Read once: "Скинути" goes back to the Google name, not to empty fields.
  const [suggestion] = useState(takeProfileSuggestion);
  const stored = useStoredProfileDraft<SetupDraft>('setup');
  if (!stored.loaded) return <Stack.Screen options={{ headerShown: false }} />;
  const empty: SetupDraft = {
    name: suggestion.displayName,
    username: suggestion.username,
    occupation: '',
    about: '',
    gender: { gender: null, description: '' },
    format: null,
    interestIds: [],
  };
  return <SetupForm key={stored.version} empty={empty} draft={stored.draft} onReset={stored.drop} />;
}

function SetupForm({
  empty,
  draft,
  onReset,
}: Readonly<{ empty: SetupDraft; draft?: Partial<SetupDraft>; onReset: () => void }>) {
  const router = useRouter();
  const [initial] = useState(() => ({ ...empty, ...draft }));
  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [occupation, setOccupation] = useState(initial.occupation);
  const occupationPlaceholder = useRandomText('occupation');
  const [about, setAbout] = useState(initial.about);
  const [gender, setGender] = useState<GenderAnswer>(initial.gender);
  const [format, setFormat] = useState<CommunicationFormat | null>(initial.format);
  const [interestIds, setInterestIds] = useState<string[]>(initial.interestIds);
  // Held until "Далі" creates the profile, then sent.
  const [pictures, setPictures] = useState(() => picturesOf(undefined));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const interests = useInterests();
  const interestChipOptions = useInterestChips(interests.data ?? [], interestIds);
  const { snackbar, show, hide } = useSnackbar();
  const values: SetupDraft = { name, username, occupation, about, gender, format, interestIds };
  const discardDraft = useProfileDraft('setup', values, JSON.stringify(values) === JSON.stringify(empty));

  useEffect(() => {
    if (draft) show(restoredDraftSnackbar(onReset));
  }, [draft, onReset, show]);

  const usernameValid = isValidUsername(username);
  let usernameError: string | undefined;
  if (usernameTaken) usernameError = 'Цей нікнейм уже зайнятий';
  else if (username && !usernameValid) usernameError = 'Від 3 до 30 латинських літер, цифр, крапок або _';
  const ready =
    !!name.trim() && isGenderComplete(gender) && usernameValid && !!format && interestIds.length >= MIN_INTERESTS;

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
      occupation: occupation.trim(),
      communicationFormat: format,
      ...genderFields(gender),
    });
    const saved = updated.ok ? await replaceInterests(interestIds) : updated;
    if (!saved.ok) {
      setSaving(false);
      if (saved.code === 'USERNAME_TAKEN') setUsernameTaken(true);
      else show(failureSnackbar(saved));
      return;
    }
    const sent = await savePictures(pictures);
    setSaving(false);
    if (sent && !sent.ok) {
      // The rest is saved; "Далі" again sends only the pictures.
      show(pictureFailureSnackbar(sent));
      return;
    }
    setPictures(picturesOf(undefined));
    discardDraft();
    router.push('/profile-contacts');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FormScreen
        step={{ current: 1, total: 2 }}
        backTo="/onboarding"
        action={{ label: 'Далі', onPress: () => void save(), disabled: !ready, loading: saving }}
      >
        <ProfilePhoto
          pictures={pictures}
          onChange={setPictures}
          onRefused={(refusal) => show(pictureRefusalSnackbar(refusal))}
        />
        <View className="gap-3 px-5 pt-4">
          <TextField label="Ім'я" required value={name} onChangeText={setName} maxLength={50} />
          <GenderField value={gender} onChange={setGender} />
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
          <TextField
            label="Чим займаєшся?"
            placeholder={occupationPlaceholder}
            value={occupation}
            onChangeText={setOccupation}
            maxLength={100}
          />
          <TextField
            label="Про себе"
            placeholder="Що любиш, куди ходиш, з ким цікаво"
            value={about}
            onChangeText={setAbout}
            maxLength={500}
          />
          <FormatPicker value={format} onChange={setFormat} />
          <InterestPicker
            options={interestChipOptions}
            selected={interestIds}
            onToggle={(id) => setInterestIds((current) => toggleInList(current, id))}
            note={`обрано ${interestIds.length} · мін. ${MIN_INTERESTS}`}
            onMore={interests.data ? () => setSheetOpen(true) : undefined}
            onRetry={interests.failed ? interests.reload : undefined}
          />
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
