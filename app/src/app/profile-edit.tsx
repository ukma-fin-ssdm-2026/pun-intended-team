// Written with the help of Claude
// AI Usage: profile editor from the Figma "П1 Редагувати профіль" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { replaceInterests, replaceLinkedAccounts, updateProfile } from '@/api/profile';
import type { components } from '@/api/schema';
import { failureSnackbar } from '@/auth/messages';
import {
  FormatPicker,
  FormScreen,
  InterestPicker,
  interestChips,
  isValidUsername,
  MIN_INTERESTS,
  ProfilePhoto,
  toggleInList,
} from '@/components/profile/profile-form';
import {
  filledNetworks,
  networkErrors,
  NetworkFields,
  sameNetworks,
  toEntries,
} from '@/components/profile/network-fields';
import { InterestsSheet } from '@/components/profile/profile-sheets';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { Spinner } from '@/components/ui/spinner';
import { TextField } from '@/components/ui/text-field';
import { useInterests } from '@/hooks/use-interests';
import { useProfile } from '@/hooks/use-profile';
import { colors } from '@/styles/tokens';

type Profile = components['schemas']['Profile'];
type UpdateProfileBody = components['schemas']['UpdateProfileBody'];

const INTEREST_CHIPS = 7;

export default function ProfileEditScreen() {
  const profile = useProfile();

  if (profile.data) return <ProfileForm profile={profile.data} />;
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center gap-2 bg-surface-card px-5">
        {profile.loading ? (
          <Spinner size="lg" color={colors.brand.coral} />
        ) : (
          <>
            <Text className="text-center font-inter text-body text-text-secondary">Не вдалося завантажити профіль</Text>
            <Pressable accessibilityRole="button" onPress={profile.reload} hitSlop={8}>
              <Text className="font-inter-semibold text-label text-brand-coral">Ще раз</Text>
            </Pressable>
          </>
        )}
      </View>
    </>
  );
}

// Mounted once the profile is loaded, so the fields start from it.
function ProfileForm({ profile }: Readonly<{ profile: Profile }>) {
  const router = useRouter();
  const [name, setName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [occupation, setOccupation] = useState(profile.occupation);
  const [about, setAbout] = useState(profile.description);
  const [format, setFormat] = useState(profile.communicationFormat);
  const savedInterestIds = profile.interests.map((interest) => interest.id);
  const [interestIds, setInterestIds] = useState(savedInterestIds);
  const savedNetworks = toEntries(profile.linkedAccounts);
  const [networks, setNetworks] = useState(savedNetworks);
  const [networkErrorsShown, setNetworkErrorsShown] = useState<ReturnType<typeof networkErrors>>({});
  const shared = filledNetworks(networks);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const interests = useInterests();
  const { snackbar, show, hide } = useSnackbar();

  const usernameValid = isValidUsername(username);
  let usernameError: string | undefined;
  if (usernameTaken) usernameError = 'Цей нікнейм уже зайнятий';
  else if (username && !usernameValid) usernameError = 'Від 3 до 30 латинських літер, цифр, крапок або _';
  const ready = !!name.trim() && usernameValid && !!format && interestIds.length >= MIN_INTERESTS && shared.length > 0;

  // Only what changed is sent; "Зберегти" with no changes just returns to Т4.
  const save = async () => {
    const changes: UpdateProfileBody = {};
    if (name.trim() !== profile.displayName) changes.displayName = name.trim();
    if (username.trim() !== profile.username) changes.username = username.trim();
    if (about.trim() !== profile.description) changes.description = about.trim();
    if (occupation.trim() !== profile.occupation) changes.occupation = occupation.trim();
    if (format && format !== profile.communicationFormat) changes.communicationFormat = format;
    const interestsChanged =
      interestIds.length !== savedInterestIds.length || interestIds.some((id) => !savedInterestIds.includes(id));

    hide();
    setSaving(true);
    let result = Object.keys(changes).length > 0 ? await updateProfile(changes) : undefined;
    if (interestsChanged && result?.ok !== false) result = await replaceInterests(interestIds);
    if (!sameNetworks(shared, savedNetworks) && result?.ok !== false) {
      result = await replaceLinkedAccounts(shared);
    }
    setSaving(false);
    if (result && !result.ok) {
      if (result.code === 'USERNAME_TAKEN') setUsernameTaken(true);
      else if (result.fields?.some((field) => field.startsWith('linkedAccounts.'))) {
        setNetworkErrorsShown(networkErrors(shared, result.fields));
      } else show(failureSnackbar(result));
      return;
    }
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FormScreen
        title="Редагувати профіль"
        action={{ label: 'Зберегти', onPress: () => void save(), disabled: !ready, loading: saving }}
      >
        <ProfilePhoto />

        <View className="gap-3 px-5 pt-4">
          <TextField label="Ім'я" required value={name} onChangeText={setName} />
          {/* Not in Figma: the API needs a username. */}
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
            placeholder="Наприклад, студентка КМА"
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
            options={interestChips(interests.data ?? profile.interests, interestIds, INTEREST_CHIPS)}
            selected={interestIds}
            onToggle={(id) => setInterestIds((current) => toggleInList(current, id))}
            note={`обрано ${interestIds.length}`}
            onMore={interests.data ? () => setSheetOpen(true) : undefined}
          />

          <View className="gap-3 pt-3">
            <Text className="font-inter-semibold text-title text-text-primary">Контакти для метчів</Text>
            <NetworkFields
              value={networks}
              onChange={(value) => {
                setNetworks(value);
                setNetworkErrorsShown({});
              }}
              errors={networkErrorsShown}
            />
          </View>
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
