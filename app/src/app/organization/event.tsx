// Written with the help of Claude
// AI Usage: event editor from the Figma "О2 Організація · Нова подія" frame; reviewed by Daryna Halytska.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createEvent, updateEvent, type EventBody } from '@/api/events';
import { eventFailure } from '@/components/organization/event-messages';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { formatTime, kyivDay, kyivIso } from '@/dates';
import { useCategories } from '@/hooks/use-categories';
import { useEvents } from '@/hooks/use-events';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { rememberOwnEvent, useOwnEvents } from '@/state/organization-events';
import { colors, shadows } from '@/styles/tokens';

// "01 Навігація" starts 56 px from the top (9 px below the iPhone 14 status bar); "03 Дія" has a 34 px bottom padding.
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const ACTION_BOTTOM = 34;
// "Список категорій" opens 6 px under the field (18 px label, 6 px gap, 52 px field) and shows four and a half rows.
const LIST_TOP = 18 + 6 + 52 + 6;
// The list is as tall as its items, up to four and a half rows; longer lists scroll.
const LIST_MAX_HEIGHT = 232;
// The API's limits.
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 5000;

type Item = { id: string; label: string; note?: string };

// What the list shows while its items load or when it cannot get them; an empty list explains itself in `emptyText`.
type ListStatus = 'loading' | 'error' | 'ready';

function ChoiceList({
  items,
  selected,
  status,
  emptyText,
  onSelect,
  onRetry,
}: {
  items: Item[];
  selected: string | undefined;
  status: ListStatus;
  emptyText: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  return (
    <View
      className="absolute left-0 right-0 overflow-hidden rounded-[18px] bg-surface-card"
      style={{ top: LIST_TOP, maxHeight: LIST_MAX_HEIGHT, boxShadow: shadows.medium, elevation: 8 }}
    >
      {status === 'loading' ? (
        <View className="min-h-24 items-center justify-center">
          <ActivityIndicator size="small" color={colors.brand.coral} />
        </View>
      ) : status === 'error' ? (
        <Pressable accessibilityRole="button" onPress={onRetry} className="min-h-24 items-center justify-center px-4">
          <Text className="text-center font-inter-medium text-label text-brand-coral">
            Не вдалося завантажити. Спробувати ще раз
          </Text>
        </Pressable>
      ) : items.length === 0 ? (
        <View className="min-h-24 items-center justify-center px-4 py-3">
          <Text className="text-center font-inter text-caption text-text-secondary">{emptyText}</Text>
        </View>
      ) : (
        <ScrollView nestedScrollEnabled className="shrink" contentContainerClassName="py-1">
          {items.map((item) => {
            const isSelected = item.id === selected;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isSelected }}
                onPress={() => onSelect(item.id)}
                className="flex-row items-center gap-3 px-4 py-[13px]"
              >
                <View className="flex-1">
                  <Text
                    className={`text-body ${isSelected ? 'font-inter-medium text-brand-coral' : 'font-inter text-text-primary'}`}
                  >
                    {item.label}
                  </Text>
                  {item.note && <Text className="font-inter text-caption text-text-secondary">{item.note}</Text>}
                </View>
                {isSelected && <Icon name="toast-check" size={18} color={colors.brand.coral} />}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

// "21.10.2026" is the day in Figma's field; the API wants "2026-10-21". Undefined when it is not a real day.
function parseDay(text: string): string | undefined {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text.trim());
  if (!match) return undefined;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? `${year}-${twoDigits(month)}-${twoDigits(day)}` : undefined;
}

function displayDay(day: string): string {
  const [year, month, date] = day.split('-');
  return `${date}.${month}.${year}`;
}

// "9:30" or "09:30" as "09:30"; undefined when it is not a time of day.
function parseTime(text: string): string | undefined {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text.trim());
  return match ? `${twoDigits(Number(match[1]))}:${match[2]}` : undefined;
}

export default function OrganizationEventEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The id of a live event of О1 opens it for editing; without it the editor creates an event.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useOwnEvents().find((event) => event.id === id);
  const categories = useCategories();
  // The API has no list of venues. The venues of the catalog's events are the places to choose from, and it accepts
  // only the organization's own.
  const catalog = useEvents();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [categoryId, setCategoryId] = useState(existing?.category.id);
  const [venueId, setVenueId] = useState(existing?.venue.id);
  // О2.1: the field opens its list in place; picking an item closes it.
  const [openList, setOpenList] = useState<'category' | 'venue'>();
  const [date, setDate] = useState(existing ? displayDay(kyivDay(new Date(existing.startsAt))) : '');
  const [start, setStart] = useState(existing ? formatTime(existing.startsAt) : '');
  const [end, setEnd] = useState(existing ? formatTime(existing.endsAt) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [endError, setEndError] = useState<string>();
  useStatusBarStyle('dark');

  const categoryItems: Item[] = (categories.data ?? []).map(({ id: itemId, name }) => ({ id: itemId, label: name }));
  const venues = new Map(
    [...(existing ? [existing.venue] : []), ...(catalog.data ?? []).map((event) => event.venue)].map((venue) => [
      venue.id,
      venue,
    ]),
  );
  const venueItems: Item[] = [...venues.values()].map((venue) => ({
    id: venue.id,
    label: venue.name,
    note: venue.address,
  }));

  const day = parseDay(date);
  const startTime = parseTime(start);
  const endTime = parseTime(end);
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const errors = {
    title: !trimmedTitle ? 'Додай назву' : trimmedTitle.length > TITLE_MAX ? `До ${TITLE_MAX} символів` : undefined,
    category: categoryId ? undefined : 'Обери категорію',
    date: day ? undefined : 'Дата виду 21.10.2026',
    start: startTime ? undefined : 'Час виду 19:00',
    end: endTime ? undefined : 'Час виду 21:00',
    place: venueId ? undefined : 'Обери місце',
    description: !trimmedDescription
      ? 'Додай опис'
      : trimmedDescription.length > DESCRIPTION_MAX
        ? `До ${DESCRIPTION_MAX} символів`
        : undefined,
  };
  const shown = <K extends keyof typeof errors>(field: K) => (submitted ? errors[field] : undefined);

  // "Чернетка" and a saved event both return to О1; there are no drafts in the API.
  const backToEvents = () => router.dismissTo('/organization');
  const toggleList = (list: 'category' | 'venue') => setOpenList(openList === list ? undefined : list);

  // createEvent and updateEvent never reject: a failure comes back as a result and is shown above the button.
  const submit = async () => {
    setSubmitted(true);
    setFormError(undefined);
    setEndError(undefined);
    if (!day || !startTime || !endTime || !categoryId || !venueId) return;
    if (Object.values(errors).some(Boolean)) return;
    const body: EventBody = {
      title: trimmedTitle,
      description: trimmedDescription,
      categoryId,
      venueId,
      startsAt: kyivIso(day, startTime),
      endsAt: kyivIso(day, endTime),
    };
    setSaving(true);
    const result = existing ? await updateEvent(existing.id, body) : await createEvent(body);
    setSaving(false);
    if (result.ok) {
      rememberOwnEvent(result.data);
      backToEvents();
      return;
    }
    if (result.code === 'EVENT_ENDS_BEFORE_START') {
      setEndError('Кінець має бути пізніше за початок');
    }
    setFormError(eventFailure(result));
    if (result.code === 'REFERENCE_NOT_FOUND') {
      categories.reload();
      catalog.reload();
    }
  };

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
          {existing ? 'Редагувати подію' : 'Нова подія'}
        </Text>
        {existing ? (
          <View className="w-[70px]" />
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Зберегти чернетку" onPress={backToEvents}>
            <Text className="font-inter-medium text-label text-text-secondary">Чернетка</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 pb-[120px] pt-2"
        keyboardShouldPersistTaps="handled"
      >
        {/* The API has no cover images yet, so this only shows the design. */}
        <View className="h-[140px] items-center justify-center gap-2 rounded-[22px] border-[1.5px] border-dashed border-border-default bg-surface-background">
          <View className="size-12 items-center justify-center rounded-2xl bg-surface-card">
            <Icon name="gallery-edit" size={24} color={colors.brand.coral} />
          </View>
          <Text className="font-inter-medium text-label text-text-primary">Додати обкладинку</Text>
          <Text className="font-inter text-caption text-text-secondary">JPG або PNG, від 1200 px завширшки</Text>
        </View>

        <TextField label="Назва" required value={title} onChangeText={setTitle} error={shown('title')} />
        {/* Each list lies over the fields after it, so an earlier field has the higher z-index. */}
        <View className="z-30">
          <TextField
            label="Категорія"
            required
            value={categoryItems.find((item) => item.id === categoryId)?.label ?? existing?.category.name ?? ''}
            placeholder="Обери категорію"
            error={shown('category')}
            list={{ open: openList === 'category', onPress: () => toggleList('category') }}
          />
          {openList === 'category' && (
            <ChoiceList
              items={categoryItems}
              selected={categoryId}
              status={categories.loading ? 'loading' : categories.error ? 'error' : 'ready'}
              emptyText="Категорій поки немає."
              onSelect={(picked) => {
                setCategoryId(picked);
                setOpenList(undefined);
              }}
              onRetry={categories.reload}
            />
          )}
        </View>
        <View className="flex-row gap-2.5">
          <View className="flex-1">
            <TextField
              label="Дата"
              required
              value={date}
              onChangeText={setDate}
              placeholder="21.10.2026"
              keyboardType="numbers-and-punctuation"
              error={shown('date')}
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Початок"
              required
              value={start}
              onChangeText={setStart}
              placeholder="19:00"
              keyboardType="numbers-and-punctuation"
              error={shown('start')}
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Кінець"
              required
              value={end}
              onChangeText={setEnd}
              placeholder="21:00"
              keyboardType="numbers-and-punctuation"
              error={endError ?? shown('end')}
            />
          </View>
        </View>
        <View className="z-20">
          <TextField
            label="Місце"
            required
            value={venueItems.find((item) => item.id === venueId)?.label ?? ''}
            placeholder="Обери місце"
            error={shown('place')}
            list={{ open: openList === 'venue', onPress: () => toggleList('venue') }}
          />
          {openList === 'venue' && (
            <ChoiceList
              items={venueItems}
              selected={venueId}
              status={
                catalog.loading && venueItems.length === 0
                  ? 'loading'
                  : catalog.error && venueItems.length === 0
                    ? 'error'
                    : 'ready'
              }
              emptyText="Місця беруться з подій каталогу. Поки там немає подій, обрати місце не можна."
              onSelect={(picked) => {
                setVenueId(picked);
                setOpenList(undefined);
              }}
              onRetry={catalog.reload}
            />
          )}
        </View>
        <View className="gap-1.5">
          <Text className="font-inter text-caption text-text-secondary">
            Опис <Text className="text-brand-coral">*</Text>
          </Text>
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
          {shown('description') && (
            <Text className="font-inter text-caption text-brand-coral">{shown('description')}</Text>
          )}
        </View>
      </ScrollView>

      <View
        className="gap-3 bg-surface-card px-5 pt-4"
        style={{ paddingBottom: Math.max(ACTION_BOTTOM, insets.bottom) }}
      >
        {formError && (
          <Text accessibilityRole="alert" className="text-center font-inter text-caption text-brand-coral">
            {formError}
          </Text>
        )}
        <Button
          label={existing ? 'Зберегти зміни' : 'Опублікувати подію'}
          variant="dark"
          loading={saving}
          // The promise comes from `submit`, which shows its own failures.
          onPress={() => void submit()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
