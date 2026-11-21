// Written with the help of Claude
// AI Usage: organization settings from the Figma "DО4 Організація · Налаштування" desktop frame with the DО4.1 dialog,
// after the О4 screen reviewed by Daryna Halytska. The verification request (name, description, site) and its status
// come from the API; the status block has no Figma frame.
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { deleteOrganizationLogo, uploadOrganizationLogo, type ApiImage } from '@/api/images';
import { getMyOrganization, requestOrganizationStatus, type Organization } from '@/api/organizations';
import { failureMessage, pictureRefusalSnackbar } from '@/auth/messages';
import { ApiPicture } from '@/components/pictures/picture';
import { usePictureCropper } from '@/components/pictures/picture-cropper';
import { signOut } from '@/api/session';
import { SignOutDialog } from '@/components/sign-out-dialog';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { useApiQuery } from '@/hooks/use-api-query';
import { mockOrganizationSettings } from '@/mocks/organization';
import { colors } from '@/styles/tokens';

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

// "Картка": the 720 px column's white cards.
function Card({ children }: { children: ReactNode }) {
  return <View className="w-full max-w-[720px] gap-3 rounded-[28px] bg-surface-card px-8 py-6">{children}</View>;
}

export default function OrganizationSettingsScreen() {
  const router = useRouter();
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
  // The logo is saved as soon as it is picked, apart from the request, so unsent edits of the fields stay.
  const [savedLogo, setSavedLogo] = useState<ApiImage | null>();
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string>();
  const { start: pickLogo, cropper } = usePictureCropper(
    async (_kind, draft) => {
      setLogoBusy(true);
      setLogoError(undefined);
      const result = await uploadOrganizationLogo(draft);
      setLogoBusy(false);
      if (result.ok) setSavedLogo(result.data.logo);
      else setLogoError(`Не вдалося зберегти логотип. ${failureMessage(result)}`);
    },
    (refusal) => {
      const { title, note } = pictureRefusalSnackbar(refusal);
      setLogoError(`${title}. ${note}.`);
    },
  );

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
  const logo = savedLogo === undefined ? own.data?.logo : savedLogo;

  // The API keeps a logo only for an account that has sent its request.
  const changeLogo = () => {
    if (status === 'none') setLogoError('Спершу надішли заявку, потім додай логотип.');
    else if (status) void pickLogo('organizationLogo');
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    setLogoError(undefined);
    const result = await deleteOrganizationLogo();
    setLogoBusy(false);
    if (result.ok) setSavedLogo(null);
    else setLogoError(`Не вдалося прибрати логотип. ${failureMessage(result)}`);
  };

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
    <View className="flex-1">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="items-center gap-6 px-10 pb-20 pt-12">
        <View className="h-10 w-full max-w-[720px] justify-center">
          <Text accessibilityRole="header" className="font-inter-bold text-[32px] text-text-primary">
            Налаштування
          </Text>
        </View>

        <Card>
          <Text className="font-inter-semibold text-title text-text-primary">Профіль організації</Text>
          {/* "Змінити логотип" opens the system photo picker and the crop preview, which have no design. */}
          <View className="flex-row items-center gap-3.5">
            <View className="size-[72px]">
              <View className="size-[72px] items-center justify-center overflow-hidden rounded-[36px] bg-brand-coral-soft">
                {logo ? <ApiPicture image={logo} /> : <Icon name="building" size={32} color={colors.brand.coral} />}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Змінити логотип"
                disabled={logoBusy}
                onPress={changeLogo}
                className="absolute left-[46px] top-[46px] size-7 items-center justify-center rounded-[14px] border-2 border-surface-card bg-brand-coral"
              >
                <Icon name="camera" size={14} color={colors.text['on-dark']} />
              </Pressable>
            </View>
            <View className="flex-1 gap-0.5">
              <Pressable
                accessibilityRole="button"
                disabled={logoBusy}
                onPress={changeLogo}
                className="gap-0.5 self-start"
              >
                <Text className="font-inter-medium text-label text-brand-coral">
                  {logoBusy ? 'Зберігаємо…' : 'Змінити логотип'}
                </Text>
                <Text className="font-inter text-caption text-text-secondary">JPG або PNG, від 400×400 px</Text>
              </Pressable>
              {logo && !logoBusy && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void removeLogo()}
                  hitSlop={6}
                  className="self-start"
                >
                  <Text className="font-inter text-caption text-text-secondary underline">Прибрати логотип</Text>
                </Pressable>
              )}
            </View>
          </View>
          {logoError && (
            <Text accessibilityRole="alert" className="font-inter text-caption text-brand-coral">
              {logoError}
            </Text>
          )}
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

          <View className="mt-3 gap-3 rounded-[20px] bg-surface-background p-4">
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
              <View className="self-start">
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
              </View>
            ) : (
              !status &&
              own.failure && (
                <View className="self-start">
                  <Button label="Спробувати ще раз" variant="light" onPress={own.reload} />
                </View>
              )
            )}
          </View>
        </Card>

        <Card>
          <View className="px-4 py-1">
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
        </Card>

        {/* "Вийти з акаунта" opens DО4.1. */}
        <Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSignOutOpen(true)}
            hitSlop={8}
            className="self-center"
          >
            <Text className="font-inter-medium text-label text-brand-coral">Вийти з акаунта</Text>
          </Pressable>
        </Card>
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
      {cropper}
    </View>
  );
}
