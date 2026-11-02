// Written with the help of Claude
import { Link, Slot, usePathname, useRouter, type Href } from 'expo-router';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { useSession } from '@/state/session';
import { colors } from '@/styles/tokens';

const sections: { href: Href; path: string; label: string; icon: IconName }[] = [
  { href: '/admin', path: '/admin', label: 'Огляд', icon: 'home' },
  { href: '/admin/reports', path: '/admin/reports', label: 'Скарги', icon: 'shield' },
  { href: '/admin/categories', path: '/admin/categories', label: 'Категорії', icon: 'list' },
];

function Notice({ title, text, action }: { title: string; text: string; action?: { label: string; href: Href } }) {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center bg-surface-background px-8">
      <View className="max-w-[420px] items-center gap-3">
        <Icon name="shield" size={34} color={colors.brand.coral} />
        <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-primary">
          {title}
        </Text>
        <Text className="text-center font-inter text-body text-text-secondary">{text}</Text>
        {action && (
          <View className="pt-3">
            <Button label={action.label} variant="dark" onPress={() => router.replace(action.href)} />
          </View>
        )}
      </View>
    </View>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <View className="w-60 justify-between bg-brand-ink px-4 py-8">
      <View className="gap-8">
        <View className="gap-0.5 px-3">
          <Text className="font-alice text-logo text-text-on-dark">Nearby</Text>
          <Text className="font-inter text-caption text-text-on-dark-muted">Адмін-панель</Text>
        </View>
        <View className="gap-1">
          {sections.map((section) => {
            const active = section.path === '/admin' ? pathname === '/admin' : pathname.startsWith(section.path);
            return (
              <Link key={section.path} href={section.href} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  className={`flex-row items-center gap-3 rounded-2xl px-3 py-2.5 ${active ? 'bg-white/[0.12]' : ''}`}
                >
                  <Icon
                    name={section.icon}
                    size={20}
                    color={active ? colors.brand.coral : colors.text['on-dark-muted']}
                  />
                  <Text
                    className={`font-inter-medium text-body ${active ? 'text-text-on-dark' : 'text-text-on-dark-muted'}`}
                  >
                    {section.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>
      <Link href="/" asChild>
        <Pressable accessibilityRole="link" className="flex-row items-center gap-3 px-3 py-2.5">
          <Icon name="arrow-left" size={20} color={colors.text['on-dark-muted']} />
          <Text className="font-inter-medium text-body text-text-on-dark-muted">До застосунку</Text>
        </Pressable>
      </Link>
    </View>
  );
}

// Web only, for a computer screen. The API answers 404 to accounts that are not administrators, so the role check here
// only decides what to show; until the token is renewed after launch the role is not known yet, and the pages load.
export default function AdminLayout() {
  const { signedIn, role } = useSession();

  if (Platform.OS !== 'web') {
    return <Notice title="Відкрий на компʼютері" text="Адмін-панель Nearby працює в браузері на компʼютері." />;
  }
  if (!signedIn) {
    return (
      <Notice
        title="Потрібно увійти"
        text="Увійди акаунтом адміністратора, потім повернись на цю сторінку."
        action={{ label: 'Увійти', href: '/onboarding' }}
      />
    );
  }
  if (role && role !== 'admin') {
    return (
      <Notice
        title="Немає доступу"
        text="Ця сторінка для адміністраторів Nearby."
        action={{ label: 'До застосунку', href: '/' }}
      />
    );
  }

  return (
    <View className="flex-1 flex-row bg-surface-background">
      <Sidebar />
      <ScrollView className="flex-1" contentContainerClassName="px-10 py-10">
        <View className="w-full max-w-[1100px] gap-8">
          <Slot />
        </View>
      </ScrollView>
    </View>
  );
}
