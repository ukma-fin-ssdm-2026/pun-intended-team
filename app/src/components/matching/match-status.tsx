// Written with the help of Claude
// AI Usage: answer message from the Figma "05.2 Метч прийнято" and "05.3 Не цього разу" frames; reviewed by Daryna
// Halytska.
import { Text, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

// `name` is the other user's display name, in the nominative, so the copy needs no other forms of it.
const copy = {
  accepted: {
    icon: 'status-check',
    title: 'Згоду надіслано!',
    text: (name: string) => `Щойно ${name} теж погодиться, ви зможете разом піти на подію.`,
  },
  declined: {
    icon: 'status-close',
    title: 'Не цього разу',
    text: (name: string) => `${name} про це не дізнається. А ми шукаємо тобі компанію далі.`,
  },
} as const;

export function MatchStatus({ answer, name }: { answer: keyof typeof copy; name: string }) {
  const { icon, title, text } = copy[answer];
  return (
    <View className="items-center gap-3.5 px-2.5">
      <View className="size-[120px] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08]">
        <View
          className="size-[76px] items-center justify-center rounded-full bg-brand-coral"
          style={{ boxShadow: '0px 0px 30px rgba(223, 84, 74, 0.5)' }}
        >
          <Icon name={icon} size={34} color={colors.text['on-dark']} />
        </View>
      </View>
      <Text accessibilityRole="header" className="text-center font-inter-bold text-h1 text-text-on-dark">
        {title}
      </Text>
      <Text className="text-center font-inter text-body text-text-on-dark-muted">{text(name)}</Text>
    </View>
  );
}
