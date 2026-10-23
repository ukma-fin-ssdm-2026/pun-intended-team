// Written with the help of Claude
// AI Usage: shared layout of the Figma system state screens (С1–С3); reviewed by Daryna Halytska.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';

// "01 Безпека" starts 150 px from the top of the frame; "02 Дії" has a 34 px bottom padding.
const CONTENT_TOP = 150;
const ACTIONS_BOTTOM = 34;

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  // A line under the description, e.g. the С3 countdown.
  note?: string;
  action: { label: string; onPress: () => void };
  // The text link under the button; without onPress it is shown but does nothing, as in the prototype.
  link?: { label: string; onPress?: () => void };
};

export function SystemState({ icon, title, description, note, action, link }: Props) {
  const insets = useSafeAreaInsets();
  useStatusBarStyle('light');

  const linkText = link && <Text className="font-inter-medium text-label text-text-on-dark">{link.label}</Text>;

  return (
    <View className="flex-1">
      <CoralGradient preset="screen" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="items-center gap-7 px-5" style={{ paddingTop: CONTENT_TOP }}>
          <View className="size-[120px] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08]">
            <View
              className="size-[76px] items-center justify-center rounded-full bg-brand-coral"
              style={{ boxShadow: '0px 0px 30px rgba(223, 84, 74, 0.5)' }}
            >
              {icon}
            </View>
          </View>
          <Text accessibilityRole="header" className="text-center font-inter-bold text-display text-text-on-dark">
            {title}
          </Text>
          <View className="items-center gap-3">
            <Text className="text-center font-inter text-body text-text-on-dark-muted">{description}</Text>
            {note && <Text className="text-center font-inter-semibold text-title text-text-on-dark">{note}</Text>}
          </View>
        </View>

        <View className="flex-1" />

        <View
          className="items-center gap-[18px] px-5 pt-10"
          style={{ paddingBottom: Math.max(ACTIONS_BOTTOM, insets.bottom) }}
        >
          <View className="self-stretch">
            <Button label={action.label} onPress={action.onPress} />
          </View>
          {link &&
            (link.onPress ? (
              <Pressable accessibilityRole="link" onPress={link.onPress}>
                {linkText}
              </Pressable>
            ) : (
              linkText
            ))}
        </View>
      </ScrollView>
    </View>
  );
}
