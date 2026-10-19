// Written with the help of Claude
// AI Usage: event page from the Figma "02 Сторінка події", "02.1 · Ти вже в пошуку" and "02.2 · гість" screens, on mock
// data; reviewed by Daryna Halytska.
import { BlurTargetView } from 'expo-blur';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState, type RefObject } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { GuestDialog } from '@/components/guest-dialog';
import { CompanyRequestSheet } from '@/components/matching/company-request-sheet';
import { Button } from '@/components/ui/button';
import { CoralGradient } from '@/components/ui/coral-gradient';
import { Glass } from '@/components/ui/glass';
import { Icon, type IconName } from '@/components/ui/icon';
import { formatEventDay, formatShortDay, formatTimeRange } from '@/dates';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { findMockEvent } from '@/mocks/events';
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

function DetailRow({ icon, value, note }: { icon: IconName; value: string; note: string }) {
  return (
    <View className="flex-row items-center gap-3.5 py-3.5">
      <View className="size-10 items-center justify-center rounded-xl bg-surface-card">
        <Icon name={icon} size={20} color={colors.brand.coral} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-inter-medium text-body text-text-primary">{value}</Text>
        <Text className="font-inter text-caption text-text-secondary">{note}</Text>
      </View>
    </View>
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { isGuest } = session;
  // A guest sees the page under the sign-in dialog; closing the dialog leaves the page, as in the prototype.
  const [dialogOpen, setDialogOpen] = useState(isGuest);
  const [favorite, setFavorite] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const coverRef = useRef<View>(null);
  useStatusBarStyle('light');

  const event = findMockEvent(id);
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!event) {
    return (
      <View className="flex-1 items-center justify-center gap-4 bg-surface-background px-5">
        <Text className="font-inter-semibold text-title text-text-primary">Подію не знайдено</Text>
        <Button label="До каталогу" variant="light" onPress={() => router.replace('/')} />
      </View>
    );
  }

  // 02.1 comes from the development switch; there are no company requests yet.
  const inPool = !isGuest && session.inPool;
  const short = expanded ? undefined : preview(event.description);
  const bottomPadding = Math.max(ACTION_BAR_BOTTOM, insets.bottom);
  // 130 px in Figma: the 102 px action bar and the 28 px overlap.
  const sheetBottomPadding = ACTION_BAR_TOP + BUTTON_HEIGHT + bottomPadding + SHEET_OVERLAP;

  const openSearch = () => router.push({ pathname: '/events/[id]/search', params: { id: event.id } });

  const onAction = () => {
    if (isGuest) setDialogOpen(true);
    else if (inPool) openSearch();
    else setRequestOpen(true);
  };

  return (
    <View className="flex-1 bg-surface-background">
      <ScrollView>
        <View className="h-[340px] overflow-hidden">
          {/* What the glass buttons blur on Android; the buttons themselves stay outside. */}
          <BlurTargetView ref={coverRef} style={StyleSheet.absoluteFill}>
            {event.cover ? (
              <Image source={event.cover} contentFit="cover" style={{ width: '100%', height: '100%' }} />
            ) : (
              <CoralGradient preset="cover" />
            )}
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
              onPress={() => setFavorite((value) => !value)}
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
              note={[event.venue.address, event.district].filter(Boolean).join(' · ')}
            />
            <View className="h-px bg-border-default" />
            <DetailRow
              icon="calendar"
              value={formatEventDay(event.startsAt)}
              note={formatTimeRange(event.startsAt, event.endsAt)}
            />
            <View className="h-px bg-border-default" />
            <DetailRow icon="building" value={event.organizer} note="Організатор події" />
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

      <CompanyRequestSheet
        visible={requestOpen}
        onClose={() => setRequestOpen(false)}
        eventLabel={`${event.title} · ${formatShortDay(event.startsAt)}`}
        onSubmit={() => {
          setRequestOpen(false);
          openSearch();
        }}
      />

      <GuestDialog
        visible={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          goBack();
        }}
        onAuth={(route) => {
          setDialogOpen(false);
          router.push(route);
        }}
      />
    </View>
  );
}
