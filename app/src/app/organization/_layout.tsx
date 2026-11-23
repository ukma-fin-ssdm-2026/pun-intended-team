// Written with the help of Claude
// AI Usage: the organization area from the Figma "DО1–DО4" desktop frames, with the "Шапка (організатор)" header.
import { Link, Redirect, Stack, usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';

import { signOut } from '@/api/session';
import { ApiPicture } from '@/components/pictures/picture';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useAccountKind } from '@/hooks/use-account-kind';
import { useOwnOrganization } from '@/hooks/use-own-organization';
import { useProfile } from '@/hooks/use-profile';
import { useSession } from '@/state/session';
import { colors } from '@/styles/tokens';

function Notice({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: { label: string; onPress: () => void };
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface-background px-8">
      <Icon name="building" size={34} color={colors.brand.coral} />
      <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
        {title}
      </Text>
      <Text className="text-center font-inter text-body text-text-secondary">{text}</Text>
      <View className="pt-3">
        <Button label={action.label} variant="dark" onPress={action.onPress} />
      </View>
    </View>
  );
}

// An organization has nothing else in the app, so on a phone it can only sign out.
function PhoneNotice() {
  const router = useRouter();
  const kind = useAccountKind();
  const leave =
    kind === 'organization'
      ? {
          label: 'Вийти з акаунта',
          onPress: () => {
            void signOut();
            if (router.canDismiss()) router.dismissAll();
            router.replace('/onboarding');
          },
        }
      : { label: 'До застосунку', onPress: () => router.replace('/') };
  return (
    <Notice title="Відкрий на компʼютері" text="Кабінет організації працює в браузері на компʼютері." action={leave} />
  );
}

// "Шапка (організатор)" with the organization's name in place of Nearby's: the name opens its events, the avatar its
// settings.
function TopBar() {
  const organization = useOwnOrganization().data;
  // An administrator that also has an organization is a test account and switches between the panels.
  const admin = useAccountKind() === 'admin';
  // Not on the editor itself, where it would leave the event being edited.
  const pathname = usePathname();
  const canAdd = !!organization && pathname !== '/organization/event';
  return (
    <View className="h-[76px] flex-row items-center justify-between bg-brand-ink px-12">
      <Link href="/organization" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Мої події" className="shrink">
          <Text numberOfLines={1} className="font-logo text-logo text-text-on-dark">
            {organization?.name ?? 'Nearby'}
          </Text>
        </Pressable>
      </Link>
      <View className="flex-row items-center gap-6">
        {admin && (
          <Link href="/admin" asChild>
            <Pressable accessibilityRole="link" className="flex-row items-center gap-2">
              <Icon name="shield" size={20} color={colors.text['on-dark-muted']} />
              <Text className="font-inter-medium text-body text-text-on-dark-muted hover:text-text-on-dark">
                Адмін-панель
              </Text>
            </Pressable>
          </Link>
        )}
        {canAdd && (
          <Link href="/organization/event" asChild>
            <Pressable
              accessibilityRole="link"
              className="flex-row items-center gap-1.5 rounded-full bg-brand-coral py-2.5 pl-3 pr-4 hover:bg-brand-coral-dark"
            >
              <Text className="font-inter-semibold text-[18px] leading-6 text-text-on-dark">+</Text>
              <Text className="font-inter-semibold text-button-sm text-text-on-dark">Нова подія</Text>
            </Pressable>
          </Link>
        )}
        <Link href="/organization/settings" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Налаштування організації"
            className="size-11 items-center justify-center overflow-hidden rounded-full bg-brand-coral-soft"
          >
            {organization?.logo ? (
              <ApiPicture image={organization.logo} />
            ) : organization ? (
              <Text className="font-inter-semibold text-[17px] text-brand-coral">
                {organization.name.trim().charAt(0).toUpperCase()}
              </Text>
            ) : (
              <Icon name="building" size={20} color={colors.brand.coral} />
            )}
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

// Web only: organizations manage their events in a browser on a computer. An account without a request reaches it only
// from the sign-up's "Для організації", before it has a personal profile.
export default function OrganizationLayout() {
  const router = useRouter();
  const { signedIn } = useSession();
  const kind = useAccountKind();
  const profile = useProfile();

  if (Platform.OS !== 'web') return <PhoneNotice />;
  if (!signedIn) {
    return (
      <Notice
        title="Потрібно увійти"
        text="Увійди акаунтом організації, щоб керувати подіями."
        action={{ label: 'Увійти', onPress: () => router.replace('/onboarding') }}
      />
    );
  }
  if (!kind || (kind === 'person' && profile.loading)) return <View className="flex-1 bg-surface-background" />;
  if (kind === 'person' && !profile.missing) return <Redirect href="/" />;

  return (
    <View className="flex-1 bg-surface-background">
      <TopBar />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: colors.surface.background },
        }}
      />
    </View>
  );
}
