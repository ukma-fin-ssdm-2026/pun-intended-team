// Written with the help of Claude
// AI Usage: event page from the Figma "02 Сторінка події", "02.1 · Ти вже в пошуку" and "02.2 · гість" screens;
// reviewed by Daryna Halytska.
import { BlurTargetView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { applyToEvent, changeAnswers, type ApplicationAnswers } from '@/api/applications';
import { failureSnackbar } from '@/auth/messages';
import { GuestDialog } from '@/components/guest-dialog';
import { CompanyRequestSheet } from '@/components/matching/company-request-sheet';
import { DayPickerSheet } from '@/components/matching/day-picker-sheet';
import { actionBarReach, MatchActionBar } from '@/components/matching/match-action-bar';
import { ProfileIncompleteDialog } from '@/components/matching/profile-incomplete-dialog';
import { Button } from '@/components/ui/button';
import { coverOf, EventCover } from '@/components/ui/event-cover';
import { Glass } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/icon';
import { PriceBadge } from '@/components/ui/overlay-badge';
import { Snackbar, useSnackbar, type SnackbarContent } from '@/components/ui/snackbar';
import { eventSessions, formatEventDay, formatShortDay, formatTimeRange, kyivDay, pickableSessions } from '@/dates';
import { useEventApplication } from '@/hooks/use-applications';
import { useApplicationMatch } from '@/hooks/use-matches';
import { useEvent } from '@/hooks/use-event';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useProfile } from '@/hooks/use-profile';
import { plural } from '@/plural';
import { priceLabel } from '@/price';
import { openSessions } from '@/state/applications';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { toggleFavorite, useFavorite } from '@/state/favorites';
import { matchHref } from '@/state/matches';
import { useSession } from '@/state/session';
import { colors, desktop, shadows } from '@/styles/tokens';

// "01.1 Верхні дії" sits at y=56 in the iPhone 14 frame, 9 px below its 47 px status bar. A taller status bar keeps that
// gap; without one (the web) the buttons stay at 56 px, as in Figma.
const TOP_ACTIONS_Y = 56;
const GAP_BELOW_STATUS_BAR = 9;
// "02 Деталі" starts at y=312, overlapping the 340 px cover by 28 px.
const COVER_HEIGHT = 340;
const SHEET_OVERLAP = 28;
const GLASS_BUTTON_SIZE = 40;
// Scrolled up, the sheet stops this far below the buttons, so they always stand on the cover.
const SHEET_GAP_BELOW_ACTIONS = 12;
// The sheet's content ends this far above the button of the action bar.
const GAP_ABOVE_ACTION = 28;
// Longer descriptions are cut at the last word within 105 characters and end with "… Читати далі", which gives the
// Figma text for the jazz evening.
const DESCRIPTION_PREVIEW = 105;

// Figma's first choice on 03: company for the evening, then a walk and coffee, with anyone of any age. The profile's
// format replaces the first.
const FIGMA_ANSWERS: ApplicationAnswers = {
  desiredCompany: 'company',
  afterEventPlans: ['walk', 'coffee'],
  preferredGender: 'any',
  ageMin: 18,
  ageMax: null,
};

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
      {/* Dark glass, as the badges on the event card, so the white icon shows on a white cover too. */}
      <Glass
        className="size-10 items-center justify-center"
        radius={20}
        fill="rgba(18, 18, 18, 0.45)"
        tone="dark"
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
  note?: string;
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
        {note ? <Text className="font-inter text-caption text-text-secondary">{note}</Text> : null}
      </View>
    </Pressable>
  );
}

// Darkens the top of the cover so the white buttons and the status bar stay readable on light images.
function TopShade() {
  return (
    <Svg width="100%" height={140} pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0 }}>
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
  // A paired application has a proposal or a mutual match; the button opens it instead of the search screen.
  const { match } = useApplicationMatch(application?.id);
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
  const isDesktop = useIsDesktop();
  useStatusBarStyle('light');

  const { data: event, loading, error, notFound, reload } = useEvent(id);
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
  // A run of shows until May offers only the days of the coming four weeks, as the API takes them.
  const pickable = dayOpen ? pickableSessions(event.startsAt, event.endsAt) : [];
  const alreadyPicked = application
    ? pickable.filter((start) =>
        application.sessions.some(({ startsAt }) => Date.parse(startsAt) === Date.parse(start)),
      )
    : [];
  const profileIncomplete = profile.missing || profile.data?.isComplete === false;
  // With an application, 03 changes its answers; otherwise the format comes from the profile.
  const initialAnswers: ApplicationAnswers = application
    ? {
        desiredCompany: application.desiredCompany,
        afterEventPlans: application.afterEventPlans,
        preferredGender: application.preferredGender,
        ageMin: application.ageMin,
        ageMax: application.ageMax,
      }
    : { ...FIGMA_ANSWERS, desiredCompany: profile.data?.communicationFormat ?? FIGMA_ANSWERS.desiredCompany };
  // Organization events have no provider page.
  const sourceUrl = event.sourceUrl;
  const price = priceLabel(event.priceMin, event.priceMax);
  const cut = preview(event.description);
  const short = expanded ? undefined : cut;
  const actionsTop = Math.max(TOP_ACTIONS_Y, insets.top + GAP_BELOW_STATUS_BAR);
  const sheetStop = actionsTop + GLASS_BUTTON_SIZE + SHEET_GAP_BELOW_ACTIONS;
  const sheetBottomPadding = actionBarReach(insets.bottom) + GAP_ABOVE_ACTION;

  const openSearch = () => router.push({ pathname: '/events/[id]/search', params: { id: event.id } });

  const onAction = () => {
    if (isGuest) setDialogOpen(true);
    else if (match) router.push(matchHref(match));
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

  const actionLabel = match
    ? 'Відкрити метч'
    : application?.status === 'no_match'
      ? 'Результат підбору'
      : inPool
        ? 'Стежити за метчингом'
        : 'Знайти метч';

  const titleBlock = (
    <>
      {/* "02.1 Назва і категорія": as tall as its content, so a title of one, two or three lines is followed by the
        sheet's 20 px gap to "Про подію"; the chips and the title are 10 px apart. */}
      <View className="items-start gap-2.5">
        <View className="flex-row items-center gap-2.5">
          <View className="rounded-2xl bg-brand-coral px-3.5 py-[7px]">
            <Text className="font-inter-semibold text-button-sm text-text-on-dark">{event.category.name}</Text>
          </View>
          {/* "квитки та деталі": an imported event links its page on ArtWizard or Karabas, where tickets are
            sold. */}
          {sourceUrl && (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Квитки та деталі"
              onPress={() => void Linking.openURL(sourceUrl)}
              className="flex-row items-center gap-1.5 rounded-2xl bg-brand-coral-soft px-3.5 py-[7px] active:opacity-80"
            >
              <Text className="font-inter-semibold text-button-sm text-brand-coral-dark">Квитки та деталі</Text>
              <Icon name="square-top-down" size={14} color={colors.brand['coral-dark']} />
            </Pressable>
          )}
        </View>
        <Text
          accessibilityRole="header"
          className={`font-inter-bold text-text-primary ${isDesktop ? 'text-desktop-h1' : 'text-h1'}`}
        >
          {event.title}
        </Text>
      </View>
    </>
  );

  const aboutBlock = (
    <>
      <View className="gap-2">
        <Text className="font-inter-semibold text-title text-text-primary">Про подію</Text>
        <Text className="font-inter text-caption leading-5 text-text-secondary">
          {short ? `${short}… ` : event.description}
          {short && (
            <Text accessibilityRole="button" className="text-brand-coral" onPress={() => setExpanded(true)}>
              Читати далі
            </Text>
          )}
          {/* Only a text long enough to be cut collapses back to its preview. */}
          {expanded && cut && (
            <>
              {' '}
              <Text accessibilityRole="button" className="text-brand-coral" onPress={() => setExpanded(false)}>
                Читати менше
              </Text>
            </>
          )}
        </Text>
      </View>
    </>
  );

  const detailsBlock = (
    <>
      <View className="rounded-[20px] bg-surface-background px-4 py-1">
        <DetailRow
          icon="pin"
          value={event.venue.name}
          note={event.venue.address}
          // Like the map preview; the map is a static picture of Figma's Т1, so it cannot centre on the venue.
          onPress={() => router.navigate('/map')}
        />
        <View className="h-px bg-border-default" />
        <DetailRow icon="calendar" value={formatEventDay(event.startsAt)} note={formatTimeRange(event)} />
        {/* Only an organization's event has an organizer; an imported one has its provider's page instead. */}
        {event.organizer && (
          <>
            <View className="h-px bg-border-default" />
            <DetailRow
              icon="building"
              value={event.organizer.name}
              note="Організатор події"
              onPress={() =>
                event.organizer && router.push({ pathname: '/organizers/[id]', params: { id: event.organizer.id } })
              }
            />
          </>
        )}
      </View>
    </>
  );

  const mapBlock = (
    <>
      <View className="gap-3">
        <Text className="font-inter-semibold text-title text-text-primary">На мапі</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Показати на мапі"
          onPress={() => router.navigate('/map')}
          className={`items-center justify-center rounded-[18px] bg-[#ECECE7] active:opacity-90 ${isDesktop ? 'h-[280px]' : 'h-[140px]'}`}
        >
          <View className="size-10 items-center justify-center rounded-full bg-brand-coral">
            <Icon name="pin" size={20} color={colors.text['on-dark']} />
          </View>
        </Pressable>
      </View>
    </>
  );

  const overlays = (
    <>
      <DayPickerSheet
        key={`days-${dayOpen}`}
        visible={dayOpen}
        onClose={closeSteps}
        eventTitle={event.title}
        sessions={pickable}
        startTimeKnown={event.startTimeKnown}
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
    </>
  );

  // D02, with D02.1 (already searching) and D02.2 (guest) through the same button and dialogs.
  if (isDesktop) {
    return (
      <View className="flex-1 bg-surface-background">
        <ScrollView>
          <View
            className="w-full gap-6 self-center px-[120px] pb-24 pt-7"
            style={{ maxWidth: desktop.contentWidth + 240 }}
          >
            <View className="h-[420px] overflow-hidden rounded-[28px]">
              <BlurTargetView ref={coverRef} style={StyleSheet.absoluteFill}>
                <EventCover cover={coverOf(event.imageUrl)} photo={event.photo} />
              </BlurTargetView>
              <View className="absolute right-4 top-4 flex-row items-center gap-2">
                {price ? <PriceBadge price={price} blurTarget={coverRef} /> : null}
                <GlassButton
                  icon="heart"
                  label="В обране"
                  active={favorite}
                  onPress={() => toggleFavorite(id)}
                  blurTarget={coverRef}
                />
              </View>
            </View>
            <View className="flex-row items-start gap-10">
              <View className="flex-1 gap-6">
                {titleBlock}
                {aboutBlock}
                {mapBlock}
              </View>
              <View className="w-[420px] gap-5 rounded-[28px] bg-surface-card p-5" style={{ boxShadow: shadows.small }}>
                {detailsBlock}
                <Button label={actionLabel} variant="dark" onPress={onAction} />
              </View>
            </View>
          </View>
        </ScrollView>
        {overlays}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-background">
      <View className="absolute left-0 right-0 top-0 overflow-hidden" style={{ height: COVER_HEIGHT }}>
        {/* What the glass buttons blur on Android; the buttons themselves stay outside. */}
        <BlurTargetView ref={coverRef} style={StyleSheet.absoluteFill}>
          {/* An imported event links its provider's image, an organization's event has its uploaded cover. */}
          <EventCover cover={coverOf(event.imageUrl)} photo={event.photo} />
          <TopShade />
        </BlurTargetView>
      </View>

      {/* The sheet scrolls over the fixed cover up to `sheetStop`, then this frame's rounded top clips it and only its
          content scrolls, so nothing passes under the status bar or the buttons. Above the sheet the scroll view is
          clear and shows the cover. */}
      <View className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-t-[28px]" style={{ top: sheetStop }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ height: COVER_HEIGHT - SHEET_OVERLAP - sheetStop }} />
          <View
            className="gap-5 rounded-t-[28px] bg-surface-card px-5 pt-3"
            style={{ paddingBottom: sheetBottomPadding }}
          >
            <View className="items-center">
              <View className="h-1 w-10 rounded-sm bg-border-default" />
            </View>

            {titleBlock}

            {aboutBlock}

            {detailsBlock}

            {mapBlock}
          </View>
        </ScrollView>
      </View>

      <View className="absolute left-5 right-5 flex-row items-center justify-between" style={{ top: actionsTop }}>
        <GlassButton icon="arrow-left" label="Назад" onPress={goBack} blurTarget={coverRef} />
        <View className="flex-row items-center gap-2">
          {/* "1.3 Ціна", left of the heart; the card shows no price. No badge while the price is unknown. */}
          {price ? <PriceBadge price={price} blurTarget={coverRef} /> : null}
          <GlassButton
            icon="heart"
            label="В обране"
            active={favorite}
            onPress={() => toggleFavorite(id)}
            blurTarget={coverRef}
          />
        </View>
      </View>

      <MatchActionBar label={actionLabel} icon={!match && !inPool} onPress={onAction} bottomInset={insets.bottom} />

      {overlays}
    </View>
  );
}
