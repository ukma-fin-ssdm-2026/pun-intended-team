// Written with the help of Claude
// AI Usage: organization settings from the Figma "DО4 Організація · Налаштування" desktop frame with the DО4.1 dialog,
// after the О4 screen reviewed by Daryna Halytska. The verification request (name, description, site) and its status
// come from the API; Instagram is saved apart, in any status; the status block has no Figma frame. Figma's notification switches are left out
// until the API stores them.
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { deleteOrganizationLogo, uploadOrganizationLogo } from '@/api/images';
import { requestOrganizationStatus, setOrganizationInstagram, type Organization } from '@/api/organizations';
import { failureMessage, failureSnackbar, pictureRefusalSnackbar } from '@/auth/messages';
import { ApiPicture, Picture } from '@/components/pictures/picture';
import { usePictureCropper } from '@/components/pictures/picture-cropper';
import { signOut } from '@/api/session';
import { SignOutDialog } from '@/components/sign-out-dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { TextField } from '@/components/ui/text-field';
import { useOwnOrganization } from '@/hooks/use-own-organization';
import type { PictureDraft } from '@/pictures/picked-picture';
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

// "Картка": the 720 px column's white cards.
function Card({ children }: { children: ReactNode }) {
  return <View className="w-full max-w-[720px] gap-3 rounded-[28px] bg-surface-card px-8 py-6">{children}</View>;
}

export default function OrganizationSettingsScreen() {
  const router = useRouter();
  const own = useOwnOrganization();
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [site, setSite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [instagramBusy, setInstagramBusy] = useState(false);
  const { snackbar, show } = useSnackbar();
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [shown, setShown] = useState<Organization>();
  // The logo is saved as soon as it is picked, apart from the request, so unsent edits of the fields stay.
  const keepLogo = (organization: Organization) => {
    setShown(organization);
    own.set(organization);
  };
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string>();
  // The API keeps a logo only for an account that has sent its request: one picked before waits here and is saved
  // right after the request.
  const [logoDraft, setLogoDraft] = useState<PictureDraft>();
  const saveLogo = async (draft: PictureDraft) => {
    setLogoBusy(true);
    setLogoError(undefined);
    const result = await uploadOrganizationLogo(draft);
    setLogoBusy(false);
    if (result.ok) keepLogo(result.data);
    else setLogoError(`Не вдалося зберегти логотип. ${failureMessage(result)}`);
    return result.ok;
  };
  const { start: pickLogo, cropper } = usePictureCropper(
    async (_kind, draft) => {
      setLogoError(undefined);
      if (own.data) await saveLogo(draft);
      else setLogoDraft(draft);
    },
    (refusal) => {
      const { title, note } = pictureRefusalSnackbar(refusal);
      setLogoError(`${title}. ${note}.`);
    },
  );

  // The fields take the request the account sent each time it arrives: on load and after sending.
  if (own.data && own.data !== shown) {
    setShown(own.data);
    setName(own.data.name);
    setAbout(own.data.description ?? '');
    setSite(own.data.officialLink ?? '');
    setInstagram(own.data.instagram ? `@${own.data.instagram}` : '');
  }

  const savedInstagram = own.data?.instagram ? `@${own.data.instagram}` : '';
  const instagramChanged = instagram.trim() !== savedInstagram;
  const saveInstagram = async () => {
    setInstagramBusy(true);
    const result = await setOrganizationInstagram(instagram.trim() || null);
    setInstagramBusy(false);
    if (result.ok) {
      own.set(result.data);
      show({
        title: result.data.instagram ? 'Instagram збережено' : 'Instagram прибрано',
        note: 'Його видно на сторінці організації',
      });
    } else if (result.code === 'INVALID_SOCIAL_HANDLE') {
      show({ tone: 'error', title: 'Перевір Instagram', note: 'Наприклад, @artarsenal' });
    } else {
      show(failureSnackbar(result));
    }
  };

  const status = own.data?.verificationStatus ?? (own.none ? 'none' : undefined);
  const canSend = status === 'none' || status === 'pending' || status === 'rejected';
  const logo = own.data?.logo;

  const changeLogo = () => {
    if (status) void pickLogo('organizationLogo');
  };

  const removeLogo = async () => {
    if (logoDraft) {
      setLogoDraft(undefined);
      return;
    }
    setLogoBusy(true);
    setLogoError(undefined);
    const result = await deleteOrganizationLogo();
    setLogoBusy(false);
    if (result.ok) keepLogo(result.data);
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
    if (result.ok) {
      own.set(result.data);
      if (logoDraft && (await saveLogo(logoDraft))) setLogoDraft(undefined);
      // Typed before the first request, when the API had no organization to keep it on.
      if (instagram.trim() !== (result.data.instagram ? `@${result.data.instagram}` : '')) await saveInstagram();
    } else if (result.status === 0) setRequestError('Немає зʼєднання. Спробуй ще раз.');
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
                {logoDraft ? (
                  <Picture source={{ uri: logoDraft.picture.uri }} size={logoDraft.picture} crop={logoDraft.crop} />
                ) : logo ? (
                  <ApiPicture image={logo} />
                ) : (
                  <Icon name="building" size={32} color={colors.brand.coral} />
                )}
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
              {(logoDraft || logo) && !logoBusy && (
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
          <TextField
            label="Instagram"
            value={instagram}
            onChangeText={setInstagram}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {/* Saved on its own, also for a verified organization; before the first request it goes with the request. */}
          {own.data && instagramChanged && (
            <View className="self-start">
              <Button
                label="Зберегти Instagram"
                variant="light"
                loading={instagramBusy}
                onPress={() => void saveInstagram()}
              />
            </View>
          )}

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
                  {own.error ? 'Не вдалося завантажити статус.' : 'Завантаження…'}
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
              own.error && (
                <View className="self-start">
                  <Button label="Спробувати ще раз" variant="light" onPress={own.reload} />
                </View>
              )
            )}
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
      {snackbar && <Snackbar {...snackbar} />}
    </View>
  );
}
