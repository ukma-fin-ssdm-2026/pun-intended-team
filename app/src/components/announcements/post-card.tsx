// Written with the help of Claude
// AI Usage: post of the Figma "Т3 Оголошення" feed; reviewed by Daryna Halytska.
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon } from '@/components/ui/icon';
import { formatEventDate } from '@/dates';
import type { Post } from '@/mocks/announcements';
import { findMockEvent } from '@/mocks/events';
import { toggleLike, useLiked } from '@/state/post-likes';
import { colors } from '@/styles/tokens';

type Props = {
  post: Post;
  onReport: () => void;
};

export function PostCard({ post, onReport }: Props) {
  // "Хочу піти" and "Ти йдеш" are the two Figma states of the same action.
  const [going, setGoing] = useState(post.going);
  const liked = useLiked(post.id);
  const event = post.eventId ? findMockEvent(post.eventId) : undefined;

  return (
    <View className="flex-row items-start gap-3 px-5 py-3.5">
      <View className="size-11 items-center justify-center rounded-[22px] bg-surface-background">
        <Text className="font-inter-semibold text-title text-text-secondary">{post.initial}</Text>
      </View>
      <View className="flex-1 gap-2">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-inter-medium text-label text-text-primary">{post.nameAge}</Text>
          <Text className="flex-1 font-inter text-caption text-text-secondary">{post.meta}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Ще" onPress={onReport} hitSlop={10}>
            <Icon name="menu-dots" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>

        <Text className="font-inter text-body text-text-primary">{post.text}</Text>

        {post.chips && (
          <View className="flex-row gap-2">
            {post.chips.map((chip) => (
              <View
                key={chip.label}
                className="flex-row items-center gap-[5px] rounded-xl bg-surface-background py-1.5 pl-2 pr-2.5"
              >
                <Icon name={chip.icon} size={14} />
                <Text className="font-inter-semibold text-tag text-text-primary">{chip.label}</Text>
              </View>
            ))}
          </View>
        )}

        {event && (
          // Inside 1 px stroke, as above: Figma's padding 8 / 8 / 12 minus the border.
          <View className="flex-row items-center gap-3 rounded-2xl border border-border-default py-[7px] pl-[7px] pr-[11px]">
            <View className="size-14 overflow-hidden rounded-xl">
              {event.cover ? (
                <Image source={event.cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
              ) : (
                <CoralGradient preset="cover" />
              )}
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-inter-semibold text-tag text-brand-coral">Подія з каталогу</Text>
              <Text numberOfLines={1} className="font-inter-medium text-label text-text-primary">
                {event.title}
              </Text>
              <Text className="font-inter text-caption text-text-secondary">{formatEventDate(event.startsAt)}</Text>
            </View>
          </View>
        )}

        {post.photo && (
          <View className="h-[150px] overflow-hidden rounded-2xl">
            <Image source={post.photo} contentFit="cover" style={{ width: '100%', height: '100%' }} />
          </View>
        )}

        <View className="flex-row items-center gap-5">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: going }}
            onPress={() => setGoing((value) => !value)}
            // Figma's 1 px stroke lies inside the pill: the padding is 1 px less than its 6 / 10 / 12.
            className={`flex-row items-center gap-1.5 rounded-2xl border py-[5px] pl-[9px] pr-[11px] ${
              going ? 'border-brand-coral bg-brand-coral' : 'border-border-default'
            }`}
          >
            <Icon
              name={going ? 'check' : 'matches'}
              size={16}
              color={going ? colors.text['on-dark'] : colors.text.primary}
            />
            <Text className={`font-inter-semibold text-tag ${going ? 'text-text-on-dark' : 'text-text-primary'}`}>
              {going ? 'Ти йдеш' : 'Хочу піти'}
            </Text>
          </Pressable>
          {/* Share has no prototype link; shown as in Figma. */}
          <Icon name="share" size={18} color={colors.text.secondary} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Подобається"
            accessibilityState={{ selected: liked }}
            onPress={() => toggleLike(post.id)}
            hitSlop={10}
          >
            {/* Liked: the heart filled and outlined in brand/coral, as on the event card. */}
            <Icon name="heart" size={18} color={liked ? colors.brand.coral : colors.text.secondary} filled={liked} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
