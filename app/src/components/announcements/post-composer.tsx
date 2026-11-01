// Written with the help of Claude
// AI Usage: post editor from the Figma "Д2 Оголошення · новий допис" frame; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { useProfileInitial } from '@/hooks/use-profile';
import { mockDraft } from '@/mocks/announcements';
import { colors } from '@/styles/tokens';

// "Фото", "Дата", "Подія з каталогу", "Категорія": no prototype links, shown as in Figma.
const tools: IconName[] = ['gallery-edit', 'calendar', 'ticket', 'category-all'];

type Props = {
  // "Опублікувати": the prototype returns to the feed (Т3).
  onPublish: () => void;
  // "+ Місце" opens Д2.1 Місце на мапі.
  onAddPlace: () => void;
};

export function PostComposer({ onPublish, onAddPlace }: Props) {
  const initial = useProfileInitial();
  // Figma's draft, ready to edit.
  const [text, setText] = useState(mockDraft.text);
  const [dateShown, setDateShown] = useState(true);

  return (
    <View className="flex-row items-start gap-3 px-5 py-3.5">
      <View className="size-10 items-center justify-center rounded-[20px] bg-brand-ink">
        <Text className="font-inter-semibold text-title text-text-on-dark">{initial}</Text>
      </View>
      <View className="flex-1 gap-3">
        {/* Figma's 1 px stroke lies inside the chip: the padding is 1 px less than its 5 / 10 / 12. */}
        <View className="flex-row items-center gap-1.5 self-start rounded-[14px] border border-border-default py-1 pl-[9px] pr-[11px]">
          <Icon name="pin" size={14} color={colors.brand.coral} />
          <Text className="font-inter-semibold text-tag text-brand-coral">{mockDraft.audience}</Text>
        </View>

        <TextInput
          accessibilityLabel="Текст допису"
          multiline
          autoFocus
          value={text}
          onChangeText={setText}
          textAlignVertical="top"
          className="p-0 font-inter text-[17px] leading-6 text-text-primary"
          // Hides the browser focus ring, as in the other fields.
          style={{ outlineWidth: 0 }}
        />

        <View className="flex-row flex-wrap gap-2">
          {dateShown && (
            <View className="flex-row items-center gap-1.5 rounded-[14px] bg-surface-background py-[7px] pl-2.5 pr-2">
              <Icon name="calendar" size={15} />
              <Text className="font-inter-semibold text-tag text-text-primary">{mockDraft.date}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Прибрати" onPress={() => setDateShown(false)}>
                <Icon name="close" size={14} color={colors.text.secondary} />
              </Pressable>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            onPress={onAddPlace}
            className="flex-row items-center gap-1.5 rounded-[14px] bg-surface-background py-[7px] pl-2.5 pr-3"
          >
            <Icon name="pin" size={15} color={colors.text.secondary} />
            <Text className="font-inter-semibold text-tag text-text-secondary">+ Місце</Text>
          </Pressable>
        </View>

        <View className="h-px bg-border-default" />

        <View className="flex-row items-center gap-4">
          {tools.map((tool) => (
            <Icon key={tool} name={tool} size={20} color={colors.brand.coral} />
          ))}
          <View className="flex-1" />
          <Pressable
            accessibilityRole="button"
            onPress={onPublish}
            className="rounded-2xl bg-brand-coral px-3.5 py-2 active:opacity-90"
          >
            <Text className="font-inter-semibold text-button-sm text-text-on-dark">Опублікувати</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
