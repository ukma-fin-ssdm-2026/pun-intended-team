// Written with the help of Claude
// AI Usage: organization settings from the Figma "О4 Організація · Налаштування" frame, on mock data; reviewed by Daryna
// Halytska. The verification request (name, description, site) and its status come from the API; the status block has no
// Figma frame.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMyOrganization, requestOrganizationStatus, type Organization } from '@/api/organizations';
import { signOut } from '@/api/session';
import { SignOutDialog } from '@/components/sign-out-dialog';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { useApiQuery } from '@/hooks/use-api-query';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockOrganizationSettings } from '@/mocks/organization';
import { colors } from '@/styles/tokens';

// "01 Навігація" starts 56 px from the top (9 px below the iPhone 14 status bar); "03 Вихід" has a 40 px bottom padding.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const CONTENT_BOTTOM = 40;

// FR-003: what the account sees of its request.
const statusText: Record<Organization['verificationStatus'] | 'none', { title: string; note: string }> = {
  none: { title: 'Не підтверджено', note: 'Надішли заявку, щоб публікувати події. Її перевірить адміністратор.' },
  pending: {
    title: 'На перевірці',
    note: 'Адміністратор перевіряє заявку. Події можна публікувати після підтвердження.',
  },
  verified: { title: 'Підтверджено', note: 'Організація може публікувати події.' },
  rejected: { title: 'Відхилено', note: 'Заявку відхилили. Виправ дані й надішли її ще раз.' },
  revoked: { title: 'Підтвердження відкликано', note: 'Організація більше не може публікувати події.' },
};

function SettingRow({
  icon,
  title,
  note,
  value,
  onValueChange,
}: {
  icon: IconName;
  title: string;
  note?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className="size-9 items-center justify-center rounded-[11px] bg-surface-background">
        <Icon name={icon} size={18} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-medium text-body text-text-primary">{title}</Text>
        {note && <Text className="font-inter text-caption text-text-secondary">{note}</Text>}
      </View>
      <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

export default function OrganizationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const own = useApiQuery('my-organization', getMyOrganization);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [site, setSite] = useState('');
  const [instagram, setInstagram] = useState(mockOrganizationSettings.instagram);
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  // Figma: event changes and reminders on, nearby posts off.
  const [changes, setChanges] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [nearbyPosts, setNearbyPosts] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  useStatusBarStyle('dark');

  // The fields take the request the account sent each time it arrives: on load and after sending.
  const [shown, setShown] = useState<Organization>();
  if (own.data && own.data !== shown) {
    setShown(own.data);
    setName(own.data.name);
    setAbout(own.data.description ?? '');
    setSite(own.data.officialLink ?? '');
  }

  // 404: no request yet.
  const status = own.data?.verificationStatus ?? (own.failure?.status === 404 ? 'none' : undefined);
  const canSend = status === 'none' || status === 'pending' || status === 'rejected';

  const sendRequest = async () => {
    const link = site.trim();
    if (!name.trim() || !about.trim() || !link) {
      setRequestError('Заповни назву, опис і сайт.');
      return;
    }
    setSending(true);
    setRequestError(undefined);
    // The site field in Figma has no scheme ("artarsenal.in.ua"); the API takes a full address.
    const officialLink = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    const result = await requestOrganizationStatus({ name: name.trim(), description: about.trim(), officialLink });
    setSending(false);
    if (result.ok) own.setData(result.data);
    else if (result.status === 0) setRequestError('Немає зʼєднання. Спробуй ще раз.');
    else if (result.status === 400) setRequestError('Перевір дані: сайт має бути адресою, наприклад artarsenal.in.ua.');
    else if (result.status === 409) {
      setRequestError('Організацію вже підтверджено, змінити заявку не можна.');
      own.reload();
    } else setRequestError('Не вдалося надіслати заявку. Спробуй ще раз.');
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface-card" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        className="flex-row items-center justify-between px-5 pb-4"
        style={{ paddingTop: Math.max(NAV_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/organization'))}
          className="size-10 items-center justify-center rounded-[20px] bg-surface-background"
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
        <Text accessibilityRole="header" className="font-inter-semibold text-title text-text-primary">
          Налаштування
        </Text>
        <View className="size-10" />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: Math.max(CONTENT_BOTTOM, insets.bottom) }}
      >
        <View className="gap-3 px-5 pb-2 pt-1">
          <Text className="font-inter-semibold text-title text-text-primary">Профіль організації</Text>
          {/* "Змінити логотип" opens the system photo picker, which has no design. */}
          <View className="flex-row items-center gap-3.5">
            <View className="size-[72px]">
              <View className="size-[72px] items-center justify-center rounded-[36px] bg-brand-coral-soft">
                <Icon name="building" size={32} color={colors.brand.coral} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Змінити логотип"
                className="absolute left-[46px] top-[46px] size-7 items-center justify-center rounded-[14px] border-2 border-surface-card bg-brand-coral"
              >
                <Icon name="camera" size={14} color={colors.text['on-dark']} />
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" className="flex-1 gap-0.5">
              <Text className="font-inter-medium text-label text-brand-coral">Змінити логотип</Text>
              <Text className="font-inter text-caption text-text-secondary">JPG або PNG, від 400×400 px</Text>
            </Pressable>
          </View>
          <TextField label="Назва" value={name} onChangeText={setName} editable={canSend} />
          <TextField label="Опис" value={about} onChangeText={setAbout} editable={canSend} />
          <TextField
            label="Сайт"
            value={site}
            onChangeText={setSite}
            autoCapitalize="none"
            keyboardType="url"
            editable={canSend}
          />
          <TextField label="Instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" />
        </View>

        <View className="px-5 pt-4">
          <View className="gap-3 rounded-[20px] bg-surface-background p-4">
            <View className="gap-0.5">
              <Text className="font-inter-medium text-label text-text-secondary">Підтвердження організації</Text>
              {status ? (
                <>
                  <Text className="font-inter-semibold text-body text-text-primary">{statusText[status].title}</Text>
                  <Text className="font-inter text-caption text-text-secondary">{statusText[status].note}</Text>
                </>
              ) : (
                <Text className="font-inter text-caption text-text-secondary">
                  {own.failure ? 'Не вдалося завантажити статус.' : 'Завантаження…'}
                </Text>
              )}
            </View>
            {requestError && <Text className="font-inter text-caption text-brand-coral">{requestError}</Text>}
            {canSend ? (
              <Button
                label={
                  status === 'none'
                    ? 'Надіслати на перевірку'
                    : status === 'pending'
                      ? 'Оновити заявку'
                      : 'Надіслати ще раз'
                }
                variant="dark"
                loading={sending}
                onPress={() => void sendRequest()}
              />
            ) : (
              !status && own.failure && <Button label="Спробувати ще раз" variant="light" onPress={own.reload} />
            )}
          </View>
        </View>

        <View className="px-5 pt-4">
          <View className="overflow-hidden rounded-[20px] bg-surface-card px-4 py-1">
            <View className="pb-0.5 pt-3">
              <Text className="font-inter-medium text-label text-text-secondary">Події</Text>
            </View>
            <SettingRow
              icon="calendar"
              title="Зміни в подіях"
              note="Перенесення, скасування, нове місце"
              value={changes}
              onValueChange={setChanges}
            />
            <View className="h-px bg-border-default" />
            <SettingRow
              icon="clock"
              title="Нагадування"
              note="За день і за 2 години до події"
              value={reminders}
              onValueChange={setReminders}
            />
            <View className="h-px bg-border-default" />
            <SettingRow icon="send" title="Нові оголошення поруч" value={nearbyPosts} onValueChange={setNearbyPosts} />
          </View>
        </View>

        {/* "Вийти з акаунта" opens О4.1, as on Т4. */}
        <View className="items-center px-5 pt-4">
          <Pressable accessibilityRole="button" onPress={() => setSignOutOpen(true)} hitSlop={8}>
            <Text className="font-inter-medium text-label text-brand-coral">Вийти з акаунта</Text>
          </Pressable>
        </View>
      </ScrollView>

      <SignOutDialog
        visible={signOutOpen}
        icon="building"
        note="Події та налаштування організації збережуться. Повернутися можна будь-коли."
        onClose={() => setSignOutOpen(false)}
        onSignOut={() => {
          setSignOutOpen(false);
          void signOut();
          // As on П5: signing out starts a new history on the onboarding (В1).
          if (router.canDismiss()) router.dismissAll();
          router.replace('/onboarding');
        }}
      />
    </KeyboardAvoidingView>
  );
}
