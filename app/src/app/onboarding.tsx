// Written with the help of Claude
// AI Usage: onboarding carousel from the Figma "В1 Онбординг · Події", "В2 · Як це працює" and "В3 · Безпека" frames;
// reviewed by Daryna Halytska.
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { GoogleButton } from '@/components/auth/google-button';
import { EventsCollage } from '@/components/onboarding/events-collage';
import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Glass } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/icon';
import { Snackbar, type SnackbarContent } from '@/components/ui/snackbar';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { setGuest } from '@/state/session';
import { colors } from '@/styles/tokens';

const PAGES = 3;
// "02 Дії" sits 34 px above the bottom; a larger bottom inset replaces the 34 px.
const ACTIONS_BOTTOM = 34;
// В1's text sits 20 px above the step indicator.
const INTRO_GAP = 20;
// DВ1–DВ3: the collage fills the left half; the slides and their actions are a 440 px column on the right, with В1's
// text and the actions centered in its height and the other slides' content standing on the actions.
const DESKTOP_COLUMN = 440;
// "00 Колаж подій" of DВ1 is В1's 600 px collage at 1.9 times the size, 60 px above the top of the window.
const DESKTOP_COLLAGE_SCALE = 1.9;
const DESKTOP_COLLAGE_TOP = -60;
const COLLAGE_HEIGHT = 600;
// "01 Перехід у фон" of DВ1.
const DESKTOP_FADE = { top: 380, height: 520 };

const steps: { icon: IconName; title: string; note: string; accent?: boolean }[] = [
  { icon: 'home', title: '1. Обери подію', note: 'Концерти, виставки, лекції у твоєму місті' },
  { icon: 'matches', title: '2. Що ти шукаєш?', note: 'Компанію на вечір, дружбу чи побачення' },
  {
    icon: 'check',
    title: '3. Прийми метч',
    note: 'Ми підберемо тобі найцікавішу компанію. Далі все в твоїх руках.',
    accent: true,
  },
];

const rules: { icon: IconName; text: string }[] = [
  { icon: 'user', text: 'Лише для людей від 18 років' },
  { icon: 'send', text: 'Твої контакти побачить лише взаємний метч' },
  { icon: 'danger', text: 'Модератори стежать за порядком і реагують на кожну скаргу' },
];

// "01 Перехід у фон" of В1: the collage fades into the ink background by 60% of its 420 px.
function CollageFade({ top = 300, height = 420 }: { top?: number; height?: number }) {
  return (
    <Svg width="100%" height={height} pointerEvents="none" style={{ position: 'absolute', top, left: 0 }}>
      <Defs>
        <LinearGradient id="onboarding-fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset={0} stopColor={colors.brand.ink} stopOpacity={0} />
          <Stop offset={0.6} stopColor={colors.brand.ink} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#onboarding-fade)" />
    </Svg>
  );
}

type ActionsProps = {
  page: number;
  onDot: (page: number) => void;
  onNext: () => void;
  onIdToken: (idToken: string) => void;
  onGoogleFailure: (snackbar: SnackbarContent) => void;
  googleLoading: boolean;
  onGuest: () => void;
  onOrganizations: () => void;
  // The space under the actions.
  bottom: number;
  // The height of the actions without the space under them.
  onHeight: (height: number) => void;
};

// "02 Дії" stays in place while the slides move: the step indicator only moves its active dot, and the main button is
// "Далі" until В3, where it becomes Google's, for signing in and signing up alike. "Увійти" on В1 and В2 leads to В3.
// Figma spaces it 18 px apart (В2, В3).
function Actions({
  page,
  onDot,
  onNext,
  onIdToken,
  onGoogleFailure,
  googleLoading,
  onGuest,
  onOrganizations,
  bottom,
  onHeight,
}: ActionsProps) {
  const last = page === PAGES - 1;
  return (
    <View
      className="absolute bottom-0 left-0 right-0 items-center gap-[18px] px-5"
      pointerEvents="box-none"
      style={{ paddingBottom: bottom }}
      onLayout={(event) => onHeight(event.nativeEvent.layout.height - bottom)}
    >
      <View className="flex-row items-center gap-1.5">
        {Array.from({ length: PAGES }, (_, index) => (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`Крок ${index + 1}`}
            accessibilityState={{ selected: index === page }}
            onPress={() => onDot(index)}
            hitSlop={8}
            className={`h-1.5 rounded-[3px] ${index === page ? 'w-[22px] bg-brand-coral' : 'w-1.5 bg-white/[0.35]'}`}
          />
        ))}
      </View>
      <View className="w-full">
        {last ? (
          <GoogleButton variant="light" loading={googleLoading} onIdToken={onIdToken} onFailure={onGoogleFailure} />
        ) : (
          <Button label="Далі" onPress={onNext} />
        )}
      </View>
      <View className="flex-row items-center gap-3.5">
        {!last && (
          <>
            <Pressable accessibilityRole="link" onPress={() => onDot(PAGES - 1)}>
              <Text className="font-inter-medium text-label text-text-on-dark">Увійти</Text>
            </Pressable>
            <View className="size-1 rounded-full bg-white/[0.35]" />
          </>
        )}
        <Pressable accessibilityRole="link" onPress={onGuest}>
          <Text className="font-inter-medium text-label text-text-on-dark-muted">Продовжити як гість</Text>
        </Pressable>
        {/* Organizations work in a browser on a computer, so the phone app does not offer it. */}
        {Platform.OS === 'web' && (
          <>
            <View className="size-1 rounded-full bg-white/[0.35]" />
            <Pressable accessibilityRole="link" onPress={onOrganizations}>
              <Text className="font-inter-medium text-label text-text-on-dark-muted">Для організацій</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const window = useWindowDimensions();
  const isDesktop = useIsDesktop();
  // The width of one slide: the screen's on a phone, the column's on a desktop.
  const width = isDesktop ? DESKTOP_COLUMN : window.width;
  const scroll = useAnimatedRef<Animated.ScrollView>();
  const offset = useSharedValue(0);
  const [page, setPage] = useState(0);
  const [actionsHeight, setActionsHeight] = useState(0);
  const [introHeight, setIntroHeight] = useState(0);
  const insets = useSafeAreaInsets();
  // "02 Дії" 34 px above the bottom of a phone; on a desktop, В1's text and the actions centered in the column.
  const actionsBottom = isDesktop
    ? Math.max(ACTIONS_BOTTOM, (window.height - introHeight - INTRO_GAP - actionsHeight) / 2)
    : Math.max(ACTIONS_BOTTOM, insets.bottom);
  // Where the slides' content ends: right above the actions.
  const aboveActions = actionsBottom + actionsHeight + INTRO_GAP;
  const google = useGoogleAuth();
  useStatusBarStyle('light');

  const onScroll = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.x;
  });
  // The active dot follows the swipe: it moves as soon as the next slide is more than half in view.
  useAnimatedReaction(
    () => Math.round(offset.value / width),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setPage, current);
    },
    [width],
  );
  // В1 is on ink and В2, В3 on the coral gradient: the ink fades out as В1 slides away.
  const inkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(offset.value, [0, width], [1, 0], Extrapolation.CLAMP),
  }));

  // A new slide width (a resized window, a rotated phone) keeps the current slide in view.
  useEffect(() => {
    scroll.current?.scrollTo({ x: page * width, animated: false });
    // Only the width: a page change scrolls by itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const goTo = (target: number) => scroll.current?.scrollTo({ x: target * width, animated: true });

  const backgrounds = (
    <>
      <View className="absolute inset-0">
        <CoralGradient preset="screen" />
      </View>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.brand.ink },
          inkStyle,
        ]}
      />
    </>
  );

  const pager = (
    <>
      <Animated.ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View className="h-full overflow-hidden" style={{ width }}>
          {/* On a desktop the collage is the left half instead. */}
          {!isDesktop && (
            <>
              <EventsCollage />
              <CollageFade />
            </>
          )}
          <View
            className="absolute left-0 right-0 items-center gap-3 px-5"
            style={{ bottom: aboveActions }}
            onLayout={(event) => setIntroHeight(event.nativeEvent.layout.height)}
          >
            <Text accessibilityRole="header" className="text-center font-inter-bold text-display text-text-on-dark">
              {'Обери подію,\nа ми знайдемо компанію'}
            </Text>
            <Text className="text-center font-inter text-body text-text-on-dark-muted">
              Концерти, виставки, лекції й вечірки у твоєму місті. І люди, які теж хочуть піти.
            </Text>
          </View>
        </View>
        <View className="h-full" style={{ width }}>
          <View
            className={`absolute left-0 right-0 gap-7 px-5 ${isDesktop ? '' : 'top-[130px]'}`}
            style={isDesktop ? { bottom: aboveActions } : undefined}
          >
            <View className="gap-2">
              <Text accessibilityRole="header" className="font-inter-bold text-display text-text-on-dark">
                Як це працює
              </Text>
              <Text className="font-inter text-body text-text-on-dark-muted">
                Всього три кроки, і на кожну подію в тебе буде компанія.
              </Text>
            </View>
            <View className="gap-3">
              {steps.map((step) => (
                <Glass
                  key={step.title}
                  className="py-4 pl-3.5 pr-4"
                  radius={22}
                  fill="rgba(255, 255, 255, 0.08)"
                  border="rgba(255, 255, 255, 0.14)"
                  blur={20}
                  tone="dark"
                >
                  <View className="flex-row items-center gap-3.5">
                    <View
                      className={`size-12 items-center justify-center rounded-2xl ${step.accent ? 'bg-brand-coral' : 'bg-white'}`}
                    >
                      <Icon
                        name={step.icon}
                        size={22}
                        color={step.accent ? colors.text['on-dark'] : colors.text.primary}
                      />
                    </View>
                    <View className="flex-1 gap-[3px]">
                      <Text className="font-inter-semibold text-title text-text-on-dark">{step.title}</Text>
                      <Text className="font-inter text-caption text-text-on-dark-muted">{step.note}</Text>
                    </View>
                  </View>
                </Glass>
              ))}
            </View>
          </View>
        </View>

        <View className="h-full" style={{ width }}>
          <View
            className={`absolute left-0 right-0 items-center gap-7 px-5 ${isDesktop ? '' : 'top-[150px]'}`}
            style={isDesktop ? { bottom: aboveActions } : undefined}
          >
            <View className="size-[120px] items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.08]">
              <View
                className="size-[76px] items-center justify-center rounded-full bg-brand-coral"
                style={{ boxShadow: '0px 0px 30px rgba(223, 84, 74, 0.5)' }}
              >
                <Icon name="shield" size={34} color={colors.text['on-dark']} />
              </View>
            </View>
            <Text accessibilityRole="header" className="text-center font-inter-bold text-display text-text-on-dark">
              Безпечний простір
            </Text>
            <View className="w-full gap-4">
              {rules.map((rule) => (
                <View key={rule.text} className="flex-row items-center gap-3">
                  <View className="size-9 items-center justify-center rounded-[18px] bg-white/[0.12]">
                    <Icon name={rule.icon} size={18} color={colors.text['on-dark']} />
                  </View>
                  <Text className="flex-1 font-inter text-body text-text-on-dark">{rule.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </>
  );

  const actions = (
    <>
      <Actions
        page={page}
        onDot={goTo}
        onNext={() => goTo(page + 1)}
        onIdToken={google.continueWithGoogle}
        onGoogleFailure={google.showSnackbar}
        googleLoading={google.loading}
        // A guest starts a new history on the catalog (01.2).
        onGuest={() => {
          setGuest(true);
          if (router.canDismiss()) router.dismissAll();
          router.replace('/');
        }}
        onOrganizations={() => router.push('/for-organizations')}
        bottom={actionsBottom}
        onHeight={setActionsHeight}
      />
    </>
  );

  if (isDesktop) {
    return (
      <View className="flex-1 flex-row bg-brand-ink">
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 overflow-hidden">
          <View
            className="absolute left-0 right-0"
            style={{
              top: DESKTOP_COLLAGE_TOP + (COLLAGE_HEIGHT * (DESKTOP_COLLAGE_SCALE - 1)) / 2,
              height: COLLAGE_HEIGHT,
              transform: [{ scale: DESKTOP_COLLAGE_SCALE }],
            }}
          >
            <EventsCollage width={window.width / 2} />
          </View>
          <CollageFade {...DESKTOP_FADE} />
          <View className="absolute bottom-[106px] left-16 right-16 gap-4">
            <Text className="font-logo text-desktop-logo text-text-on-dark">Nearby</Text>
            <Text className="max-w-[560px] font-inter-bold text-desktop-h1 tracking-[-0.16px] text-text-on-dark">
              Знаходь компанію на концерти, виставки й лекції у своєму місті
            </Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center overflow-hidden">
          {backgrounds}
          <View style={{ width: DESKTOP_COLUMN, height: window.height }}>
            {pager}
            {actions}
          </View>
        </View>
        {google.snackbar && <Snackbar {...google.snackbar} />}
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      {backgrounds}
      {pager}
      {actions}
      {google.snackbar && <Snackbar {...google.snackbar} />}
    </View>
  );
}
