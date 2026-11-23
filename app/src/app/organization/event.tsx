// Written with the help of Claude
// AI Usage: event editor from the Figma "DО2 Організація · Нова подія" desktop frame with the DО2.1 list, after the О2
// screen reviewed by Daryna Halytska.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { createEvent, updateEvent, type Event, type EventBody } from '@/api/events';
import { deleteEventPhoto, uploadEventPhoto, type ApiEventPhoto } from '@/api/images';
import type { ApiResult } from '@/api/public-client';
import { failureMessage, pictureRefusalSnackbar } from '@/auth/messages';
import { eventFailure } from '@/components/organization/event-messages';
import { NewVenueModal } from '@/components/organization/new-venue-modal';
import { ApiPicture, Picture } from '@/components/pictures/picture';
import { usePictureCropper } from '@/components/pictures/picture-cropper';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { formatTime, kyivDay, kyivIso } from '@/dates';
import { useCategories } from '@/hooks/use-categories';
import { useEvent } from '@/hooks/use-event';
import { useMyVenues } from '@/hooks/use-my-venues';
import type { PictureDraft } from '@/pictures/picked-picture';
import { colors, shadows } from '@/styles/tokens';

// "01.2 Колонки": the 776 px form and the publishing card beside it, 24 px apart in the 1200 px column.
const FORM_COLUMN = 776;
const SIDE_COLUMN = 400;
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

// `action` is a last row that is not an item, such as "+ Додати місце"; it shows in an empty list too.
function ChoiceList({
  items,
  selected,
  status,
  emptyText,
  action,
  onSelect,
  onRetry,
}: {
  items: Item[];
  selected: string | undefined;
  status: ListStatus;
  emptyText: string;
  action?: { label: string; onPress: () => void };
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  const actionRow = action && (
    <Pressable
      accessibilityRole="button"
      onPress={action.onPress}
      className="flex-row items-center gap-3 border-t border-border-default px-4 py-[13px]"
    >
      <Text className="font-inter-medium text-body text-brand-coral">{action.label}</Text>
    </Pressable>
  );

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
        <>
          <View className="min-h-24 items-center justify-center px-4 py-3">
            <Text className="text-center font-inter text-caption text-text-secondary">{emptyText}</Text>
          </View>
          {actionRow}
        </>
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
          {actionRow}
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

// The id of a live event of О1 opens it for editing; without it the editor creates an event. With an id the form waits
// for the event, so saving never creates a new one in its place.
export default function OrganizationEventEditorScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const loaded = useEvent(id);

  if (!id) return <EventForm />;
  if (loaded.data) return <EventForm key={loaded.data.id} existing={loaded.data} />;
  if (loaded.loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.brand.coral} />
      </View>
    );
  }
  return (
    <View className="flex-1 items-center justify-center gap-4 px-5">
      <Text className="text-center font-inter-semibold text-title text-text-primary">
        {loaded.notFound ? 'Подію не знайдено' : 'Не вдалося завантажити подію'}
      </Text>
      {!loaded.notFound && <Button label="Спробувати ще раз" variant="dark" onPress={loaded.reload} />}
      <Button label="До подій" variant="light" onPress={() => router.dismissTo('/organization')} />
    </View>
  );
}

function EventForm({ existing }: Readonly<{ existing?: Event }>) {
  const router = useRouter();
  const categories = useCategories();
  // An event takes place only at one of the organization's own venues.
  const venues = useMyVenues();
  const [addingVenue, setAddingVenue] = useState(false);
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
  // Set once the event is saved: when only its cover then fails, pressing the button again saves the same event.
  const [savedId, setSavedId] = useState(existing?.id);
  // The cover the event has on the server, and the one picked or removed here, which is sent after the event.
  const [savedPhoto, setSavedPhoto] = useState<ApiEventPhoto | null>(existing?.photo ?? null);
  const [coverDraft, setCoverDraft] = useState<PictureDraft>();
  const [coverRemoved, setCoverRemoved] = useState(false);
  const { start: pickCover, cropper } = usePictureCropper(
    (_kind, draft) => {
      setCoverDraft(draft);
      setCoverRemoved(false);
      setFormError(undefined);
    },
    (refusal) => {
      const { title: refusalTitle, note } = pictureRefusalSnackbar(refusal);
      setFormError(`${refusalTitle}. ${note}.`);
    },
  );
  const shownPhoto = coverRemoved ? null : savedPhoto;

  const categoryItems: Item[] = (categories.data ?? []).map(({ id: itemId, name }) => ({ id: itemId, label: name }));
  // The edited event's venue is shown while the list loads.
  const venueList = venues.data ?? (existing ? [existing.venue] : []);
  const venueItems: Item[] = venueList.map((venue) => ({ id: venue.id, label: venue.name, note: venue.address }));

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
    const result = savedId ? await updateEvent(savedId, body) : await createEvent(body);
    if (result.ok) {
      setSavedId(result.data.id);
      const cover = await saveCover(result.data.id);
      setSaving(false);
      if (cover.ok) {
        backToEvents();
      } else {
        setFormError(`Подію збережено, але обкладинку не вдалося оновити. ${failureMessage(cover)}`);
      }
      return;
    }
    setSaving(false);
    if (result.code === 'EVENT_ENDS_BEFORE_START') {
      setEndError('Кінець має бути пізніше за початок');
    }
    setFormError(eventFailure(result));
    if (result.code === 'REFERENCE_NOT_FOUND') {
      categories.reload();
      venues.reload();
    }
  };

  // Sends the picked cover, or removes the saved one, after the event itself is saved.
  const saveCover = async (id: string): Promise<ApiResult<unknown>> => {
    if (coverDraft) {
      const uploaded = await uploadEventPhoto(id, coverDraft);
      if (uploaded.ok) {
        setSavedPhoto(uploaded.data.photo);
        setCoverDraft(undefined);
      }
      return uploaded;
    }
    if (coverRemoved && savedPhoto) {
      const removed = await deleteEventPhoto(id);
      if (removed.ok) {
        setSavedPhoto(null);
        setCoverRemoved(false);
      }
      return removed;
    }
    return { ok: true, data: undefined };
  };

  return (
    <View className="flex-1">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="px-10 pb-20 pt-12">
        <View className="w-full max-w-[1200px] gap-6 self-center">
          <View className="h-10 justify-center">
            <Text accessibilityRole="header" className="font-inter-bold text-[32px] text-text-primary">
              {existing ? 'Редагувати подію' : 'Нова подія'}
            </Text>
          </View>

          <View className="flex-row items-start gap-6">
            <View className="gap-6 rounded-[28px] bg-surface-card p-8" style={{ flex: FORM_COLUMN }}>
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
              {/* DО2 shows the date and the start; the API also needs the end, as on О2. */}
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
                    status={venues.data ? 'ready' : venues.loading ? 'loading' : venues.error ? 'error' : 'ready'}
                    emptyText="Ще немає місць. Додай перше, щоб опублікувати подію."
                    action={{ label: '+ Додати місце', onPress: () => setAddingVenue(true) }}
                    onSelect={(picked) => {
                      setVenueId(picked);
                      setOpenList(undefined);
                    }}
                    onRetry={venues.reload}
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
                  className="min-h-[120px] rounded-2xl bg-surface-background px-4 py-3.5 font-inter text-body text-text-primary"
                  // Hides the browser focus ring, as in the other fields.
                  style={{ outlineWidth: 0 }}
                />
                {shown('description') && (
                  <Text className="font-inter text-caption text-brand-coral">{shown('description')}</Text>
                )}
              </View>
            </View>

            <View className="gap-4 rounded-[28px] bg-surface-card p-6" style={{ flex: SIDE_COLUMN }}>
              {/* The cover is cut to the catalog card's 2:1, which the preview shows. */}
              {coverDraft || shownPhoto ? (
                <View className="overflow-hidden rounded-[22px] bg-surface-background" style={{ aspectRatio: 2 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Змінити обкладинку"
                    onPress={() => void pickCover('eventPhoto')}
                    className="flex-1"
                  >
                    {coverDraft ? (
                      <Picture
                        source={{ uri: coverDraft.picture.uri }}
                        size={coverDraft.picture}
                        crop={coverDraft.crop}
                      />
                    ) : (
                      shownPhoto && <ApiPicture image={shownPhoto} />
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Прибрати обкладинку"
                    onPress={() => {
                      setCoverDraft(undefined);
                      setCoverRemoved(true);
                    }}
                    hitSlop={8}
                    className="absolute right-3 top-3 size-7 items-center justify-center rounded-full bg-[rgba(18,18,18,0.6)]"
                  >
                    <Icon name="close" size={14} color={colors.text['on-dark']} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Додати обкладинку"
                  onPress={() => void pickCover('eventPhoto')}
                  className="items-center justify-center gap-2 rounded-[22px] border-[1.5px] border-dashed border-border-default bg-surface-background py-3 hover:border-text-secondary"
                >
                  <View className="size-12 items-center justify-center rounded-2xl bg-surface-card">
                    <Icon name="gallery-edit" size={24} color={colors.brand.coral} />
                  </View>
                  <Text className="font-inter-medium text-label text-text-primary">Додати обкладинку</Text>
                  <Text className="font-inter text-caption text-text-secondary">
                    JPG або PNG, від 1200 px завширшки
                  </Text>
                </Pressable>
              )}

              {formError && (
                <Text accessibilityRole="alert" className="text-center font-inter text-caption text-brand-coral">
                  {formError}
                </Text>
              )}
              <Button
                label={savedId ? 'Зберегти зміни' : 'Опублікувати подію'}
                variant="dark"
                loading={saving}
                // The promise comes from `submit`, which shows its own failures.
                onPress={() => void submit()}
              />
              {/* "Чернетка" returns to DО1: there are no drafts in the API. */}
              <Pressable
                accessibilityRole="button"
                onPress={backToEvents}
                className="h-12 items-center justify-center rounded-[26px] bg-[rgba(0,0,0,0.05)] hover:bg-[rgba(0,0,0,0.08)]"
              >
                <Text className="font-inter-medium text-label text-text-primary">
                  {existing ? 'До подій' : 'Чернетка'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {cropper}
      <NewVenueModal
        visible={addingVenue}
        onClose={() => setAddingVenue(false)}
        onCreated={(venue) => {
          venues.setData([...venueList, venue].sort((a, b) => a.name.localeCompare(b.name, 'uk')));
          setVenueId(venue.id);
          setOpenList(undefined);
          setAddingVenue(false);
        }}
      />
    </View>
  );
}
