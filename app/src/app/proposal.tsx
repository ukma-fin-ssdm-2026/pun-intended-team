// Written with the help of Claude
// AI Usage: proposed match screen from the Figma "05 Запропонований метч" frame with the 05.2а / 05.3а animations and
// the 05.2 / 05.3 states; reviewed by Daryna Halytska.
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { acceptMatch, declineMatch } from '@/api/matches';
import { failureSnackbar } from '@/auth/messages';
import { DeclineMatchDialog } from '@/components/matching/decline-match-dialog';
import { MatchStatus } from '@/components/matching/match-status';
import { MatchingNav } from '@/components/matching/matching-nav';
import { ProposalCard } from '@/components/matching/proposal-card';
import { ReportFlow, reportedUser, type ReportStep } from '@/components/matching/report-flow';
import { SwipeAccept } from '@/components/matching/swipe-accept';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon } from '@/components/ui/icon';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { formatShortDay } from '@/dates';
import { useEvent } from '@/hooks/use-event';
import { useMatch } from '@/hooks/use-matches';
import { useProfile } from '@/hooks/use-profile';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import type { Match } from '@/state/matches';
import { colors } from '@/styles/tokens';

// "04 Дії" sits 34 px above the bottom of the frame; a larger bottom inset replaces the 34 px. The contacts note is 12 px
// above the 60 px buttons, and the card list keeps clear of both (Figma: the dots end at y=707).
const ACTIONS_BOTTOM = 34;
const ACTIONS_HEIGHT = 60;
const NOTE_GAP = 12;
const NOTE_HEIGHT = 18;
const LIST_GAP = 13;
// "Повідомлення" of 05.2 / 05.3 starts at y=286, 230 px below the top of the navigation (y=56).
const NAV_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const MESSAGE_BELOW_NAV = 230;

// Prototype timing: Smart Animate 400 ms to 05.2а / 05.3а (the profile slides out 430 px, the actions fade), 50 ms
// later Smart Animate 300 ms to 05.2 / 05.3 (the message fades in), then 1.8 s later a 250 ms dissolve to Т2.2.
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const SLIDE_MS = 400;
const MESSAGE_DELAY_MS = 50;
const MESSAGE_MS = 300;
const STATUS_MS = 1800;
const SLIDE_PAST_EDGE = 40;

type Answer = 'accepted' | 'declined';

// What a proposal the caller already answered, or one past its time, shows in place of the buttons.
const waitingNotes: Partial<Record<Match['status'], string>> = {
  accepted: 'Згоду надіслано, чекаємо на відповідь',
  expired: 'Час на відповідь вийшов',
};

export default function ProposalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [answer, setAnswer] = useState<Answer>();
  const [sending, setSending] = useState(false);
  // An answer moves the match on or drops it from the list, so the card keeps the match it was opened with.
  const [answered, setAnswered] = useState<Match>();
  // Where the screen goes once the answer has been shown: the contacts when both accepted.
  const [next, setNext] = useState<Href>('/matches');
  // Remounts the swipe control after a failed answer, so its knob returns to the start.
  const [attempt, setAttempt] = useState(0);
  const [report, setReport] = useState<ReportStep>('closed');
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const { snackbar, show } = useSnackbar();
  useStatusBarStyle('light');

  const { match: listed, loaded } = useMatch(id);
  const match = answered ?? listed;
  const ownInterestIds = useProfile().data?.interests.map(({ id: interestId }) => interestId) ?? [];
  const { data: event } = useEvent(match?.eventId);

  const profileX = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);
  const messageOpacity = useSharedValue(0);

  const day = match?.days[0]?.startsAt;
  const title = event?.title;
  const subtitle = title && day ? `${title} · ${formatShortDay(day)}` : undefined;
  const actionsBottom = Math.max(ACTIONS_BOTTOM, insets.bottom);
  const navTop = Math.max(NAV_TOP, insets.top + GAP_BELOW_STATUS_BAR);
  const toMatches = () => router.dismissTo('/matches');
  const waitingNote = match && !answer ? waitingNotes[match.status] : undefined;
  const canAnswer = match?.status === 'proposed' && !answer;

  // A match that is no longer listed, e.g. declined on another device, has nothing to show.
  useEffect(() => {
    if (loaded && !match) router.dismissTo('/matches');
  }, [loaded, match, router]);

  useEffect(() => {
    if (!answer) return;
    const duration = (ms: number) => (reduceMotion ? 0 : ms);
    profileX.set(
      withTiming((answer === 'accepted' ? 1 : -1) * (width + SLIDE_PAST_EDGE), {
        duration: duration(SLIDE_MS),
        easing: EASE_IN_OUT,
      }),
    );
    controlsOpacity.set(withTiming(0, { duration: duration(SLIDE_MS), easing: EASE_IN_OUT }));
    messageOpacity.set(
      withDelay(
        duration(SLIDE_MS + MESSAGE_DELAY_MS),
        withTiming(1, { duration: duration(MESSAGE_MS), easing: EASE_IN_OUT }),
      ),
    );
    const timer = setTimeout(
      () => (next === '/matches' ? router.dismissTo('/matches') : router.replace(next)),
      SLIDE_MS + MESSAGE_DELAY_MS + MESSAGE_MS + STATUS_MS,
    );
    return () => clearTimeout(timer);
  }, [answer, next, reduceMotion, width, router, profileX, controlsOpacity, messageOpacity]);

  const respond = async (choice: Answer) => {
    if (!match || sending) return;
    setSending(true);
    const result = await (choice === 'accepted' ? acceptMatch(match.id) : declineMatch(match.id));
    setSending(false);
    setConfirmingDecline(false);
    if (!result.ok) {
      setAttempt((count) => count + 1);
      show(
        result.status === 409
          ? { tone: 'error', title: 'Ця пропозиція вже не діє', note: 'Зазирни у «Метчі», там усе свіже' }
          : failureSnackbar(result),
      );
      return;
    }
    setAnswered(match);
    // Both accepted: on the first match, the mutual screen opens the safety reminder (06) over the contacts (07).
    if (result.data.status === 'mutual') setNext({ pathname: '/mutual', params: { id: match.id } });
    setAnswer(choice);
  };

  const profileStyle = useAnimatedStyle(() => ({ transform: [{ translateX: profileX.value }] }));
  const controlsStyle = useAnimatedStyle(() => ({ opacity: controlsOpacity.value }));
  const messageStyle = useAnimatedStyle(() => ({ opacity: messageOpacity.value }));

  if (!match) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-ink">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.text['on-dark']} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-brand-ink">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="absolute inset-0">
        <CoralGradient preset="screen" />
      </View>

      <MatchingNav
        title="Новий метч"
        subtitle={subtitle}
        onBack={toMatches}
        onMore={answer ? undefined : () => setReport('form')}
      />

      {/* NativeWind maps className only on React Native's own components, so animated views get plain styles. */}
      <Animated.View style={[{ flex: 1 }, profileStyle]}>
        <View
          className="flex-1 px-5 pt-2.5"
          style={{ paddingBottom: actionsBottom + ACTIONS_HEIGHT + NOTE_GAP + NOTE_HEIGHT + LIST_GAP }}
        >
          <ProposalCard match={match} ownInterestIds={ownInterestIds} event={event} />
        </View>
      </Animated.View>

      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, bottom: actionsBottom + ACTIONS_HEIGHT + NOTE_GAP },
          { pointerEvents: 'none' },
          controlsStyle,
        ]}
      >
        <View className="flex-row items-center justify-center gap-1.5">
          <Icon name="shield" size={14} color={colors.text['on-dark']} />
          <Text className="font-inter text-[12px] leading-[18px] text-text-on-dark-muted opacity-85">
            Контакти відкриються після згоди обох
          </Text>
        </View>
      </Animated.View>

      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, bottom: actionsBottom },
          { pointerEvents: canAnswer ? 'auto' : 'none' },
          controlsStyle,
        ]}
      >
        {waitingNote ? (
          <View className="h-[60px] items-center justify-center px-5">
            <Text className="text-center font-inter-medium text-body text-text-on-dark">{waitingNote}</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-2.5 px-5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Не цього разу"
              accessibilityState={{ disabled: !canAnswer || sending }}
              disabled={!canAnswer || sending}
              onPress={() => setConfirmingDecline(true)}
              className="size-[60px] items-center justify-center rounded-[30px] bg-brand-coral active:opacity-90"
              style={{ boxShadow: '0px 8px 20px -6px rgba(223, 84, 74, 0.3)' }}
            >
              <Icon name="decline-close" size={24} color={colors.text['on-dark']} />
            </Pressable>
            <SwipeAccept key={attempt} onAccept={() => void respond('accepted')} disabled={!canAnswer || sending} />
          </View>
        )}
      </Animated.View>

      {answer && (
        <Animated.View
          style={[
            { position: 'absolute', left: 20, right: 20, top: navTop + MESSAGE_BELOW_NAV, pointerEvents: 'none' },
            messageStyle,
          ]}
        >
          <MatchStatus answer={answer} name={match.partner.displayName} />
        </Animated.View>
      )}

      <ReportFlow person={reportedUser(match.partner)} step={report} onStepChange={setReport} onDone={toMatches} />
      <DeclineMatchDialog
        visible={confirmingDecline}
        busy={sending}
        onClose={() => setConfirmingDecline(false)}
        onDecline={() => void respond('declined')}
      />
      {snackbar && <Snackbar {...snackbar} />}
    </View>
  );
}
