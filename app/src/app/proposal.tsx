// Written with the help of Claude
// AI Usage: proposed match screen from the Figma "05 Запропонований метч" frame with the 05.2а / 05.3а animations and
// the 05.2 / 05.3 states, on mock data; reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MatchStatus } from '@/components/matching/match-status';
import { MatchingNav } from '@/components/matching/matching-nav';
import { ProposalCard } from '@/components/matching/proposal-card';
import { ReportFlow, type ReportStep } from '@/components/matching/report-flow';
import { SwipeAccept } from '@/components/matching/swipe-accept';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon } from '@/components/ui/icon';
import { formatShortDay } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { mockProposal, mockSearch } from '@/mocks/matching';
import { markProposalAnswered } from '@/state/matches';
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

export default function ProposalScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [answer, setAnswer] = useState<Answer>();
  const [report, setReport] = useState<ReportStep>('closed');
  useStatusBarStyle('light');

  const profileX = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);
  const messageOpacity = useSharedValue(0);

  const event = findMockEvent(mockSearch.eventId);
  const subtitle = event ? `${event.shortTitle ?? event.title} · ${formatShortDay(event.startsAt)}` : undefined;
  const actionsBottom = Math.max(ACTIONS_BOTTOM, insets.bottom);
  const navTop = Math.max(NAV_TOP, insets.top + GAP_BELOW_STATUS_BAR);
  const toMatches = () => router.dismissTo('/matches');

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
      () => {
        markProposalAnswered();
        router.dismissTo('/matches');
      },
      SLIDE_MS + MESSAGE_DELAY_MS + MESSAGE_MS + STATUS_MS,
    );
    return () => clearTimeout(timer);
  }, [answer, reduceMotion, width, router, profileX, controlsOpacity, messageOpacity]);

  const profileStyle = useAnimatedStyle(() => ({ transform: [{ translateX: profileX.value }] }));
  const controlsStyle = useAnimatedStyle(() => ({ opacity: controlsOpacity.value }));
  const messageStyle = useAnimatedStyle(() => ({ opacity: messageOpacity.value }));

  return (
    <View className="flex-1 bg-brand-ink">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="absolute inset-0">
        <CoralGradient preset="screen" />
      </View>

      <MatchingNav
        title={mockProposal.position}
        subtitle={subtitle}
        onBack={toMatches}
        onMore={answer ? undefined : () => setReport('form')}
      />

      {/* NativeWind maps className only on React Native's own components, so animated views get plain styles. */}
      <Animated.View style={[{ flex: 1 }, profileStyle]}>
        <ScrollView
          contentContainerClassName="px-5 pt-2.5"
          contentContainerStyle={{ paddingBottom: actionsBottom + ACTIONS_HEIGHT + NOTE_GAP + NOTE_HEIGHT + LIST_GAP }}
          showsVerticalScrollIndicator={false}
        >
          <ProposalCard />
          <View className="flex-row items-center justify-center gap-1.5 pt-3">
            {Array.from({ length: mockProposal.count }, (_, index) => (
              <View
                key={index}
                className={`h-1.5 rounded-[3px] ${index === 0 ? 'w-[18px] bg-white' : 'w-1.5 bg-white/[0.35]'}`}
              />
            ))}
          </View>
        </ScrollView>
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
          { pointerEvents: answer ? 'none' : 'auto' },
          controlsStyle,
        ]}
      >
        <View className="flex-row items-center gap-2.5 px-5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Не цього разу"
            onPress={() => setAnswer('declined')}
            className="size-[60px] items-center justify-center rounded-[30px] bg-brand-coral active:opacity-90"
            style={{ boxShadow: '0px 8px 20px -6px rgba(223, 84, 74, 0.3)' }}
          >
            <Icon name="decline-close" size={24} color={colors.text['on-dark']} />
          </Pressable>
          <SwipeAccept onAccept={() => setAnswer('accepted')} disabled={!!answer} />
        </View>
      </Animated.View>

      {answer && (
        <Animated.View
          style={[
            { position: 'absolute', left: 20, right: 20, top: navTop + MESSAGE_BELOW_NAV, pointerEvents: 'none' },
            messageStyle,
          ]}
        >
          <MatchStatus answer={answer} />
        </Animated.View>
      )}

      <ReportFlow step={report} onStepChange={setReport} onDone={toMatches} />
    </View>
  );
}
