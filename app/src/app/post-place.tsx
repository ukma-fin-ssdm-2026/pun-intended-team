// Written with the help of Claude
// AI Usage: place picker from the Figma "Д2.1 Новий допис · Місце на мапі" frame; reviewed by Daryna Halytska. The
// loading and failed lookups have no Figma frame: a spinner in the card, and the name field of the venue form.
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DesktopRouteDialog } from '@/components/desktop/route-dialog';
import { MAP_SEARCH_ICON } from '@/components/map-background';
import { KYIV_CENTER, type MapPoint } from '@/components/map/kyiv';
import { PointPickerMap } from '@/components/map/point-picker-map';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SearchField } from '@/components/ui/search-field';
import { TextField } from '@/components/ui/text-field';
import { usePlaceLookup } from '@/hooks/use-place-lookup';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { pickPlace, usePickedPlace } from '@/state/post-place';
import { useSession } from '@/state/session';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { colors } from '@/styles/tokens';

// "01 Пошук": top padding 56 in the iPhone 14 frame (9 px below its status bar). "02 Обране місце" has a 34 px bottom
// padding.
const SEARCH_TOP = 56;
const GAP_BELOW_STATUS_BAR = 9;
const CARD_BOTTOM = 34;
// Figma DROP_SHADOW values (radius as the CSS blur).
const SEARCH_SHADOW = '0px 4px 14px rgba(0, 0, 0, 0.08)';
const DROP_PIN_SHADOW = '0px 6px 12px rgba(0, 0, 0, 0.25)';
// "Мітка / Обране місце": a 48 px pin. It stands over the map's centre, the point that is picked.
const PIN_SIZE = 48;
// The API's limit.
const NAME_MAX = 100;

function PostPlaceScreenContent() {
  const isDesktop = useIsDesktop();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useSession();
  const picked = usePickedPlace();
  const [query, setQuery] = useState('');
  const [point, setPoint] = useState<MapPoint>(picked?.location ?? KYIV_CENTER);
  const [typedName, setTypedName] = useState('');
  const lookup = usePlaceLookup(point);
  const loading = lookup.status === 'idle' || lookup.status === 'loading';
  // Nothing found there, or OpenStreetMap cannot be reached: the user names the place.
  const failed = lookup.status === 'not-found' || lookup.status === 'unavailable';
  useStatusBarStyle('dark');

  // The post editor is for signed-in users only, and so is the lookup.
  if (isGuest) return <Redirect href="/announcements" />;

  // Opened straight from a link, the screen has no history; it goes to the post editor on Т3, where Д2.1 comes from.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/announcements'));

  const name = lookup.place ? lookup.place.name : typedName.trim();
  const address = lookup.place ? lookup.place.address : '';
  const canPick = !loading && name.length > 0 && name.length <= NAME_MAX;

  const choose = () => {
    pickPlace({ name: name.slice(0, NAME_MAX), address, location: point });
    goBack();
  };

  return (
    <View className="flex-1 bg-[#ECECE7]">
      {/* "Перетягни мапу, щоб уточнити точку": the map moves under the pin, which stays where it is. */}
      <PointPickerMap initial={point} onMove={setPoint} />
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

      <View
        className="flex-row items-start gap-2.5 px-5"
        style={{ paddingTop: Math.max(SEARCH_TOP, insets.top + GAP_BELOW_STATUS_BAR) }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          onPress={goBack}
          className="size-[50px] items-center justify-center rounded-[25px] bg-surface-card"
        >
          <Icon name="arrow-left" size={20} />
        </Pressable>
        <View className="flex-1 rounded-2xl bg-surface-card" style={{ boxShadow: SEARCH_SHADOW }}>
          {/* Address search is not built yet: the field is shown as in Figma and finds nothing. */}
          <SearchField placeholder="Пошук адреси" value={query} onChangeText={setQuery} iconColor={MAP_SEARCH_ICON} />
        </View>
      </View>

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
            {loading ? (
              <ActivityIndicator
                accessibilityLabel="Шукаємо місце"
                size="small"
                color={colors.brand.coral}
                className="self-start"
              />
            ) : lookup.place ? (
              <>
                <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
                  {lookup.place.name}
                </Text>
                {lookup.place.address ? (
                  <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
                    {lookup.place.address}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text className="font-inter text-caption text-text-secondary">
                Не вдалося визначити місце. Назви його сам.
              </Text>
            )}
          </View>
        </View>
        {failed && (
          <View className="self-stretch">
            <TextField label="Назва місця" value={typedName} onChangeText={setTypedName} maxLength={NAME_MAX} />
          </View>
        )}
        <Text className="self-stretch font-inter text-caption text-text-secondary">
          Перетягни мапу, щоб уточнити точку
        </Text>
        {/* "Обрати місце" returns to the post editor (Д2) with the place. */}
        <View className="self-stretch">
          <Button label="Обрати місце" disabled={!canPick} onPress={choose} />
        </View>
      </View>
    </View>
  );
}

// DД2.1 on a desktop: a dialog over the page it was opened from.
export default function PostPlaceScreen() {
  return (
    <DesktopRouteDialog fallback="/announcements">
      <PostPlaceScreenContent />
    </DesktopRouteDialog>
  );
}
