// Written with the help of Claude
// AI Usage: post of the Figma "Т3 Оголошення" feed; reviewed by Daryna Halytska.
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ApiPicture } from '@/components/pictures/picture';
import { coverOf, EventCover } from '@/components/ui/event-cover';
import { Icon } from '@/components/ui/icon';
import { formatEventDate } from '@/dates';
import { useEvent } from '@/hooks/use-event';
import type { Post } from '@/components/announcements/post';
import { colors } from '@/styles/tokens';

type Props = {
  post: Post;
  onReport: () => void;
  // The menu of the user's own post deletes it instead of reporting it.
  onDelete?: () => void;
  // "Хочу піти": the screen sends the request and shows Т3.2 or the failure. Т3.3 returns to the feed.
  onRequest?: (post: Post) => Promise<void>;
  // The heart: the screen turns it at once and asks the API.
  onLike?: (post: Post) => void;
};

// The post action in Figma: "Хочу піти" sends a request (Т3.2), after which it reads "Запит надіслано", also once the
// author declined, so a decline stays private. An accepted request opens 07 "Це взаємно!" with the author's contacts;
// "Ти йдеш" is a post the user already joined.
function JoinAction({ post, onRequest }: { post: Post; onRequest?: (post: Post) => Promise<void> }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const request = post.myRequest;

  if (request?.status === 'accepted') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/mutual', params: { request: request.id } })}
        className="flex-row items-center gap-1.5 rounded-2xl bg-brand-coral py-1.5 pl-2.5 pr-3"
      >
        <Icon name="check" size={16} color={colors.text['on-dark']} />
        <Text className="font-inter-semibold text-tag text-text-on-dark">Запит прийнято</Text>
      </Pressable>
    );
  }

  if (post.going) {
    return (
      <View className="flex-row items-center gap-1.5 rounded-2xl bg-brand-coral py-1.5 pl-2.5 pr-3">
        <Icon name="check" size={16} color={colors.text['on-dark']} />
        <Text className="font-inter-semibold text-tag text-text-on-dark">Ти йдеш</Text>
      </View>
    );
  }

  const requested = request !== undefined;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={requested || sending || !onRequest}
      accessibilityState={{ disabled: requested || sending, busy: sending }}
      onPress={async () => {
        if (!onRequest) return;
        setSending(true);
        await onRequest(post);
        setSending(false);
      }}
      // Figma's 1 px stroke lies inside the pill: the padding is 1 px less than its 6 / 10 / 12.
      className="flex-row items-center gap-1.5 rounded-2xl border border-border-default py-[5px] pl-[9px] pr-[11px]"
    >
      <Icon name="matches" size={16} />
      <Text className="font-inter-semibold text-tag text-text-primary">
        {requested ? 'Запит надіслано' : 'Хочу піти'}
      </Text>
    </Pressable>
  );
}

// The catalog event a post is about; left out of the card until it loads, and when it cannot.
function LinkedEvent({ eventId }: { eventId: string }) {
  const { data: event } = useEvent(eventId);
  if (!event) return null;

  return (
    // Inside 1 px stroke, as above: Figma's padding 8 / 8 / 12 minus the border.
    <View className="flex-row items-center gap-3 rounded-2xl border border-border-default py-[7px] pl-[7px] pr-[11px]">
      <View className="size-14 overflow-hidden rounded-xl">
        <EventCover cover={coverOf(event.imageUrl)} photo={event.photo} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-semibold text-tag text-brand-coral">Подія з каталогу</Text>
        <Text numberOfLines={1} className="font-inter-medium text-label text-text-primary">
          {event.title}
        </Text>
        <Text className="font-inter text-caption text-text-secondary">
          {formatEventDate(event.startsAt, event.startTimeKnown)}
        </Text>
      </View>
    </View>
  );
}

export function PostCard({ post, onReport, onDelete, onRequest, onLike }: Props) {
  const liked = post.liked ?? false;
  const likeCount = post.likeCount ?? 0;

  return (
    <View className="flex-row items-start gap-3 px-5 py-3.5">
      <View className="size-11 items-center justify-center overflow-hidden rounded-[22px] bg-surface-background">
        {post.authorPhoto ? (
          <ApiPicture image={post.authorPhoto} />
        ) : (
          <Text className="font-inter-semibold text-title text-text-secondary">{post.initial}</Text>
        )}
      </View>
      <View className="flex-1 gap-2">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-inter-medium text-label text-text-primary">{post.nameAge}</Text>
          <Text className="flex-1 font-inter text-caption text-text-secondary">{post.meta}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={post.own && onDelete ? 'Видалити допис' : 'Ще'}
            onPress={post.own && onDelete ? onDelete : onReport}
            hitSlop={10}
          >
            <Icon name="menu-dots" size={18} color={colors.text.secondary} />
          </Pressable>
        </View>

        {post.title && <Text className="font-inter-semibold text-body text-text-primary">{post.title}</Text>}
        {post.text !== '' && <Text className="font-inter text-body text-text-primary">{post.text}</Text>}

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

        {post.eventId && <LinkedEvent eventId={post.eventId} />}

        {(post.apiPhoto || post.photo) && (
          <View className="h-[150px] overflow-hidden rounded-2xl">
            {post.apiPhoto ? (
              <ApiPicture image={post.apiPhoto} />
            ) : (
              <Image source={post.photo} contentFit="cover" style={{ width: '100%', height: '100%' }} />
            )}
          </View>
        )}

        <View className="flex-row items-center gap-5">
          {post.own ? (
            <Text className="font-inter-semibold text-tag text-text-secondary">Твій допис</Text>
          ) : (
            <JoinAction post={post} onRequest={onRequest} />
          )}
          {/* Share has no prototype link; shown as in Figma. */}
          <Icon name="share" size={18} color={colors.text.secondary} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Подобається"
            accessibilityState={{ selected: liked }}
            accessibilityValue={likeCount > 0 ? { text: String(likeCount) } : undefined}
            onPress={() => onLike?.(post)}
            hitSlop={10}
            className="flex-row items-center gap-1"
          >
            {/* Liked: the heart filled and outlined in brand/coral, as on the event card. */}
            <Icon name="heart" size={18} color={liked ? colors.brand.coral : colors.text.secondary} filled={liked} />
            {/* Figma has no counter; a small number, left out while nobody likes the post. */}
            {likeCount > 0 && <Text className="font-inter text-caption text-text-secondary">{likeCount}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
