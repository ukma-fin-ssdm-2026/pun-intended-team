// Written with the help of Claude
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RoundsSheet } from '@/components/matching/rounds-sheet';
import { Icon } from '@/components/ui/icon';
import { formatNearDate } from '@/dates';
import { plural } from '@/plural';
import { countdownParts, formatSpan, nextRound, roundOffsetTitle, roundsSinceApplying } from '@/rounds';
import { type Application, matchingPhase, openSessions } from '@/state/applications';
import { colors } from '@/styles/tokens';

function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

type StepState = 'done' | 'next' | 'future';

function StepNode({ state }: { state: StepState | 'event' }) {
  if (state === 'event') {
    return <Icon name="ticket" size={22} color={colors.brand.ink} />;
  }
  if (state === 'done') {
    return (
      <View className="size-4 items-center justify-center rounded-full bg-brand-ink">
        <Icon name="check" size={10} color={colors.text['on-dark']} />
      </View>
    );
  }
  if (state === 'next') {
    return (
      <View className="size-4 items-center justify-center rounded-full bg-brand-coral">
        <View className="size-1.5 rounded-full bg-surface-card" />
      </View>
    );
  }
  return <View className="size-4 rounded-full border-2 border-[#D4D3D0] bg-surface-card" />;
}

// One step of the tracker; `fill` is how much of the line down to the next step is behind us.
function Step({
  state,
  fill,
  children,
}: {
  state: StepState | 'event';
  fill: number | null;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="w-[22px] items-center">
        <View className="size-[22px] items-center justify-center">
          <StepNode state={state} />
        </View>
        {fill !== null && (
          <View className="my-0.5 w-0.5 flex-1 overflow-hidden rounded-full bg-border-default">
            <View className="w-full bg-brand-ink" style={{ height: `${Math.round(fill * 100)}%` }} />
          </View>
        )}
      </View>
      <View className={`flex-1 ${fill !== null ? 'pb-3' : ''}`}>{children}</View>
    </View>
  );
}

function StepLine({
  title,
  time,
  state,
  chevron,
}: {
  title: string;
  time?: string;
  state: StepState | 'event';
  chevron?: boolean;
}) {
  const tone = {
    done: 'font-inter text-text-secondary',
    next: 'font-inter-semibold text-brand-coral',
    future: 'font-inter text-text-primary',
    event: 'font-inter-semibold text-text-primary',
  }[state];
  return (
    <View className="min-h-[22px] flex-row items-center justify-between gap-2">
      <Text className={`text-body ${tone}`}>{title}</Text>
      <View className="flex-row items-center gap-1">
        {time && <Text className="font-inter text-caption text-text-secondary">{time}</Text>}
        {chevron && (
          <View style={{ transform: [{ rotate: '90deg' }] }}>
            <Icon name="field-chevron" size={16} color={colors.text.secondary} />
          </View>
        )}
      </View>
    </View>
  );
}

function Countdown({ ms }: { ms: number }) {
  return (
    <View className="flex-row items-baseline gap-2">
      <Text className="font-inter-medium text-h2 text-text-secondary">за</Text>
      {countdownParts(ms).map(({ value, unit }) => (
        <View key={unit} className="flex-row items-baseline gap-0.5">
          <Text
            className="font-inter-bold text-[40px] leading-[44px] text-text-primary"
            style={{ fontVariant: ['tabular-nums'], letterSpacing: -1.2 }}
          >
            {value}
          </Text>
          <Text className="font-inter-medium text-caption text-text-secondary">{unit}</Text>
        </View>
      ))}
    </View>
  );
}

function Live({ title, note }: { title: string; note: string }) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2.5">
        <View className="size-2.5 rounded-full bg-brand-coral" />
        <Text className="font-inter-bold text-h1 text-text-primary">{title}</Text>
      </View>
      <Text className="font-inter text-caption text-text-secondary">{note}</Text>
    </View>
  );
}

// The "Наступний підбір" card of the search screen: a countdown to the next round and a tracker from the moment the
// user applied, through the rounds since then, to the event. `onRoundDue` runs once when the countdown reaches zero,
// so the screen can load the next round.
export function RoundPanel({ application, onRoundDue }: { application: Application; onRoundDue: () => void }) {
  const now = useNow();
  const [explaining, setExplaining] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const [timeline, setTimeline] = useState(false);
  const dueFor = useRef<string | null>(null);

  const phase = matchingPhase(application, new Date(now));
  const picked = openSessions(application, new Date(now));
  const { nextRoundAt, createdAt } = application;
  const day = nextRound(picked, nextRoundAt).startsAt ?? application.cutoffAt;
  const startsAt = Date.parse(day);
  const nextAt = nextRoundAt ? Date.parse(nextRoundAt) : null;
  const untilNext = nextAt === null ? 0 : nextAt - now;
  const due = phase === 'rounds' && untilNext <= 0;

  useEffect(() => {
    if (due && nextRoundAt && dueFor.current !== nextRoundAt) {
      dueFor.current = nextRoundAt;
      onRoundDue();
    }
  }, [due, nextRoundAt, onRoundDue]);

  const rounds = roundsSinceApplying(day, createdAt).map((offset) => {
    const at = startsAt - offset;
    const state: StepState = nextAt === null || at < nextAt ? 'done' : at === nextAt ? 'next' : 'future';
    return { offset, at, state };
  });
  const upcoming = rounds.filter(({ state }) => state === 'future');
  // Two or more upcoming rounds fold into one "Ще N підбори" row.
  const foldable = upcoming.length > 1;
  const times = [Date.parse(createdAt), ...rounds.map(({ at }) => at), startsAt];
  const fill = (index: number) => {
    const span = times[index + 1] - times[index];
    return span <= 0 ? 1 : Math.min(1, Math.max(0, (now - times[index]) / span));
  };

  const heading = { rounds: 'Наступний підбір пар', open: 'Відкритий підбір', over: 'Підбір завершено' }[phase];

  return (
    <>
      {/* Tapping anywhere on the card shows or hides the timeline; the screen reader reaches it through the bars. */}
      <Pressable
        accessible={false}
        disabled={rounds.length === 0}
        onPress={() => setTimeline((open) => !open)}
        className="gap-4 rounded-[20px] bg-surface-background p-4"
      >
        <View className="gap-1">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 font-inter-semibold text-caption text-text-primary" accessibilityRole="header">
              {heading}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Як ми шукаємо тобі компанію"
              onPress={() => setExplaining(true)}
              className="size-6 items-center justify-center rounded-full bg-brand-coral-soft"
            >
              <Text className="font-inter-semibold text-caption text-brand-coral">?</Text>
            </Pressable>
          </View>
          {phase === 'rounds' && !due && <Countdown ms={untilNext} />}
        </View>
        {due && <Live title="Підбираємо пари" note="Ще трохи, і покажемо, кого знайшли" />}
        {phase === 'open' && <Live title="Шукаємо зараз" note="Підберемо пару, щойно хтось долучиться" />}

        {rounds.length > 0 && (
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel="Розклад підборів"
            accessibilityState={{ expanded: timeline }}
            className="flex-row gap-1.5"
          >
            {rounds.map(({ at, state }) => (
              <View
                key={at}
                className={`h-1.5 flex-1 rounded-[3px] ${{ done: 'bg-brand-ink', next: 'bg-brand-coral', future: 'bg-border-default' }[state]}`}
              />
            ))}
          </View>
        )}

        {timeline && (
          <View>
            <Step state="done" fill={fill(0)}>
              <StepLine title="Заявку подано" time={formatNearDate(createdAt, new Date(now))} state="done" />
            </Step>
            {rounds.map(({ offset, at, state }, index) => {
              const time = formatNearDate(new Date(at).toISOString(), new Date(now));
              if (!foldable || state !== 'future') {
                return (
                  <Step key={at} state={state} fill={fill(index + 1)}>
                    <StepLine title="Підбір пар" time={time} state={state} />
                  </Step>
                );
              }
              const first = at === upcoming[0].at;
              if (!unfolded) {
                if (!first) return null;
                return (
                  <Step key={at} state="future" fill={fill(rounds.length)}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: false }}
                      onPress={() => setUnfolded(true)}
                    >
                      <StepLine
                        title={`Ще ${upcoming.length} ${plural(upcoming.length, ['підбір', 'підбори', 'підборів'])}`}
                        state="future"
                        chevron
                      />
                    </Pressable>
                  </Step>
                );
              }
              return (
                <Step key={at} state="future" fill={fill(index + 1)}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: true }}
                    onPress={() => setUnfolded(false)}
                  >
                    <StepLine title={roundOffsetTitle(offset)} time={time} state="future" />
                  </Pressable>
                </Step>
              );
            })}
            <Step state="event" fill={null}>
              <StepLine
                title={phase === 'over' ? 'Подія' : `Подія за ${formatSpan(startsAt - now)}`}
                time={formatNearDate(day, new Date(now))}
                state="event"
              />
            </Step>
          </View>
        )}
      </Pressable>

      <RoundsSheet visible={explaining} onClose={() => setExplaining(false)} />
    </>
  );
}
