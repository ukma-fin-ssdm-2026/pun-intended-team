// Written with the help of Claude
// AI Usage: event card from the Figma catalog; reviewed by Daryna Halytska.
import { BlurTargetView } from 'expo-blur';
import type { ImageSource } from 'expo-image';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';

import type { ApiEventPhoto } from '@/api/images';
import { EventCover } from '@/components/ui/event-cover';
import { Icon } from '@/components/ui/icon';
import { OverlayBadge } from '@/components/ui/overlay-badge';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  title: string;
  category: string;
  // Already formatted for display, e.g. "Сб, 24 жовт · 19:00".
  dateLabel: string;
  place: string;
  // Without a cover image, or when it fails to load, the card shows the coral gradient, as the lecture card on the
  // Figma catalog.
  cover?: ImageSource;
  // The cover an organization uploaded, instead of `cover`.
  photo?: ApiEventPhoto | null;
  // "В обране": the heart is filled in brand/coral while the event is a favourite.
  favorite: boolean;
  onToggleFavorite: () => void;
  // A tap anywhere on the card except the heart opens the event page.
  onPress?: () => void;
};

const accessibilityActions = [{ name: 'activate' }, { name: 'favorite', label: 'В обране' }];

export function EventCard({
  title,
  category,
  dateLabel,
  place,
  cover,
  photo,
  favorite,
  onToggleFavorite,
  onPress,
}: Props) {
  const coverRef = useRef<View>(null);

  // A pressable card groups its content for screen readers, so the heart is offered as its action.
  const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === 'activate') onPress?.();
    if (nativeEvent.actionName === 'favorite') onToggleFavorite();
  };

  // The card is the pressable, with the "link" role: on the web that renders a <div role="link">, not a <button>, so
  // the heart can be a real button inside it. A press on it stays with it.
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[title, category, dateLabel, place].join(', ')}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      className="gap-1 rounded-[22px] bg-surface-card px-2 pb-3.5 pt-2"
      style={{ boxShadow: shadows.small }}
    >
      <View className="h-[170px] overflow-hidden rounded-2xl">
        {/* What the badges blur on Android; the badges themselves stay outside. The price is on the event page only. */}
        <BlurTargetView ref={coverRef} style={StyleSheet.absoluteFill}>
          <EventCover cover={cover} photo={photo} />
        </BlurTargetView>
        <OverlayBadge className="absolute left-2.5 top-2.5 min-w-[72px] px-4" blurTarget={coverRef}>
          <Text className="font-inter-semibold text-tag text-text-on-dark">{category}</Text>
        </OverlayBadge>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="В обране"
          accessibilityState={{ selected: favorite }}
          onPress={onToggleFavorite}
          className="absolute right-2.5 top-2.5"
        >
          <OverlayBadge className="size-9" blurTarget={coverRef}>
            {/* Active: the same Solar heart filled and outlined in brand/coral, so the icon does not move when toggled. */}
            <Icon
              name="heart"
              size={20}
              color={favorite ? colors.brand.coral : colors.text['on-dark']}
              filled={favorite}
            />
          </OverlayBadge>
        </Pressable>
      </View>

      <View className="px-2 pt-3">
        <View className="gap-2">
          {/* Two lines at most, so a long title does not stretch the card; the label above keeps it in full. */}
          <Text numberOfLines={2} className="font-inter-semibold text-title text-text-primary">
            {title}
          </Text>
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
      </View>
    </Pressable>
  );
}
