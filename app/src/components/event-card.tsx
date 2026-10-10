// Written with the help of Claude
import { Pressable, StyleSheet, Text } from 'react-native';

import type { components } from '@/api/schema';
import { formatDateTime } from '@/dates';
import { colors, fontSizes, spacing } from '@/styles/theme';

type Event = components['schemas']['Event'];

export function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      <Text style={styles.title}>{event.title}</Text>
      <Text style={styles.category}>{event.category.name}</Text>
      <Text style={styles.meta}>{event.venue.name}</Text>
      <Text style={styles.meta}>{formatDateTime(event.startsAt)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: { fontSize: fontSizes.lg, fontWeight: '600', color: colors.text },
  category: { fontSize: fontSizes.sm, color: colors.primary },
  meta: { fontSize: fontSizes.md, color: colors.textMuted },
});
