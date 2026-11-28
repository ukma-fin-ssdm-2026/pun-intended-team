// Written with the help of Claude
// AI Usage: a listing's place on a map, opened from the pin chip of a post card. Figma has no frame for it, so it
// reuses the layout of "Д2.1 Новий допис · Місце на мапі" without the search and the drag; reviewed by Daryna Halytska.
// No desktop frame in Figma; layout derived from 569:9607 (DД2.1), shown as the same dialog over the feed.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { failureMessage } from '@/auth/messages';
import { DesktopRouteDialog } from '@/components/desktop/route-dialog';
import { mapsLink } from '@/components/map/maps-link';
import { PointPickerMap } from '@/components/map/point-picker-map';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Snackbar, useSnackbar } from '@/components/ui/snackbar';
import { useListing } from '@/hooks/use-listings';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { useSession } from '@/state/session';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { colors } from '@/styles/tokens';

// As on Д2.1: the back button 56 px from the top of the iPhone 14 frame (9 px below its status bar), a 34 px bottom
// padding under the card, and the 48 px pin over the map's centre, which is the place.
const BACK_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const CARD_BOTTOM = 34;
const DROP_PIN_SHADOW = '0px 6px 12px rgba(0, 0, 0, 0.25)';
const PIN_SIZE = 48;

function ListingPlaceScreenContent() {
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useSession();
  const { listing: id } = useLocalSearchParams<{ listing?: string }>();
  const { data: listing, failure, loading, notFound, reload } = useListing(id);
  const { snackbar, show } = useSnackbar();
  useStatusBarStyle('dark');

  // Only signed-in users read listings; the feed tells a guest to sign in.
  if (isGuest) return <Redirect href="/announcements" />;

  // Opened straight from a link, the screen has no history; it goes to the feed, where the post card is.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/announcements'));
  const place = listing?.place;

  const back = (
    <View className="px-5" style={{ paddingTop: Math.max(BACK_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Назад"
        onPress={goBack}
        className="size-[50px] items-center justify-center rounded-[25px] bg-surface-card"
      >
        <Icon name="arrow-left" size={20} />
      </Pressable>
    </View>
  );

  if (loading || !id) {
    return (
      <View className="flex-1 bg-surface-background">
        {back}
        <View className="flex-1 items-center justify-center">
          {id ? (
            <ActivityIndicator accessibilityLabel="Завантажуємо місце" size="large" color={colors.brand.coral} />
          ) : (
            <Text className="font-inter-semibold text-title text-text-primary">Місце не знайдено</Text>
          )}
        </View>
      </View>
    );
  }

  if (!place) {
    // A listing that is gone, or never named a place, has nothing to show.
    const missing = notFound || listing !== undefined;
    return (
      <View className="flex-1 bg-surface-background">
        {back}
        <View className="flex-1 items-center justify-center gap-4 px-5">
          <Text className="text-center font-inter-semibold text-title text-text-primary">
            {missing ? 'Місце не знайдено' : 'Не вдалося завантажити місце'}
          </Text>
          {!missing && failure && (
            <>
              <Text className="text-center font-inter text-body text-text-secondary">{failureMessage(failure)}</Text>
              <Button label="Спробувати ще раз" variant="dark" onPress={reload} />
            </>
          )}
        </View>
      </View>
    );
  }

  const openInMaps = async () => {
    try {
      await Linking.openURL(mapsLink(place.location, Platform.OS));
    } catch {
      show({ tone: 'error', title: 'Не вдалося відкрити карти', note: 'Спробуй ще раз' });
    }
  };

  return (
    <View className="flex-1 bg-[#ECECE7]">
      <PointPickerMap initial={place.location} readOnly />
      <View
        className="absolute items-center justify-center rounded-3xl border-[3px] border-surface-card bg-brand-coral"
        pointerEvents="none"
        style={{
          width: PIN_SIZE,
          height: PIN_SIZE,
          left: '50%',
          top: '50%',
          marginLeft: -PIN_SIZE / 2,
          marginTop: -PIN_SIZE / 2,
          boxShadow: DROP_PIN_SHADOW,
        }}
      >
        <Icon name="pin" size={22} color={colors.text['on-dark']} />
      </View>

      {back}

      <View
        className="absolute bottom-0 left-0 right-0 items-center gap-4 rounded-t-[28px] bg-surface-card px-5 pt-3"
        style={{ paddingBottom: Math.max(CARD_BOTTOM, insets.bottom) }}
      >
        {!isDesktop && <View className="h-1 w-10 rounded-sm bg-border-default" />}
        <View className="flex-row items-center gap-3.5 self-stretch">
          <View className="size-11 items-center justify-center rounded-[14px] bg-brand-coral">
            <Icon name="pin" size={22} color={colors.text['on-dark']} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
              {place.name}
            </Text>
            {place.address ? (
              <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
                {place.address}
              </Text>
            ) : null}
          </View>
        </View>
        <View className="self-stretch">
          <Button label="Відкрити в картах" onPress={() => void openInMaps()} />
        </View>
      </View>

      {snackbar && <Snackbar {...snackbar} />}
    </View>
  );
}

// DД2.1 on a desktop: a dialog over the page it was opened from.
export default function ListingPlaceScreen() {
  return (
    <DesktopRouteDialog fallback="/announcements">
      <ListingPlaceScreenContent />
    </DesktopRouteDialog>
  );
}
