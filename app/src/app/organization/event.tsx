// Written with the help of Claude
// AI Usage: event editor from the Figma "О2 Організація · Нова подія" frame, on mock data; reviewed by Daryna Halytska.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { mockEventCategories, mockEventDraft } from '@/mocks/organization';
import { colors, shadows } from '@/styles/tokens';

// "01 Навігація" starts 56 px from the top (9 px below the iPhone 14 status bar); "03 Дія" has a 34 px bottom padding.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const ACTION_BOTTOM = 34;
// "Список категорій" opens 6 px under the field (18 px label, 6 px gap, 52 px field) and shows four and a half rows.
const LIST_TOP = 18 + 6 + 52 + 6;
const LIST_HEIGHT = 232;

function CategoryList({ selected, onSelect }: { selected: string; onSelect: (category: string) => void }) {
  return (
    <View
      className="absolute left-0 right-0 overflow-hidden rounded-[18px] bg-surface-card"
      style={{ top: LIST_TOP, height: LIST_HEIGHT, boxShadow: shadows.medium, elevation: 8 }}
    >
      <ScrollView nestedScrollEnabled contentContainerClassName="py-1">
        {mockEventCategories.map((category) => {
          const isSelected = category === selected;
          return (
            <Pressable
              key={category}
              accessibilityRole="menuitem"
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(category)}
              className="flex-row items-center gap-3 px-4 py-[13px]"
            >
              <Text
                className={`flex-1 text-body ${isSelected ? 'font-inter-medium text-brand-coral' : 'font-inter text-text-primary'}`}
              >
                {category}
              </Text>
              {isSelected && <Icon name="toast-check" size={18} color={colors.brand.coral} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function OrganizationEventEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(mockEventDraft.title);
  const [category, setCategory] = useState(mockEventDraft.category);
  // О2.1: the field opens its list in place; picking a category closes it.
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [date, setDate] = useState(mockEventDraft.date);
  const [time, setTime] = useState(mockEventDraft.time);
  const [place, setPlace] = useState('');
  const [description, setDescription] = useState(mockEventDraft.description);
  useStatusBarStyle('dark');

  // "Чернетка" and "Опублікувати подію" both return to О1 in the prototype.
  const backToEvents = () => router.dismissTo('/organization');

  return (
    <KeyboardAvoidingView className="flex-1 bg-surface-card" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View
        className="flex-row items-center gap-3 px-5 pb-3"
        style={{ paddingTop: Math.max(NAV_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={() => router.back()}
          className="size-10 items-center justify-center rounded-[20px] bg-surface-background"
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-inter-semibold text-title text-text-primary"
        >
          Нова подія
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Зберегти чернетку" onPress={backToEvents}>
          <Text className="font-inter-medium text-label text-text-secondary">Чернетка</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pb-[120px] pt-2"
        keyboardShouldPersistTaps="handled"
      >
        <View className="h-[140px] items-center justify-center gap-2 rounded-[22px] border-[1.5px] border-dashed border-border-default bg-surface-background">
          <View className="size-12 items-center justify-center rounded-2xl bg-surface-card">
            <Icon name="gallery-edit" size={24} color={colors.brand.coral} />
          </View>
          <Text className="font-inter-medium text-label text-text-primary">Додати обкладинку</Text>
          <Text className="font-inter text-caption text-text-secondary">JPG або PNG, від 1200 px завширшки</Text>
        </View>

        <TextField label="Назва" value={title} onChangeText={setTitle} />
        <View className="z-10">
          <TextField
            label="Категорія"
            value={category}
            list={{ open: categoryOpen, onPress: () => setCategoryOpen((open) => !open) }}
          />
          {categoryOpen && (
            <CategoryList
              selected={category}
              onSelect={(picked) => {
                setCategory(picked);
                setCategoryOpen(false);
              }}
            />
          )}
        </View>
        <View className="flex-row gap-2.5">
          <View className="flex-1">
            <TextField label="Дата" value={date} onChangeText={setDate} />
          </View>
          <View className="flex-1">
            <TextField label="Початок" value={time} onChangeText={setTime} />
          </View>
        </View>
        {/* Figma shows the empty place in its error state: the event cannot be published without it. */}
        <TextField
          label="Місце"
          value={place}
          onChangeText={setPlace}
          placeholder="Почни вводити адресу…"
          error={place.trim() ? undefined : 'Вкажи місце, без нього подію не опублікувати'}
        />
        <View className="gap-1.5">
          <Text className="font-inter text-caption text-text-secondary">Опис</Text>
          <TextInput
            accessibilityLabel="Опис"
            multiline
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
            className="rounded-2xl bg-surface-background px-4 py-3.5 font-inter text-body text-text-primary"
            // Hides the browser focus ring, as in the other fields.
            style={{ outlineWidth: 0 }}
          />
        </View>
      </ScrollView>

      <View className="bg-surface-card px-5 pt-4" style={{ paddingBottom: Math.max(ACTION_BOTTOM, insets.bottom) }}>
        <Button label="Опублікувати подію" variant="dark" onPress={backToEvents} />
      </View>
    </KeyboardAvoidingView>
  );
}
