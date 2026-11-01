// Written with the help of Claude
// AI Usage: second sign-up profile step from the Figma "В8 Заповнення профілю · Крок 2" frame, on mock data; reviewed
// by Daryna Halytska.
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { replaceLinkedAccounts } from '@/api/profile';
import { failureSnackbar } from '@/auth/messages';
import { filledNetworks, networkErrors, NetworkFields, toEntries } from '@/components/profile/network-fields';
import { FormScreen } from '@/components/profile/profile-form';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { useProfile } from '@/hooks/use-profile';
import { useSignIn } from '@/hooks/use-sign-in';

export default function ProfileContactsScreen() {
  const signIn = useSignIn();
  const profile = useProfile();
  // Back from the catalog or a second visit starts from what is saved.
  const [networks, setNetworks] = useState(toEntries(profile.data?.linkedAccounts ?? []));
  const [errors, setErrors] = useState<ReturnType<typeof networkErrors>>({});
  const [saving, setSaving] = useState(false);
  const { snackbar, show, hide } = useSnackbar();
  const shared = filledNetworks(networks);

  const finish = async () => {
    hide();
    setSaving(true);
    const result = await replaceLinkedAccounts(shared);
    setSaving(false);
    if (result.ok) signIn();
    else if (result.status === 400) setErrors(networkErrors(shared, result.fields ?? []));
    else show(failureSnackbar(result));
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {/* "Готово" opens the catalog with a new history, as signing in does. */}
      <FormScreen
        step={{ current: 2, total: 2 }}
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
