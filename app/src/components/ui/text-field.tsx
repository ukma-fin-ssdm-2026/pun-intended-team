// Written with the help of Claude
// AI Usage: labelled text field with the Figma Default, Focus and Error states; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  // Marks the field as required with a coral asterisk after the label, as in Figma.
  required?: boolean;
  error?: string;
  // Figma's "Список": a choice from a list with a chevron at the end. The field is pressed instead of typed in, and
  // `open` gives it the Focus border while its list is shown.
  list?: { open: boolean; onPress: () => void };
};

export function TextField({ label, required = false, error, list, onFocus, onBlur, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  const active = list ? list.open : focused;
  // Default has a transparent border, so the text does not shift when the focus or error border appears.
  const border = error ? 'border-brand-coral' : active ? 'border-brand-ink' : 'border-transparent';
  const box = `h-[52px] rounded-2xl border-[1.5px] bg-surface-background px-4 ${border}`;

  return (
    <View className="gap-1.5">
      <Text className="font-inter text-caption text-text-secondary">
        {label}
        {required && <Text className="text-brand-coral"> *</Text>}
      </Text>
      {list ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: list.open }}
          onPress={list.onPress}
          className={`flex-row items-center gap-2.5 ${box}`}
        >
          <Text numberOfLines={1} className="flex-1 font-inter text-body text-text-primary">
            {inputProps.value}
          </Text>
          <View style={{ transform: [{ rotate: '90deg' }] }}>
            <Icon name="field-chevron" size={18} color={colors.text.secondary} />
          </View>
        </Pressable>
      ) : (
        <View className={`justify-center ${box}`}>
          <TextInput
            accessibilityLabel={label}
            placeholderTextColor={colors.text.secondary}
            className="font-inter text-body text-text-primary"
            // Hides the browser focus ring; the field draws its own focus border.
            style={{ outlineWidth: 0 }}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            {...inputProps}
          />
        </View>
      )}
      {error && <Text className="font-inter text-caption text-brand-coral">{error}</Text>}
    </View>
  );
}
