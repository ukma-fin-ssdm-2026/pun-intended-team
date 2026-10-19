// Written with the help of Claude
// AI Usage: search field from the Figma catalog and map screens; reviewed by Daryna Halytska.
import { TextInput, View, type TextInputProps } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { colors } from '@/styles/tokens';

type Props = Omit<TextInputProps, 'style'>;

export function SearchField({ placeholder = 'Пошук подій…', ...inputProps }: Props) {
  return (
    <View className="h-[50px] flex-row items-center gap-2.5 rounded-2xl bg-surface-card px-4">
      <Icon name="search" size={20} />
      <TextInput
        accessibilityRole="search"
        placeholder={placeholder}
        placeholderTextColor={colors.text.secondary}
        className="flex-1 font-inter text-body text-text-primary"
        style={{ outlineWidth: 0 }}
        {...inputProps}
      />
    </View>
  );
}
