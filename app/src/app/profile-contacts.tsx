// Written with the help of Claude
// AI Usage: second sign-up profile step from the Figma "В8 Заповнення профілю · Крок 2" frame, on mock data; reviewed
// by Daryna Halytska.
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { replaceLinkedAccounts } from '@/api/profile';
import { failureSnackbar } from '@/auth/messages';
import {
  filledNetworks,
  networkErrors,
  NetworkFields,
  sameNetworks,
  toEntries,
  type NetworkEntry,
} from '@/components/profile/network-fields';
import { FormScreen } from '@/components/profile/profile-form';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { useProfile } from '@/hooks/use-profile';
import { useSignIn } from '@/hooks/use-sign-in';
import { restoredDraftSnackbar, useProfileDraft, useStoredProfileDraft } from '@/state/profile-drafts';

type ContactsDraft = { networks: NetworkEntry[] };

export default function ProfileContactsScreen() {
  const profile = useProfile();
  const stored = useStoredProfileDraft<ContactsDraft>('contacts');
  if (!stored.loaded) return <Stack.Screen options={{ headerShown: false }} />;
  // Back from the catalog or a second visit starts from what is saved.
  const saved = toEntries(profile.data?.linkedAccounts ?? []);
  return <ContactsForm key={stored.version} saved={saved} draft={stored.draft} onReset={stored.drop} />;
}

function ContactsForm({
  saved,
  draft,
  onReset,
}: Readonly<{ saved: NetworkEntry[]; draft?: Partial<ContactsDraft>; onReset: () => void }>) {
  const signIn = useSignIn();
  const [networks, setNetworks] = useState(draft?.networks ?? saved);
  const [errors, setErrors] = useState<ReturnType<typeof networkErrors>>({});
  const [saving, setSaving] = useState(false);
  const { snackbar, show, hide } = useSnackbar();
  const shared = filledNetworks(networks);
  const discardDraft = useProfileDraft('contacts', { networks }, sameNetworks(shared, filledNetworks(saved)));

  useEffect(() => {
    if (draft) show(restoredDraftSnackbar(onReset));
  }, [draft, onReset, show]);

  const finish = async () => {
    hide();
    setSaving(true);
    const result = await replaceLinkedAccounts(shared);
    setSaving(false);
    if (result.ok) {
      discardDraft();
      signIn();
    } else if (result.fields?.length) setErrors(networkErrors(shared, result.fields));
    else show(failureSnackbar(result));
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* "Готово" opens the catalog with a new history, as signing in does. */}
      <FormScreen
        step={{ current: 2, total: 2 }}
        backTo="/profile-setup"
        action={{ label: 'Готово', onPress: () => void finish(), disabled: shared.length === 0, loading: saving }}
      >
        <View className="gap-3 px-5 pt-2">
          <View className="gap-1.5 overflow-hidden pb-2">
            <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
              Як з тобою зв’язатися?
            </Text>
            <Text className="font-inter text-body text-text-secondary">
              Ці контакти побачить лише взаємний метч. До взаємної згоди вони приховані.
            </Text>
          </View>
          <NetworkFields
            value={networks}
            onChange={(value) => {
              setNetworks(value);
              setErrors({});
            }}
            errors={errors}
          />
        </View>
      </FormScreen>
      {snackbar && <Snackbar {...snackbar} />}
    </>
  );
}
