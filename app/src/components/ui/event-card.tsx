// Written with the help of Claude
// AI Usage: event card from the Figma catalog; reviewed by Daryna Halytska.
import { BlurTargetView } from 'expo-blur';
import { Image, type ImageSource } from 'expo-image';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';

import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Glass } from '@/components/ui/glass';
import { Icon } from '@/components/ui/icon';
import { colors, shadows } from '@/styles/tokens';

type Props = {
  title: string;
  category: string;
  // Already formatted for display, e.g. "Сб, 24 жовт · 19:00".
  dateLabel: string;
  place: string;
  // Without a cover image the card shows the coral gradient, as the lecture card on the Figma catalog.
  cover?: ImageSource;
  // After a company request the button turns into the "У пулі" variant, as on the Figma catalog.
  inPool?: boolean;
  // "В обране": the heart is filled in brand/coral while the event is a favourite.
  favorite: boolean;
  onToggleFavorite: () => void;
  // A tap anywhere on the card except the heart opens the event page.
  onPress?: () => void;
  // In the prototype "Знайти компанію" and "У пулі" have no target of their own and open the event page like the card;
  // without this handler the button does the same as onPress.
  onFindCompany?: () => void;
};

const accessibilityActions = [
  { name: 'activate' },
  { name: 'favorite', label: 'В обране' },
  { name: 'findCompany', label: 'Знайти компанію' },
];

export function EventCard({
  title,
  category,
  dateLabel,
  place,
  cover,
  inPool,
  favorite,
  onToggleFavorite,
  onPress,
  onFindCompany,
}: Props) {
  const coverRef = useRef<View>(null);
  const findCompany = onFindCompany ?? onPress;

  // A pressable card groups its content for screen readers, so the heart and the button are offered as its actions.
  const onAccessibilityAction = ({ nativeEvent }: AccessibilityActionEvent) => {
    if (nativeEvent.actionName === 'activate') onPress?.();
    if (nativeEvent.actionName === 'favorite') onToggleFavorite();
    if (nativeEvent.actionName === 'findCompany') findCompany?.();
  };

  // The card is the pressable, with the "link" role: on the web that renders a <div role="link">, not a <button>, so
  // the heart and the action button can be real buttons inside it. A press on them stays with them.
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${title}, ${category}, ${dateLabel}, ${place}`}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={onAccessibilityAction}
      onPress={onPress}
      className="gap-1 rounded-[22px] bg-surface-card px-2 pb-3.5 pt-2"
      style={{ boxShadow: shadows.small }}
    >
      <View className="h-[170px] overflow-hidden rounded-2xl">
        {/* What the glass blurs on Android; the glass itself stays outside. */}
        <BlurTargetView ref={coverRef} style={StyleSheet.absoluteFill}>
          {cover ? (
            <Image source={cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            <CoralGradient preset="cover" />
          )}
        </BlurTargetView>
        <Glass
          className="absolute left-2.5 top-2.5 px-2.5 py-[5px]"
          radius={12}
          fill="rgba(18, 18, 18, 0.45)"
          tone="dark"
          blurTarget={coverRef}
        >
          <Text className="font-inter-semibold text-tag text-text-on-dark">{category}</Text>
        </Glass>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="В обране"
          accessibilityState={{ selected: favorite }}
          onPress={onToggleFavorite}
          className="absolute right-2.5 top-2.5"
        >
          <Glass
            className="size-9 items-center justify-center"
            radius={18}
            fill="rgba(255, 255, 255, 0.28)"
            border="rgba(255, 255, 255, 0.4)"
            tone="light"
            blurTarget={coverRef}
          >
            {/* Active: the same Solar heart filled and outlined in brand/coral, so the icon does not move when toggled. */}
            <Icon
              name="heart"
              size={20}
              color={favorite ? colors.brand.coral : colors.text['on-dark']}
              filled={favorite}
            />
          </Glass>
        </Pressable>
      </View>

      <View className="gap-3.5 px-2 pt-3">
        <View className="gap-2">
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
        <View className="flex-row justify-end">
          <Button
            label="Знайти компанію"
            size="sm"
            variant={inPool ? 'pool' : 'primary'}
            onPress={findCompany}
            style={{ height: 32 }}
          />
        </View>
      </View>
    </Pressable>
  );
}
