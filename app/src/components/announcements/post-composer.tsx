// Written with the help of Claude
// AI Usage: post editor from the Figma "Д2 Оголошення · новий допис" frame; reviewed by Daryna Halytska.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { uploadListingPhoto } from '@/api/images';
import { createListing, type Listing } from '@/api/listings';
import type { ApiResult } from '@/api/public-client';
import { failureMessage, pictureRefusalSnackbar } from '@/auth/messages';
import { Picture } from '@/components/pictures/picture';
import { usePictureCropper } from '@/components/pictures/picture-cropper';
import { Icon, type IconName } from '@/components/ui/icon';
import { kyivDay, tomorrow, weekendDays } from '@/dates';
import { useCategories } from '@/hooks/use-categories';
import { mockDraft } from '@/mocks/announcements';
import type { PictureDraft } from '@/pictures/picked-picture';
import { clearPickedPlace, usePickedPlace } from '@/state/post-place';
import { colors } from '@/styles/tokens';

// "Дата", "Подія з каталогу", "Категорія": no prototype links, shown as in Figma. "Фото" opens the gallery.
const tools: IconName[] = ['calendar', 'ticket', 'category-all'];

type Failure = Extract<ApiResult<unknown>, { ok: false }>;

// The API's limits: the first line of the text is the title, the rest is the description.
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

type Props = {
  // Called with the listing the API created: the feed shows it and the editor closes. `photoFailure`: the listing is
  // posted, but its photo was not.
  onPublished: (listing: Listing, photoFailure?: Failure) => void;
  // "+ Місце" opens Д2.1 Місце на мапі.
  onAddPlace: () => void;
};

// What the API's answer means for the author, in words.
function publishFailure(failure: Failure): string {
  switch (failure.code) {
    case 'LISTING_DATE_IN_PAST':
      return 'Ця дата вже минула. Обери іншу.';
    case 'REFERENCE_NOT_FOUND':
      return 'Такої категорії вже немає. Обери іншу.';
    case 'PLACE_OUTSIDE_CITY':
      return 'Місце має бути в Києві. Обери інше.';
    case 'VALIDATION_ERROR':
      return `Перевір допис: заголовок до ${TITLE_MAX} символів, решта тексту до ${DESCRIPTION_MAX}.`;
    case 'UNAUTHENTICATED':
      return 'Увійди ще раз, щоб опублікувати допис.';
    default:
      return failureMessage(failure);
  }
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`rounded-[14px] px-3 py-[7px] ${selected ? 'bg-brand-coral' : 'bg-surface-background'}`}
    >
      <Text className={`font-inter-semibold text-tag ${selected ? 'text-text-on-dark' : 'text-text-primary'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PostComposer({ onPublished, onAddPlace }: Props) {
  const categories = useCategories();
  // Picked on Д2.1; a new editor starts without one.
  const place = usePickedPlace();
  useEffect(() => clearPickedPlace, []);
  const [text, setText] = useState('');
  const [categoryId, setCategoryId] = useState<string>();
  const [error, setError] = useState<string>();
  const [publishing, setPublishing] = useState(false);
  const [photo, setPhoto] = useState<PictureDraft>();
  const { start: pickPhoto, cropper } = usePictureCropper(
    (_kind, draft) => {
      setPhoto(draft);
      setError(undefined);
    },
    (refusal) => {
      const { title, note } = pictureRefusalSnackbar(refusal);
      setError(`${title}. ${note}.`);
    },
  );

  const today = kyivDay(new Date());
  const days = [
    { label: 'Сьогодні', day: today },
    { label: 'Завтра', day: tomorrow(today) },
    { label: 'Вихідні', day: weekendDays(today)[0] ?? today },
  ];
  const [day, setDay] = useState(today);

  // createListing never rejects: a failure comes back as a result and is shown under the text.
  const publish = async () => {
    const [first = '', ...rest] = text.trim().split('\n');
    const title = first.trim();
    const description = rest.join('\n').trim();
    if (!title) {
      setError('Напиши, що плануєш: перший рядок стане заголовком.');
      return;
    }
    if (title.length > TITLE_MAX) {
      setError(`Перший рядок — це заголовок, до ${TITLE_MAX} символів. Решту почни з нового рядка.`);
      return;
    }
    if (description.length > DESCRIPTION_MAX) {
      setError(`Текст завеликий: до ${DESCRIPTION_MAX} символів після заголовка.`);
      return;
    }
    if (!categoryId) {
      setError('Обери категорію.');
      return;
    }
    setError(undefined);
    setPublishing(true);
    const result = await createListing({ categoryId, title, description, date: day, place });
    if (result.ok) {
      clearPickedPlace();
      const withPhoto = photo ? await uploadListingPhoto(result.data.id, photo) : undefined;
      setPublishing(false);
      if (withPhoto && !withPhoto.ok) onPublished(result.data, withPhoto);
      else onPublished(withPhoto?.ok ? withPhoto.data : result.data);
      return;
    }
    setPublishing(false);
    setError(publishFailure(result));
    if (result.code === 'REFERENCE_NOT_FOUND') {
      setCategoryId(undefined);
      categories.reload();
    }
  };

  return (
    <View className="flex-row items-start gap-3 px-5 py-3.5">
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
          placeholder="Що плануєш? Перший рядок стане заголовком."
          placeholderTextColor={colors.text.secondary}
          textAlignVertical="top"
          className="p-0 font-inter text-[17px] leading-6 text-text-primary"
          // Hides the browser focus ring, as in the other fields.
          style={{ outlineWidth: 0 }}
        />

        {photo && (
          <View className="overflow-hidden rounded-2xl" style={{ aspectRatio: 2 }}>
            <Picture source={{ uri: photo.picture.uri }} size={photo.picture} crop={photo.crop} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Прибрати фото"
              onPress={() => setPhoto(undefined)}
              hitSlop={8}
              className="absolute right-2 top-2 size-7 items-center justify-center rounded-full bg-[rgba(18,18,18,0.6)]"
            >
              <Icon name="close" size={14} color={colors.text['on-dark']} />
            </Pressable>
          </View>
        )}

        <View className="gap-2">
          <Text className="font-inter text-caption text-text-secondary">Коли</Text>
          <View className="flex-row flex-wrap gap-2">
            {days.map((option) => (
              <Pill
                key={option.label}
                label={option.label}
                selected={option.day === day}
                onPress={() => setDay(option.day)}
              />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="font-inter text-caption text-text-secondary">Категорія</Text>
          {categories.loading ? (
            <ActivityIndicator size="small" color={colors.brand.coral} className="self-start" />
          ) : categories.error ? (
            <Pressable accessibilityRole="button" onPress={categories.reload} className="self-start">
              <Text className="font-inter-medium text-label text-brand-coral">
                Не вдалося завантажити категорії. Спробувати ще раз
              </Text>
            </Pressable>
          ) : categories.data?.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
              {categories.data.map((category) => (
                <Pill
                  key={category.id}
                  label={category.name}
                  selected={category.id === categoryId}
                  onPress={() => setCategoryId(category.id)}
                />
              ))}
            </ScrollView>
          ) : (
            <Text className="font-inter text-caption text-text-secondary">Категорій поки немає.</Text>
          )}
        </View>

        {place ? (
          // The picked place, as the "+ Місце" chip; Figma has no frame for it, so "×" removes it as on the photo.
          <View className="flex-row items-center gap-1.5 self-start rounded-[14px] bg-surface-background py-[7px] pl-2.5 pr-2">
            <Pressable accessibilityRole="button" onPress={onAddPlace} className="flex-row items-center gap-1.5">
              <Icon name="pin" size={15} color={colors.brand.coral} />
              <Text numberOfLines={1} className="max-w-[220px] font-inter-semibold text-tag text-text-primary">
                {place.name}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Прибрати місце"
              onPress={clearPickedPlace}
              hitSlop={8}
            >
              <Icon name="close" size={14} color={colors.text.secondary} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={onAddPlace}
            className="flex-row items-center gap-1.5 self-start rounded-[14px] bg-surface-background py-[7px] pl-2.5 pr-3"
          >
            <Icon name="pin" size={15} color={colors.text.secondary} />
            <Text className="font-inter-semibold text-tag text-text-secondary">+ Місце</Text>
          </Pressable>
        )}

        {error && (
          <Text accessibilityRole="alert" className="font-inter text-caption text-brand-coral">
            {error}
          </Text>
        )}

        <View className="h-px bg-border-default" />

        <View className="flex-row items-center gap-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={photo ? 'Змінити фото' : 'Додати фото'}
            onPress={() => void pickPhoto('listingPhoto')}
            hitSlop={8}
          >
            <Icon name="gallery-edit" size={20} color={colors.brand.coral} />
          </Pressable>
          {tools.map((tool) => (
            <Icon key={tool} name={tool} size={20} color={colors.brand.coral} />
          ))}
          <View className="flex-1" />
          <Pressable
            accessibilityRole="button"
            disabled={publishing}
            // The promise comes from `publish`, which shows its own failures.
            onPress={() => void publish()}
            className={`rounded-2xl bg-brand-coral px-3.5 py-2 active:opacity-90 ${publishing ? 'opacity-60' : ''}`}
          >
            <Text className="font-inter-semibold text-button-sm text-text-on-dark">
              {publishing ? 'Публікуємо…' : 'Опублікувати'}
            </Text>
          </Pressable>
        </View>
      </View>
      {cropper}
    </View>
  );
}
