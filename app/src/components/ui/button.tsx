// Written with the help of Claude
// AI Usage: Button with the Figma variants, sizes and states; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spinner } from '@/components/ui/spinner';
import { colors, shadows } from '@/styles/tokens';

// Figma "Вид": primary = Default (coral accent), pool = "У пулі" (after a request), dark = "Темна" (main screen action),
// light = "Світла" (secondary action).
export type ButtonVariant = 'primary' | 'pool' | 'dark' | 'light';
export type ButtonSize = 'sm' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

const sizeClasses: Record<ButtonSize, { container: string; text: string }> = {
  sm: { container: 'h-7 rounded-[14px] px-3', text: 'text-button-sm' },
  lg: { container: 'h-[52px] rounded-[26px] px-6', text: 'text-button' },
};

type VariantStyle = {
  container: string;
  pressed: string;
  disabled: string;
  text: string;
  disabledText: string;
  // Figma draws hover as a translucent layer over the fill.
  hoverOverlay: string;
  spinner: string;
};

const variantStyles: Record<ButtonVariant, VariantStyle> = {
  primary: {
    container: 'bg-brand-coral',
    pressed: 'bg-brand-coral-dark',
    disabled: 'bg-border-default',
    text: 'text-text-on-dark',
    disabledText: 'text-text-secondary',
    hoverOverlay: 'rgba(0, 0, 0, 0.1)',
    spinner: colors.text['on-dark'],
  },
  pool: {
    container: 'border border-border-default bg-surface-background',
    pressed: 'border border-border-default bg-border-default',
    disabled: 'border border-border-default bg-surface-background opacity-45',
    text: 'text-text-primary',
    disabledText: 'text-text-primary',
    hoverOverlay: 'rgba(0, 0, 0, 0.05)',
    spinner: colors.text.primary,
  },
  dark: {
    container: 'bg-brand-ink px-9',
    pressed: 'bg-text-primary px-9 opacity-85',
    disabled: 'bg-border-default px-9',
    text: 'text-text-on-dark',
    disabledText: 'text-text-secondary',
    hoverOverlay: 'rgba(255, 255, 255, 0.12)',
    spinner: colors.text['on-dark'],
  },
  light: {
    container: 'bg-surface-background',
    pressed: 'bg-border-default',
    disabled: 'bg-surface-background opacity-45',
    text: 'text-text-primary',
    disabledText: 'text-text-primary',
    hoverOverlay: 'rgba(0, 0, 0, 0.05)',
    spinner: colors.text.primary,
  },
};

export function Button({ label, onPress, variant = 'primary', size = 'lg', disabled, loading, style }: Props) {
  const [hovered, setHovered] = useState(false);
  const sizes = sizeClasses[size];
  const look = variantStyles[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
    >
      {({ pressed }) => {
        const state = disabled ? look.disabled : pressed && !loading ? look.pressed : look.container;
        // The dark button floats, except when pressed or disabled.
        const shadow = variant === 'dark' && !disabled && !(pressed && !loading) ? shadows.button : undefined;
        return (
          <View
            className={`flex-row items-center justify-center overflow-hidden ${sizes.container} ${state}`}
            style={[{ boxShadow: shadow }, style]}
          >
            {hovered && !pressed && !inactive && (
              <View className="absolute inset-0" style={{ backgroundColor: look.hoverOverlay }} />
            )}
            {/* While loading, the label keeps the button's width and the spinner is drawn over it, as in Figma. */}
            <Text
              numberOfLines={1}
              className={`font-inter-semibold ${sizes.text} ${disabled ? look.disabledText : look.text} ${loading ? 'opacity-0' : ''}`}
            >
              {label}
            </Text>
            {loading && (
              <View className="absolute inset-0 items-center justify-center">
                <Spinner size={size} color={look.spinner} />
              </View>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}
