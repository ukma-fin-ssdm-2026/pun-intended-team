// Written with the help of Claude
// AI Usage: the organization area from the Figma "DО1–DО4" desktop frames, with the "Шапка (організатор)" header.
import { Link, Stack, useRouter } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';

import { getMyOrganization } from '@/api/organizations';
import { ApiPicture } from '@/components/pictures/picture';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useApiQuery } from '@/hooks/use-api-query';
import { colors } from '@/styles/tokens';

function PhoneNotice() {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-surface-background px-8">
      <Icon name="building" size={34} color={colors.brand.coral} />
      <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
        Відкрий на компʼютері
      </Text>
      <Text className="text-center font-inter text-body text-text-secondary">
        Кабінет організації працює в браузері на компʼютері.
      </Text>
      <View className="pt-3">
        <Button label="До застосунку" variant="dark" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

// "Шапка (організатор)": the logo opens the catalog, the avatar the organization's settings.
function TopBar() {
  const organization = useApiQuery('my-organization', getMyOrganization).data;
  return (
    <View className="h-[76px] flex-row items-center justify-between bg-brand-ink px-12">
      <Link href="/" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Nearby, каталог подій">
          <Text className="font-logo text-logo text-text-on-dark">Nearby</Text>
        </Pressable>
      </Link>
      <Link href="/organization/settings" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Налаштування організації"
          className="size-11 items-center justify-center overflow-hidden rounded-full bg-brand-coral-soft"
        >
          {organization?.logo ? (
            <ApiPicture image={organization.logo} />
          ) : (
            <Text className="font-inter-semibold text-[17px] text-brand-coral">
              {organization?.name.trim().charAt(0).toUpperCase()}
            </Text>
          )}
        </Pressable>
      </Link>
    </View>
  );
}

// Web only: organizations manage their events in a browser on a computer.
export default function OrganizationLayout() {
  if (Platform.OS !== 'web') return <PhoneNotice />;
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
