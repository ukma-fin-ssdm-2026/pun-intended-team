// Written with the help of Claude
// AI Usage: organization settings from the Figma "О4 Організація · Налаштування" frame, on mock data; reviewed by Daryna
// Halytska.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockOrganizationSettings } from '@/mocks/organization';
import { colors } from '@/styles/tokens';

// "01 Навігація" starts 56 px from the top (9 px below the iPhone 14 status bar); "03 Вихід" has a 40 px bottom padding.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const CONTENT_BOTTOM = 40;

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
  const [name, setName] = useState(mockOrganizationSettings.name);
  const [about, setAbout] = useState(mockOrganizationSettings.about);
  const [site, setSite] = useState(mockOrganizationSettings.site);
  const [instagram, setInstagram] = useState(mockOrganizationSettings.instagram);
  // Figma: event changes and reminders on, nearby posts off.
  const [changes, setChanges] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [nearbyPosts, setNearbyPosts] = useState(false);
  useStatusBarStyle('dark');

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface-card" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        className="flex-row items-center justify-between px-5 pb-4"
        style={{ paddingTop: Math.max(NAV_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={() => router.back()}
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
          <TextField label="Назва" value={name} onChangeText={setName} />
          <TextField label="Опис" value={about} onChangeText={setAbout} />
          <TextField label="Сайт" value={site} onChangeText={setSite} autoCapitalize="none" keyboardType="url" />
          <TextField label="Instagram" value={instagram} onChangeText={setInstagram} autoCapitalize="none" />
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

        {/* "Вийти з акаунта" has no prototype link on О4. */}
        <View className="items-center px-5 pt-4">
          <Text className="text-center font-inter-medium text-label text-brand-coral">Вийти з акаунта</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
