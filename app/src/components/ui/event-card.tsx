// Written with the help of Claude
// AI Usage: event card from the Figma catalog; reviewed by Daryna Halytska.
import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon } from '@/components/ui/icon';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  title: string;
  category: string;
  // Already formatted for display, e.g. "Сб, 18 жовт · 19:00".
  dateLabel: string;
  place: string;
  // Without a cover image the card shows the coral gradient, as the lecture card on the Figma catalog.
  cover?: ImageSource;
  // After a company request the button turns into the "У пулі" variant, as on the Figma catalog.
  inPool?: boolean;
  onPress?: () => void;
  onFindCompany?: () => void;
};

export function EventCard({ title, category, dateLabel, place, cover, inPool, onPress, onFindCompany }: Props) {
  const [favorite, setFavorite] = useState(false);

  // No pressable is nested in another (on the web that would be a <button> inside a <button>): the card's own press
  // area lies behind the content, and the content lets taps through except on the heart and the button.
  return (
    <View className="gap-1 rounded-[22px] bg-surface-card px-2 pb-3.5 pt-2" style={{ boxShadow: shadows.small }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        className="absolute inset-0 rounded-[22px]"
      />

      <View className="h-[170px] overflow-hidden rounded-2xl" style={{ pointerEvents: 'box-none' }}>
        <View className="absolute inset-0" style={{ pointerEvents: 'none' }}>
          {cover ? (
            <Image source={cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <CoralGradient preset="cover" />
          )}
        </View>
        <View
          className="absolute left-2.5 top-2.5 rounded-xl bg-[rgba(18,18,18,0.45)] px-2.5 py-[5px]"
          style={{ pointerEvents: 'none' }}
        >
          <Text className="font-inter-semibold text-tag text-text-on-dark">{category}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="В обране"
          accessibilityState={{ selected: favorite }}
          onPress={() => setFavorite((value) => !value)}
          className="absolute right-2.5 top-2.5 size-9 items-center justify-center rounded-[18px] border border-white/40 bg-white/[0.28]"
        >
          {/* Active: the same Solar heart filled and outlined in brand/coral, so the icon does not move when toggled. */}
          <Icon
            name="heart"
            size={20}
            color={favorite ? colors.brand.coral : colors.text['on-dark']}
            filled={favorite}
          />
        </Pressable>
      </View>

      <View className="gap-3.5 px-2 pt-3" style={{ pointerEvents: 'box-none' }}>
        <View className="gap-2" style={{ pointerEvents: 'none' }}>
          <Text className="font-inter-semibold text-title text-text-primary">{title}</Text>
          <View className="flex-row items-center gap-4">
            <View className="flex-row items-center gap-1.5">
              <Icon name="calendar" size={16} />
              <Text className="font-inter text-caption text-text-secondary">{dateLabel}</Text>
            </View>
            <View className="shrink flex-row items-center gap-1.5">
              <Icon name="pin" size={16} />
              <Text numberOfLines={1} className="shrink font-inter text-caption text-text-secondary">
                {place}
              </Text>
            </View>
          </View>
        </View>
        <View className="flex-row justify-end" style={{ pointerEvents: 'box-none' }}>
          <Button
            label="Знайти компанію"
            size="sm"
            variant={inPool ? 'pool' : 'primary'}
            onPress={onFindCompany}
            style={{ height: 32 }}
          />
        </View>
      </View>
    </View>
  );
}
