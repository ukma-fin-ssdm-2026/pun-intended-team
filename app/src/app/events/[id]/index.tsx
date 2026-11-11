// Written with the help of Claude
// AI Usage: event page from the Figma "02 Сторінка події", "02.1 · Ти вже в пошуку" and "02.2 · гість" screens, on mock
// data; reviewed by Daryna Halytska.
import { BlurTargetView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { applyToEvent, changeAnswers, type ApplicationAnswers } from '@/api/applications';
import { failureSnackbar } from '@/auth/messages';
import { GuestDialog } from '@/components/guest-dialog';
import { CompanyRequestSheet } from '@/components/matching/company-request-sheet';
import { DayPickerSheet } from '@/components/matching/day-picker-sheet';
import { ProfileIncompleteDialog } from '@/components/matching/profile-incomplete-dialog';
import { Button } from '@/components/ui/button';
import { coverOf, EventCover } from '@/components/ui/event-cover';
import { Glass } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/icon';
import { Snackbar, useSnackbar, type SnackbarContent } from '@/components/ui/snackbar';
import { eventSessions, formatEventDay, formatShortDay, formatTimeRange, kyivDay, sessionCutoff } from '@/dates';
import { useEventApplication } from '@/hooks/use-applications';
import { useEvent } from '@/hooks/use-event';
import { useProfile } from '@/hooks/use-profile';
import { plural } from '@/plural';
import { openSessions } from '@/state/applications';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { toggleFavorite, useFavorite } from '@/state/favorites';
import { useSession } from '@/state/session';
import { colors } from '@/styles/tokens';

// "01.1 Верхні дії" sits at y=56 in the iPhone 14 frame, 9 px below its 47 px status bar. A taller status bar keeps that
// gap; without one (the web) the buttons stay at 56 px, as in Figma.
const TOP_ACTIONS_Y = 56;
const GAP_BELOW_STATUS_BAR = 9;
// "02 Деталі" starts at y=312, overlapping the 340 px cover by 28 px.
const SHEET_OVERLAP = 28;
// "03 Дія": padding 16 / 20 / 34 / 20 around the 52 px button; a larger bottom inset replaces the 34 px.
const ACTION_BAR_TOP = 16;
const ACTION_BAR_BOTTOM = 34;
const BUTTON_HEIGHT = 52;
// Longer descriptions are cut at the last word within 105 characters and end with "… Читати далі", which gives the
// Figma text for the jazz evening.
const DESCRIPTION_PREVIEW = 105;

// Figma's first choice on 03: company for the evening, then a walk and coffee. The profile's format replaces the first.
const FIGMA_ANSWERS: ApplicationAnswers = { desiredCompany: 'company', afterEventPlans: ['walk', 'coffee'] };

// What the API refuses an application for, besides an incomplete profile and an application that already exists.
const refusals: Record<string, SnackbarContent> = {
  APPLICATIONS_CLOSED: {
    tone: 'error',
    title: 'Підбір на цю подію закрито',
    note: 'Подія вже почалася або скоро завершиться',
  },
  EVENT_CANCELLED: { tone: 'error', title: 'Подію скасовано', note: 'Обери іншу подію в каталозі' },
  INVALID_SESSION_DAY: { tone: 'error', title: 'Цього дня подія не проходить', note: 'Обери інший день' },
  NOT_FOUND: { tone: 'error', title: 'Подію не знайдено', note: 'Можливо, її прибрали з каталогу' },
};

const CHANGE_FAILED: SnackbarContent = {
  tone: 'error',
  title: 'Не вдалося оновити побажання',
  note: 'Спробуй ще раз за хвилину',
};

// "Сб, 24 жовт" for one day, "3 дні" for several.
function daysLabel(starts: string[], eventStart: string): string {
  if (starts.length > 1) return `${starts.length} ${plural(starts.length, ['день', 'дні', 'днів'])}`;
  return formatShortDay(starts[0] ?? eventStart);
}

// The sessions that still take applications, for the day picker.
function stillOpen(sessions: string[], startsAt: string, endsAt: string): string[] {
  const now = Date.now();
  return sessions.filter((start) => sessionCutoff(startsAt, endsAt, start) > now);
}

function preview(text: string): string | undefined {
  if (text.length <= DESCRIPTION_PREVIEW) return undefined;
  const cut = text.slice(0, DESCRIPTION_PREVIEW);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,.:;—-]+$/, '');
}

function GlassButton({
  icon,
  label,
  onPress,
  active,
  blurTarget,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  blurTarget: RefObject<View | null>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      onPress={onPress}
      className="active:opacity-80"
    >
      <Glass
        className="size-10 items-center justify-center"
        radius={20}
        fill="rgba(255, 255, 255, 0.22)"
        border="rgba(255, 255, 255, 0.35)"
        tone="light"
        blurTarget={blurTarget}
      >
        <Icon name={icon} size={20} color={active ? colors.brand.coral : colors.text['on-dark']} filled={active} />
      </Glass>
    </Pressable>
  );
}

function DetailRow({
  icon,
  value,
  note,
  onPress,
}: {
  icon: IconName;
  value: string;
  note: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="flex-row items-center gap-3.5 py-3.5"
    >
      <View className="size-10 items-center justify-center rounded-xl bg-surface-card">
        <Icon name={icon} size={20} color={colors.brand.coral} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-medium text-body text-text-primary">{value}</Text>
        <Text className="font-inter text-caption text-text-secondary">{note}</Text>
      </View>
    </Pressable>
  );
}

// Darkens the top of the cover so the white buttons and the status bar stay readable on light images.
function TopShade() {
  return (
    <Svg width="100%" height={140} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      <Defs>
        <LinearGradient id="event-top-shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset={0} stopColor="#000" stopOpacity={0.35} />
          <Stop offset={1} stopColor="#000" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#event-top-shade)" />
    </Svg>
  );
}

export default function EventScreen() {
  // `request` comes from "Змінити побажання" on 04.1, which opens 03 over the page.
  const { id, request } = useLocalSearchParams<{ id: string; request?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { isGuest } = session;
  // A guest sees the page under the sign-in dialog; closing the dialog leaves the page, as in the prototype.
  const [dialogOpen, setDialogOpen] = useState(isGuest);
  const favorite = useFavorite(id);
  const [expanded, setExpanded] = useState(false);
  const profile = useProfile();
  const { application, reload: reloadApplications } = useEventApplication(id);
  // A multi-day event asks for the days first, then opens 03 for them.
  const [step, setStep] = useState<'day' | 'request' | null>(null);
  // The days picked for a multi-day event; none for a single-day one.
  const [sessionStarts, setSessionStarts] = useState<string[]>([]);
  // Each opening of 03 starts from fresh answers.
  const [requestKey, setRequestKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const { snackbar, show } = useSnackbar();
  const openRequest = () => {
    setRequestKey((key) => key + 1);
    setStep('request');
  };
  const closeSteps = () => {
    setStep(null);
    if (request) router.setParams({ request: undefined });
  };
  const coverRef = useRef<View>(null);
  useStatusBarStyle('light');

  const { data: liveEvent, loading, error, notFound, reload } = useEvent(id);
  // Temporary: the screens still on mocks (map, matches, saved events, notifications) open mock events, which the API
  // does not know. Remove the fallback when those screens move to the API.
  const mockEvent = liveEvent ? undefined : findMockEvent(id);
  const event = liveEvent ?? mockEvent;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-background">
        <ActivityIndicator size="large" color={colors.brand.coral} />
      </View>
    );
  }

  if (!event) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-surface-background px-5">
        <Text className="text-center font-inter-semibold text-title text-text-primary">
          {notFound || !error ? 'Подію не знайдено' : 'Не вдалося завантажити подію'}
        </Text>
        {!notFound && error && <Button label="Спробувати ще раз" variant="dark" onPress={reload} />}
        <Button label="До каталогу" variant="light" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const inPool = !isGuest && application !== undefined;
  const sessions = eventSessions(event.startsAt, event.endsAt);
  const multiDay = sessions.length > 1;
  // "Змінити побажання" on 04.1 comes back with `request`: the days first for a multi-day event, then 03.
  const changing = request === '1' && step === null;
  const dayOpen = step === 'day' || (changing && multiDay);
  const requestOpen = step === 'request' || (changing && !multiDay);
  const pickable = dayOpen ? stillOpen(sessions, event.startsAt, event.endsAt) : [];
  const alreadyPicked = application
    ? pickable.filter((start) =>
        application.sessions.some(({ startsAt }) => Date.parse(startsAt) === Date.parse(start)),
      )
    : [];
  const profileIncomplete = profile.missing || profile.data?.isComplete === false;
  // With an application, 03 changes its answers; otherwise the format comes from the profile.
  const initialAnswers: ApplicationAnswers = application
    ? { desiredCompany: application.desiredCompany, afterEventPlans: application.afterEventPlans }
    : { ...FIGMA_ANSWERS, desiredCompany: profile.data?.communicationFormat ?? FIGMA_ANSWERS.desiredCompany };
  const short = expanded ? undefined : preview(event.description);
  const bottomPadding = Math.max(ACTION_BAR_BOTTOM, insets.bottom);
  // 130 px in Figma: the 102 px action bar and the 28 px overlap.
  const sheetBottomPadding = ACTION_BAR_TOP + BUTTON_HEIGHT + bottomPadding + SHEET_OVERLAP;

  const openSearch = () => router.push({ pathname: '/events/[id]/search', params: { id: event.id } });

  const onAction = () => {
    if (isGuest) setDialogOpen(true);
    else if (inPool) openSearch();
    else if (profileIncomplete) setProfileDialogOpen(true);
    else if (multiDay) setStep('day');
    else {
      setSessionStarts([]);
      openRequest();
    }
  };

  const completeProfile = () => {
    setProfileDialogOpen(false);
    router.push(profile.missing ? '/profile-setup' : '/profile-edit');
  };

  const submit = async (answers: ApplicationAnswers) => {
    setSubmitting(true);
    const dates = sessionStarts.map((start) => kyivDay(new Date(start)));
    const result = application
      ? await changeAnswers(application, answers, { dates: dates.length > 0 ? dates : undefined })
      : await applyToEvent(event.id, answers, dates);
    setSubmitting(false);
    closeSteps();
    if (result.ok) {
      openSearch();
    } else if (result.code === 'ALREADY_APPLIED') {
      reloadApplications();
      openSearch();
    } else if (result.code === 'PROFILE_INCOMPLETE') {
      profile.reload();
      setProfileDialogOpen(true);
    } else {
      show((result.code && refusals[result.code]) || (application ? CHANGE_FAILED : failureSnackbar(result)));
    }
  };

  return (
    <View className="flex-1 bg-surface-background">
      <ScrollView>
        <View className="h-[340px] overflow-hidden">
          {/* What the glass buttons blur on Android; the buttons themselves stay outside. */}
          <BlurTargetView ref={coverRef} style={StyleSheet.absoluteFill}>
            {/* An imported event links its provider's image; a mock event has a bundled one. */}
            <EventCover cover={mockEvent?.cover ?? coverOf(liveEvent?.imageUrl)} />
            <TopShade />
          </BlurTargetView>
          <View
            className="absolute left-5 right-5 flex-row items-center justify-between"
            style={{ top: Math.max(TOP_ACTIONS_Y, insets.top + GAP_BELOW_STATUS_BAR) }}
          >
            <GlassButton icon="arrow-left" label="Назад" onPress={goBack} blurTarget={coverRef} />
            <GlassButton
              icon="heart"
              label="В обране"
              active={favorite}
              onPress={() => toggleFavorite(id)}
              blurTarget={coverRef}
            />
          </View>
        </View>

        <View
          className="gap-5 rounded-t-[28px] bg-surface-card px-5 pt-3"
          style={{ marginTop: -SHEET_OVERLAP, paddingBottom: sheetBottomPadding }}
        >
          <View className="items-center">
            <View className="h-1 w-10 rounded-sm bg-border-default" />
          </View>

          {/* Figma fixes this block at 84 px: a two-line title runs 11 px into the gap below, so the next block starts
              where it does in the frame. */}
          <View className="h-[84px] items-start gap-2.5">
            <View className="rounded-2xl bg-brand-coral px-3.5 py-[7px]">
              <Text className="font-inter-semibold text-button-sm text-text-on-dark">{event.category.name}</Text>
            </View>
            <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-primary">
              {event.title}
            </Text>
          </View>

          <View className="gap-2">
            <Text className="font-inter-semibold text-title text-text-primary">Про подію</Text>
            <Text className="font-inter text-caption leading-5 text-text-secondary">
              {short ? `${short}… ` : event.description}
              {short && (
                <Text accessibilityRole="button" className="text-brand-coral" onPress={() => setExpanded(true)}>
                  Читати далі
                </Text>
              )}
            </Text>
          </View>

          <View className="rounded-[20px] bg-surface-background px-4 py-1">
            <DetailRow
              icon="pin"
              value={event.venue.name}
              note={[event.venue.address, mockEvent?.district].filter(Boolean).join(' · ')}
              // Like the map preview; the map is a static picture of Figma's Т1, so it cannot centre on the venue.
              onPress={() => router.navigate('/map')}
            />
            <View className="h-px bg-border-default" />
            <DetailRow
              icon="calendar"
              value={formatEventDay(event.startsAt)}
              note={formatTimeRange(event.startsAt, event.endsAt)}
            />
            {/* The API has no organizer name yet; only mock events have one. */}
            {mockEvent && (
              <>
                <View className="h-px bg-border-default" />
                <DetailRow
                  icon="building"
                  value={mockEvent.organizer}
                  note="Організатор події"
                  onPress={() => router.push('/organizer')}
                />
              </>
            )}
          </View>

          <View className="gap-3">
            <Text className="font-inter-semibold text-title text-text-primary">На мапі</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Показати на мапі"
              onPress={() => router.navigate('/map')}
              className="h-[140px] items-center justify-center rounded-[18px] bg-[#ECECE7] active:opacity-90"
            >
              <View className="size-10 items-center justify-center rounded-full bg-brand-coral">
                <Icon name="pin" size={20} color={colors.text['on-dark']} />
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 items-center bg-surface-card px-5"
        style={{ paddingTop: ACTION_BAR_TOP, paddingBottom: bottomPadding }}
      >
        <Button label={inPool ? 'Стежити за метчингом' : 'Знайти мені метч'} variant="dark" onPress={onAction} />
      </View>

      <DayPickerSheet
        key={`days-${dayOpen}`}
        visible={dayOpen}
        onClose={closeSteps}
        eventTitle={event.title}
        sessions={pickable}
        initial={alreadyPicked}
        onPick={(starts) => {
          setSessionStarts(starts);
          openRequest();
        }}
      />

      <CompanyRequestSheet
        key={`request-${requestKey}-${application?.id ?? 'new'}-${profile.data ? 'profile' : 'none'}`}
        visible={requestOpen}
        onClose={closeSteps}
        eventLabel={`${event.title} · ${daysLabel(
          sessionStarts.length > 0
            ? sessionStarts
            : (application ? openSessions(application) : []).map(({ startsAt }) => startsAt),
          event.startsAt,
        )}`}
        initial={initialAnswers}
        submitLabel={application ? 'Оновити побажання' : undefined}
        submitting={submitting}
        onSubmit={(answers) => void submit(answers)}
      />

      <ProfileIncompleteDialog
        visible={profileDialogOpen}
        onClose={() => setProfileDialogOpen(false)}
        onComplete={completeProfile}
      />

      <GuestDialog
        visible={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          goBack();
        }}
        onLeave={() => setDialogOpen(false)}
      />

      {snackbar && <Snackbar {...snackbar} />}
    </View>
  );
}
