// Written with the help of Claude
// AI Usage: labelled text field with the Figma Default, Focus and Error states; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/styles/tokens';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
};

export function TextField({ label, error, onFocus, onBlur, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  // Default has a transparent border, so the text does not shift when the focus or error border appears.
  const border = error ? 'border-brand-coral' : focused ? 'border-brand-ink' : 'border-transparent';

  return (
    <View className="gap-1.5">
      <Text className="font-inter text-caption text-text-secondary">{label}</Text>
      <View className={`h-[52px] justify-center rounded-2xl border-[1.5px] bg-surface-background px-4 ${border}`}>
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
      {error && <Text className="font-inter text-caption text-brand-coral">{error}</Text>}
    </View>
  );
}
