// Written with the help of Claude
// AI Usage: company search screen from the Figma "04 Пошук компанії" frame, on the user's application; reviewed by
// Daryna Halytska.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dismissApplication, withdrawApplication } from '@/api/applications';
import { failureSnackbar } from '@/auth/messages';
import { MatchingNav } from '@/components/matching/matching-nav';
import { RoundPanel } from '@/components/matching/round-panel';
import { LeavePoolDialog, SearchMenuSheet } from '@/components/matching/search-menu';
import { SearchRadar } from '@/components/matching/search-radar';
import { ACTION_FADE_TOP, actionFadeBottom, BottomActionFade } from '@/components/ui/bottom-action-fade';
import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Icon, type IconName } from '@/components/ui/icon';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { formatShortDay } from '@/dates';
import { useEventApplication } from '@/hooks/use-applications';
import { useEvent } from '@/hooks/use-event';
import { useMyMatches } from '@/hooks/use-matches';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
import { plural } from '@/plural';
import { openSessions } from '@/state/applications';
import { colors } from '@/styles/tokens';

// The large button's height (button.tsx).
const BUTTON_HEIGHT = 52;

function WaitingItem({
  icon,
  title,
  note,
  onPress,
}: {
  icon: IconName;
  title: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="flex-row items-center gap-3.5 py-3.5">
      <View className="size-10 items-center justify-center rounded-xl bg-surface-card">
        <Icon name={icon} size={20} color={colors.brand.coral} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-medium text-body text-text-primary">{title}</Text>
        <Text className="font-inter text-caption text-text-secondary">{note}</Text>
      </View>
      <Icon name="arrow-right" size={18} color={colors.text.secondary} />
    </Pressable>
  );
}

export default function CompanySearchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // "Ще" opens the 04.1 menu, whose "Вийти з підбору" opens the 04.2 dialog.
  const [overlay, setOverlay] = useState<'menu' | 'leave' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const { snackbar, show } = useSnackbar();
  const insets = useSafeAreaInsets();
  useStatusBarStyle('light');

  const { application, loaded, reload } = useEventApplication(id);
  // The cutoff passed without a match (FR-018): the screen offers what to do next instead of the search.
  const noMatch = application?.status === 'no_match';
  const { matches } = useMyMatches();
  const pending = matches.filter(({ status }) => status === 'proposed' || status === 'accepted').length;
  const { data: liveEvent } = useEvent(id);
  const mockEvent = findMockEvent(id);
  const event = liveEvent ?? mockEvent;
  const picked = application ? openSessions(application) : [];
  const day = picked[0]?.startsAt ?? event?.startsAt;
  const days =
    picked.length > 1
      ? `${picked.length} ${plural(picked.length, ['день', 'дні', 'днів'])}`
      : day && formatShortDay(day);
  const subtitle = event && days ? `${mockEvent?.shortTitle ?? event.title} · ${days}` : undefined;
  const backToEvent = () => router.dismissTo({ pathname: '/events/[id]', params: { id } });

  // Without an application for the event, e.g. after leaving the pool on another device, there is nothing to wait for.
  useEffect(() => {
    if (loaded && !application && !leaving && !dismissing) router.replace({ pathname: '/events/[id]', params: { id } });
  }, [loaded, application, leaving, dismissing, router, id]);

  const leave = async () => {
    if (!application) return;
    setLeaving(true);
    const result = await withdrawApplication(application.id);
    if (result.ok) {
      setOverlay(null);
      backToEvent();
    } else {
      setLeaving(false);
      setOverlay(null);
      show(failureSnackbar(result));
    }
  };

  const dismiss = async () => {
    if (!application) return;
    setDismissing(true);
    const result = await dismissApplication(application.id);
    if (result.ok) {
      if (router.canGoBack()) router.back();
      else router.replace('/matches');
    } else {
      setDismissing(false);
      show(failureSnackbar(result));
    }
  };

  return (
    <View className="flex-1 bg-surface-card">
      <ScrollView className="flex-1">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="absolute left-0 right-0 top-0 h-[472px] overflow-hidden rounded-b-[28px]">
          <CoralGradient preset="search" />
        </View>

        <MatchingNav
          title="Пошук компанії"
          subtitle={subtitle}
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace({ pathname: '/events/[id]', params: { id } })
          }
          onMore={noMatch ? undefined : () => setOverlay('menu')}
        />

        <View className="items-center gap-5 px-5 pb-2 pt-9">
          {noMatch ? (
            <View className="size-[120px] items-center justify-center rounded-full border border-white/[0.14] bg-white/10">
              <Icon name="empty-matches" size={48} color={colors.text['on-dark']} />
            </View>
          ) : (
            <SearchRadar />
          )}
          <View className="items-center gap-2">
            <Text accessibilityRole="header" className="font-inter-bold text-h1 text-text-on-dark">
              {noMatch ? 'Цього разу не склалося' : 'Ти в грі!'}
            </Text>
            <Text className="text-center font-inter text-caption leading-5 text-text-on-dark-muted">
              {noMatch
                ? 'Компанії на цю подію не знайшлося. Спробуй іншу подію або створи оголошення.'
                : 'Ми штурхнемо тебе, щойно знайдемо людину зі схожими інтересами.'}
            </Text>
          </View>
        </View>

        {application && !noMatch && (
          <View className="px-5 pt-14">
            <RoundPanel application={application} onRoundDue={reload} />
          </View>
        )}

        <View
          className="gap-3 px-5 pt-6"
          style={{ paddingBottom: noMatch ? ACTION_FADE_TOP + BUTTON_HEIGHT + actionFadeBottom(insets.bottom) : 32 }}
        >
          <Text className="font-inter-semibold text-title text-text-primary">
            {noMatch ? 'Що далі' : 'Поки чекаєш'}
          </Text>
          <View className="rounded-[20px] bg-surface-background px-4 py-1">
            {noMatch && pending > 0 && (
              <>
                <WaitingItem
                  icon="matches"
                  title="Переглянути свої інші метчі"
                  note={`${pending} ${plural(pending, ['пропозиція чекає', 'пропозиції чекають', 'пропозицій чекають'])} на відповідь`}
                  onPress={() => router.navigate('/matches')}
                />
                <View className="h-px bg-border-default" />
              </>
            )}
            <WaitingItem
              icon="calendar"
              title="Обрати іншу подію"
              note="Ти точно ще багато де не був(-ла)"
              onPress={() => router.dismissTo('/')}
            />
            <View className="h-px bg-border-default" />
            <WaitingItem
              icon="list"
              title="Створити оголошення"
              note="Запропонуй свою ідею для зустрічі"
              onPress={() => router.navigate({ pathname: '/announcements', params: { compose: '1' } })}
            />
          </View>
        </View>
      </ScrollView>

      {noMatch && (
        <BottomActionFade id="dismiss-action-fade">
          <Button label="Прибрати з метчів" variant="dark" loading={dismissing} onPress={() => void dismiss()} />
        </BottomActionFade>
      )}

      <SearchMenuSheet
        visible={overlay === 'menu'}
        onClose={() => setOverlay(null)}
        onChangeRequest={() => {
          setOverlay(null);
          router.dismissTo({ pathname: '/events/[id]', params: { id, request: '1' } });
        }}
        onLeave={() => setOverlay('leave')}
      />
      <LeavePoolDialog
        visible={overlay === 'leave'}
        onClose={() => setOverlay('menu')}
        leaving={leaving}
        onLeave={() => void leave()}
      />

      {snackbar && <Snackbar {...snackbar} />}
    </View>
  );
}
