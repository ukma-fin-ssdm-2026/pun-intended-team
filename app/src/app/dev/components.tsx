// Written with the help of Claude
// AI Usage: development gallery of the base components with mock data; reviewed by Daryna Halytska.
import { Redirect, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EventCard } from '@/components/ui/event-card';
import { Icon, iconNames } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { SearchField } from '@/components/ui/search-field';
import { TabBar, type TabName } from '@/components/ui/tab-bar';
import { TextField } from '@/components/ui/text-field';
import { Toggle } from '@/components/ui/toggle';
import { mockCategories, mockEvents } from '@/mocks/events';

// Variant and size pairs that exist in Figma ("Кнопка / Основна").
const buttonColumns: { variant: ButtonVariant; size: ButtonSize }[] = [
  { variant: 'primary', size: 'sm' },
  { variant: 'primary', size: 'lg' },
  { variant: 'pool', size: 'sm' },
  { variant: 'dark', size: 'lg' },
  { variant: 'light', size: 'lg' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text className="font-inter-semibold text-title text-text-primary">{title}</Text>
      {children}
    </View>
  );
}

export default function ComponentsGallery() {
  const [phone, setPhone] = useState('+380 67 123 45 67');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(mockCategories[0].id);
  const [toggle, setToggle] = useState(true);
  const [tab, setTab] = useState<TabName>('events');

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ScrollView className="flex-1 bg-surface-background" contentContainerClassName="gap-8 p-5 pb-24">
      <Stack.Screen options={{ title: 'Компоненти' }} />

      <Section title="Іконки · Solar Linear">
        <View className="flex-row flex-wrap gap-4">
          {iconNames.map((name) => (
            <View key={name} className="w-20 items-center gap-1">
              <Icon name={name} />
              <Text className="text-center font-inter text-tag text-text-secondary">{name}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Кнопки">
        <Text className="font-inter text-caption text-text-secondary">
          Наведення працює у вебі; натиснутий стан видно, поки тримаєш кнопку.
        </Text>
        {(['default', 'disabled', 'loading'] as const).map((state) => (
          <View key={state} className="flex-row flex-wrap items-center gap-3">
            {buttonColumns.map(({ variant, size }) => (
              <Button
                key={`${variant}-${size}`}
                label="Знайти компанію"
                variant={variant}
                size={size}
                disabled={state === 'disabled'}
                loading={state === 'loading'}
              />
            ))}
          </View>
        ))}
        <View className="flex-row items-center gap-3 rounded-2xl bg-brand-ink p-3">
          <IconButton icon="filter" accessibilityLabel="Фільтри" />
          <IconButton icon="arrow-right" variant="glass" accessibilityLabel="Усі категорії" />
        </View>
      </Section>

      <Section title="Поля і чіпси">
        <TextField label="Номер телефону" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextField label="Номер телефону" value="+380 67 123 45" error="Перевір номер, бракує цифр" editable={false} />
        <SearchField value={search} onChangeText={setSearch} />
        <View className="flex-row flex-wrap gap-2 rounded-2xl bg-brand-ink p-3">
          {mockCategories.map((item) => (
            <Chip
              key={item.id}
              label={item.name}
              selected={item.id === category}
              onPress={() => setCategory(item.id)}
            />
          ))}
        </View>
        <Toggle value={toggle} onValueChange={setToggle} accessibilityLabel="Перемикач" />
      </Section>

      <Section title="Картки">
        <EventCard
          title={mockEvents[0].title}
          category={mockEvents[0].category.name}
          dateLabel="Сб, 18 жовт · 19:00"
          place="Поділ"
          cover={mockEvents[0].cover}
        />
      </Section>

      <Section title="Навігація">
        <View className="pt-10">
          <TabBar active={tab} onTabPress={setTab} />
        </View>
        <Text className="font-inter text-caption text-text-secondary">Найвужчий екран, 320 px (FLEX-001):</Text>
        <View className="pt-10" style={{ width: 320 }}>
          <TabBar active={tab} onTabPress={setTab} />
        </View>
      </Section>
    </ScrollView>
  );
}
