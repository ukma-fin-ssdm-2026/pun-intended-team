// Written with the help of Claude
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { components } from '@/api/schema';
import { colors, fontSizes, spacing } from '@/styles/theme';

type Category = components['schemas']['Category'];

type Props = {
  categories: Category[];
  selectedId: string | undefined;
  onSelect: (id: string | undefined) => void;
};

export function CategoryFilter({ categories, selectedId, onSelect }: Props) {
  const options = [{ id: undefined, name: 'All' }, ...categories];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <Pressable
            key={option.id ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option.id)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: fontSizes.sm, color: colors.text },
  labelSelected: { color: colors.onPrimary },
});
