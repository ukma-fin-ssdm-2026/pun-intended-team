// Written with the help of Claude
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { CategoryFilter } from '@/components/category-filter';
import { ErrorMessage } from '@/components/error-message';
import { EventCard } from '@/components/event-card';
import { Loading } from '@/components/loading';
import { useCategories } from '@/hooks/use-categories';
import { useEvents } from '@/hooks/use-events';
import { colors, fontSizes, spacing } from '@/styles/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<string>();
  const categories = useCategories();
  const events = useEvents(categoryId);

  let content;
  if (events.loading) {
    content = <Loading />;
  } else if (events.error) {
    content = <ErrorMessage message={events.error} />;
  } else if (!events.data?.length) {
    content = (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No events</Text>
      </View>
    );
  } else {
    content = (
      <FlatList
        data={events.data}
        keyExtractor={(event) => event.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <EventCard event={item} onPress={() => router.push({ pathname: '/events/[id]', params: { id: item.id } })} />
        )}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Nearby' }} />
      <View>
        <CategoryFilter categories={categories.data ?? []} selectedId={categoryId} onSelect={setCategoryId} />
      </View>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { gap: spacing.sm, padding: spacing.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { fontSize: fontSizes.md, color: colors.textMuted },
});
