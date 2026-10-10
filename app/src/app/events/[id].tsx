// Written with the help of Claude
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ErrorMessage } from '@/components/error-message';
import { Loading } from '@/components/loading';
import { formatDateTime } from '@/dates';
import { useEvent } from '@/hooks/use-event';
import { colors, fontSizes, spacing } from '@/styles/theme';

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: event, loading, error } = useEvent(id);

  let content;
  if (loading) {
    content = <Loading />;
  } else if (error || !event) {
    content = <ErrorMessage message={error ?? 'Could not load the event.'} />;
  } else {
    content = (
      <ScrollView contentContainerStyle={styles.content}>
        {event.status === 'cancelled' && <Text style={styles.cancelled}>Cancelled</Text>}
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.category}>{event.category.name}</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Starts</Text>
          <Text style={styles.value}>{formatDateTime(event.startsAt)}</Text>
          <Text style={styles.label}>Ends</Text>
          <Text style={styles.value}>{formatDateTime(event.endsAt)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Venue</Text>
          <Text style={styles.value}>{event.venue.name}</Text>
          <Text style={styles.muted}>{event.venue.address}</Text>
        </View>

        <Text style={styles.description}>{event.description}</Text>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: event?.title ?? 'Event' }} />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.md, padding: spacing.md },
  cancelled: {
    alignSelf: 'flex-start',
    backgroundColor: colors.danger,
    color: colors.onPrimary,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  title: { fontSize: fontSizes.xl, fontWeight: '600', color: colors.text },
  category: { fontSize: fontSizes.md, color: colors.primary },
  section: { gap: spacing.xs, backgroundColor: colors.surface, borderRadius: 12, padding: spacing.md },
  label: { fontSize: fontSizes.sm, color: colors.textMuted },
  value: { fontSize: fontSizes.md, color: colors.text },
  muted: { fontSize: fontSizes.md, color: colors.textMuted },
  description: { fontSize: fontSizes.md, color: colors.text, lineHeight: 22 },
});
