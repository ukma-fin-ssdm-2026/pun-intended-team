// Written with the help of Claude
// AI Usage: profile editor from the Figma "П1 Редагувати профіль" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { replaceInterests, replaceLinkedAccounts, updateProfile } from '@/api/profile';
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
import {
  filledNetworks,
  networkErrors,
  NetworkFields,
  sameNetworks,
  toEntries,
  type NetworkEntry,
} from '@/components/profile/network-fields';
import { InterestsSheet } from '@/components/profile/profile-sheets';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { Spinner } from '@/components/ui/spinner';
import { TextField } from '@/components/ui/text-field';
import { useInterests } from '@/hooks/use-interests';
import { useProfile } from '@/hooks/use-profile';
import { restoredDraftSnackbar, useProfileDraft, useStoredProfileDraft } from '@/state/profile-drafts';
import { colors } from '@/styles/tokens';
import { useRandomText } from '@/random-texts';

type Profile = components['schemas']['Profile'];
type UpdateProfileBody = components['schemas']['UpdateProfileBody'];
type CommunicationFormat = components['schemas']['CommunicationFormat'];

type EditDraft = {
  name: string;
  username: string;
  occupation: string;
  about: string;
  format: CommunicationFormat | null;
  gender: GenderAnswer;
  interestIds: string[];
  networks: NetworkEntry[];
};

function savedValues(profile: Profile): EditDraft {
  return {
    name: profile.displayName,
    username: profile.username,
    occupation: profile.occupation,
    about: profile.description,
    format: profile.communicationFormat,
    // A profile made before genders were asked has none: the field starts empty and must be filled to save.
    gender: { gender: profile.gender, description: profile.genderDescription ?? '' },
    interestIds: profile.interests.map((interest) => interest.id),
    networks: toEntries(profile.linkedAccounts),
  };
}

// Picking interests in another order is no change.
function sameValues(a: EditDraft, b: EditDraft): boolean {
  const comparable = ({ interestIds, networks, ...rest }: EditDraft) =>
    JSON.stringify({
      ...rest,
      interestIds: [...interestIds].sort((x, y) => x.localeCompare(y)),
      networks: filledNetworks(networks),
    });
  return comparable(a) === comparable(b);
}

export default function ProfileEditScreen() {
  const profile = useProfile();
  const stored = useStoredProfileDraft<EditDraft>('edit');

  if (profile.data && stored.loaded) {
    return <ProfileForm key={stored.version} profile={profile.data} draft={stored.draft} onReset={stored.drop} />;
  }
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center gap-2 bg-surface-card px-5">
        {profile.loading || profile.data ? (
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

// Mounted once the profile and the draft are loaded, so the fields start from the draft, or else from the profile.
function ProfileForm({
  profile,
  draft,
  onReset,
}: Readonly<{ profile: Profile; draft?: Partial<EditDraft>; onReset: () => void }>) {
  const router = useRouter();
  const saved = savedValues(profile);
  const [initial] = useState(() => ({ ...saved, ...draft }));
  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username);
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [occupation, setOccupation] = useState(initial.occupation);
  const occupationPlaceholder = useRandomText('occupation');
  const [about, setAbout] = useState(initial.about);
  const [format, setFormat] = useState(initial.format);
  const [gender, setGender] = useState<GenderAnswer>(initial.gender);
  const savedInterestIds = saved.interestIds;
  const [interestIds, setInterestIds] = useState(initial.interestIds);
  const savedNetworks = saved.networks;
  const [networks, setNetworks] = useState(initial.networks);
  const [networkErrorsShown, setNetworkErrorsShown] = useState<ReturnType<typeof networkErrors>>({});
  const shared = filledNetworks(networks);
  const [pictures, setPictures] = useState(() => picturesOf(profile));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const interests = useInterests();
  const interestChipOptions = useInterestChips(interests.data ?? profile.interests, interestIds);
  const { snackbar, show, hide } = useSnackbar();
  const values: EditDraft = { name, username, occupation, about, format, gender, interestIds, networks };
  const discardDraft = useProfileDraft('edit', values, sameValues(values, saved));

  useEffect(() => {
    if (draft) show(restoredDraftSnackbar(onReset));
  }, [draft, onReset, show]);

  const usernameValid = isValidUsername(username);
  let usernameError: string | undefined;
  if (usernameTaken) usernameError = 'Цей нікнейм уже зайнятий';
  else if (username && !usernameValid) usernameError = 'Від 3 до 30 латинських літер, цифр, крапок або _';
  const ready =
    !!name.trim() &&
    isGenderComplete(gender) &&
    usernameValid &&
    !!format &&
    interestIds.length >= MIN_INTERESTS &&
    shared.length > 0;

  // Only what changed is sent; "Зберегти" with no changes just returns to Т4.
  const save = async () => {
    const changes: UpdateProfileBody = {};
    if (name.trim() !== profile.displayName) changes.displayName = name.trim();
    if (username.trim() !== profile.username) changes.username = username.trim();
    if (about.trim() !== profile.description) changes.description = about.trim();
    if (occupation.trim() !== profile.occupation) changes.occupation = occupation.trim();
    if (format && format !== profile.communicationFormat) changes.communicationFormat = format;
    const genderChanged =
      gender.gender !== profile.gender ||
      (gender.gender === 'other' && gender.description.trim() !== profile.genderDescription);
    if (genderChanged) Object.assign(changes, genderFields(gender));
    const interestsChanged =
      interestIds.length !== savedInterestIds.length || interestIds.some((id) => !savedInterestIds.includes(id));

    hide();
    setSaving(true);
    let result = Object.keys(changes).length > 0 ? await updateProfile(changes) : undefined;
    if (interestsChanged && result?.ok !== false) result = await replaceInterests(interestIds);
    if (!sameNetworks(shared, savedNetworks) && result?.ok !== false) {
      result = await replaceLinkedAccounts(shared);
    }
    const sent = result?.ok !== false ? await savePictures(pictures) : undefined;
    setSaving(false);
    if (sent && !sent.ok) {
      show(pictureFailureSnackbar(sent));
      return;
    }
    if (result && !result.ok) {
      if (result.code === 'USERNAME_TAKEN') setUsernameTaken(true);
      else if (result.fields?.some((field) => field.startsWith('linkedAccounts.'))) {
        setNetworkErrorsShown(networkErrors(shared, result.fields));
      } else show(failureSnackbar(result));
      return;
    }
    discardDraft();
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FormScreen
        title="Редагувати профіль"
        backTo="/profile"
        action={{ label: 'Зберегти', onPress: () => void save(), disabled: !ready, loading: saving }}
      >
        <ProfilePhoto
          pictures={pictures}
          onChange={setPictures}
          onRefused={(refusal) => show(pictureRefusalSnackbar(refusal))}
        />

        <View className="gap-3 px-5 pt-4">
          <TextField label="Ім'я" required value={name} onChangeText={setName} maxLength={50} />
          <GenderField value={gender} onChange={setGender} />
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
