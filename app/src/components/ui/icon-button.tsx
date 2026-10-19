// Written with the help of Claude
// AI Usage: round icon buttons from the Figma button section; reviewed by Daryna Halytska.
import { Pressable } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

// coral = "Кнопка / Фільтри" (50 px, opens the filters); glass = "Кнопка / Усі категорії" (36 px, on a dark background).
type Variant = 'coral' | 'glass';

type Props = {
  icon: IconName;
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: Variant;
};

const variantClasses: Record<Variant, string> = {
  coral: 'size-[50px] rounded-2xl bg-brand-coral',
  glass: 'size-9 rounded-[18px] border border-white/[0.22] bg-white/[0.12]',
};

const iconSizes: Record<Variant, number> = { coral: 24, glass: 18 };

export function IconButton({ icon, accessibilityLabel, onPress, variant = 'coral' }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className={`items-center justify-center active:opacity-80 ${variantClasses[variant]}`}
    >
      <Icon name={icon} size={iconSizes[variant]} color={colors.text['on-dark']} />
    </Pressable>
  );
}
