// Written with the help of Claude
// AI Usage: profile editor from the Figma "П1 Редагувати профіль" frame, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Glass } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockProfile } from '@/mocks/profile';
import { colors } from '@/styles/tokens';

// "01 Навігація": top padding 56 in the iPhone 14 frame (9 px below its status bar). "04 Дія": padding 16 / 20 / 34 / 20
// around the 52 px button; the form keeps 110 px under it.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const ACTION_TOP = 16;
const ACTION_BOTTOM = 34;
const BUTTON_HEIGHT = 52;
const FORM_BOTTOM_GAP = 110 - (ACTION_TOP + BUTTON_HEIGHT + ACTION_BOTTOM) + 34;

function VisibilityRow({
  icon,
  title,
  note,
  value,
  onValueChange,
}: {
  icon: IconName;
  title: string;
  note: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 overflow-hidden py-3">
      <View className="size-9 items-center justify-center overflow-hidden rounded-[11px] bg-surface-background">
        <Icon name={icon} size={18} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-medium text-body text-text-primary">{title}</Text>
        <Text className="font-inter text-caption text-text-secondary">{note}</Text>
      </View>
      <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(mockProfile.firstName);
  const [occupation, setOccupation] = useState('');
  const [about, setAbout] = useState('');
  const [interests, setInterests] = useState(mockProfile.interests);
  const [telegram, setTelegram] = useState(mockProfile.telegram);
  const [phone, setPhone] = useState(mockProfile.phone);
  // Figma: Telegram is shared with a mutual match, the phone number is not.
  const [showTelegram, setShowTelegram] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  useStatusBarStyle('dark');

  const allInterests = [...mockProfile.interests, ...mockProfile.moreInterests];
  const toggleInterest = (interest: string) =>
    setInterests((current) =>
      current.includes(interest) ? current.filter((value) => value !== interest) : [...current, interest],
    );
  const actionBottom = Math.max(ACTION_BOTTOM, insets.bottom);

  return (
    <View className="flex-1 bg-surface-card">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingBottom: ACTION_TOP + BUTTON_HEIGHT + actionBottom + FORM_BOTTOM_GAP - ACTION_BOTTOM,
        }}
      >
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
            Редагувати профіль
          </Text>
          <View className="size-10" />
        </View>

        <View className="px-5">
          {/* The avatar overlaps the bottom 48 px of the cover. */}
          <View className="h-[108px] items-end overflow-hidden rounded-[22px] pr-3 pt-3" style={{ marginBottom: -48 }}>
            <View className="absolute inset-0">
              <CoralGradient preset="profileCover" />
            </View>
            {/* "Змінити обкладинку" has no prototype link; shown as in Figma. */}
            <Glass
              className="flex-row items-center gap-1.5 py-[7px] pl-2.5 pr-3"
              radius={16}
              fill="rgba(255, 255, 255, 0.16)"
              border="rgba(255, 255, 255, 0.25)"
              tone="light"
            >
              <View className="flex-row items-center gap-1.5">
                <Icon name="gallery-edit" size={16} color={colors.text['on-dark']} />
                <Text className="font-inter-semibold text-tag text-text-on-dark">Обкладинка</Text>
              </View>
            </Glass>
          </View>
          <View className="pl-4">
            <View className="size-[92px] items-center justify-center rounded-full border-4 border-surface-card bg-surface-background">
              <Icon name="camera" size={28} color={colors.text.secondary} />
              <View className="absolute left-16 top-16 size-[30px] items-center justify-center rounded-[15px] border-[3px] border-surface-card bg-brand-coral">
                <Text className="font-inter-semibold text-[18px] leading-6 text-text-on-dark">+</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="gap-3 px-5 pt-4">
          <TextField label="Ім'я" required value={name} onChangeText={setName} />
          <TextField
            label="Чим займаєшся?"
            placeholder="Наприклад, студентка КМА"
            value={occupation}
            onChangeText={setOccupation}
          />
          <TextField
            label="Про себе"
            placeholder="Що любиш, куди ходиш, з ким цікаво"
            value={about}
            onChangeText={setAbout}
          />

          <View className="gap-2.5">
            <View className="flex-row items-start justify-between">
              <Text className="font-inter-semibold text-title text-text-primary">
                Інтереси <Text className="text-brand-coral">*</Text>
              </Text>
              <Text className="font-inter text-caption text-text-secondary">обрано {interests.length}</Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {allInterests.map((interest) => {
                const selected = interests.includes(interest);
                return (
                  <Pressable
                    key={interest}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleInterest(interest)}
                    className={`flex-row items-center gap-1.5 rounded-[18px] py-2 pr-3.5 ${
                      selected ? 'bg-brand-ink pl-2.5' : 'bg-surface-background pl-3.5'
                    }`}
                  >
                    {selected && <Icon name="chip-check" size={14} color={colors.text['on-dark']} />}
                    <Text
                      className={`font-inter-medium text-label ${selected ? 'text-text-on-dark' : 'text-text-primary'}`}
                    >
                      {interest}
                    </Text>
                  </Pressable>
                );
              })}
              {/* "+ ще" has no prototype link; shown as in Figma. */}
              <View className="rounded-[18px] bg-surface-background px-3.5 py-2">
                <Text className="font-inter-medium text-label text-text-primary">+ ще</Text>
              </View>
            </View>
          </View>

          <View className="gap-3 pt-3">
            <Text className="font-inter-semibold text-title text-text-primary">Контакти для метчів</Text>
            <TextField label="Нікнейм у Telegram" value={telegram} onChangeText={setTelegram} />
            <TextField label="Номер телефону" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            {/* "+ Додати соцмережу" has no prototype link; shown as in Figma. */}
            <Text className="font-inter-medium text-label text-brand-coral">+ Додати соцмережу</Text>
            <View className="overflow-hidden rounded-[20px] bg-surface-card px-4 py-1">
              <View className="pb-1 pt-3">
                <Text className="font-inter-medium text-label text-text-secondary">Що побачить взаємний метч</Text>
              </View>
              <VisibilityRow
                icon="contact-send"
                title="Telegram"
                note={telegram}
                value={showTelegram}
                onValueChange={setShowTelegram}
              />
              <View className="h-px bg-border-default" />
              <VisibilityRow
                icon="contact-phone"
                title="Номер телефону"
                note="Можна ввімкнути пізніше в профілі"
                value={showPhone}
                onValueChange={setShowPhone}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 bg-surface-card px-5"
        style={{ paddingTop: ACTION_TOP, paddingBottom: actionBottom }}
      >
        {/* "Зберегти" returns to the profile (Т4), as in the prototype. */}
        <Button label="Зберегти" variant="dark" onPress={() => router.back()} />
      </View>
    </View>
  );
}
