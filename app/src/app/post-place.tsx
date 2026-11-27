// Written with the help of Claude
// AI Usage: place picker from the Figma "Д2.1 Новий допис · Місце на мапі" frame; reviewed by Daryna Halytska. The
// loading and failed lookups have no Figma frame: a spinner in the card, and the name field of the venue form.
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describePlace } from '@/api/places';
import { MAP_SEARCH_ICON } from '@/components/map-background';
import { KYIV_CENTER, type MapPoint } from '@/components/map/kyiv';
import { PointPickerMap } from '@/components/map/point-picker-map';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { SearchField } from '@/components/ui/search-field';
import { TextField } from '@/components/ui/text-field';
import { useStatusBarStyle } from '@/hooks/use-status-bar-style';
import { pickPlace, usePickedPlace } from '@/state/post-place';
import { useSession } from '@/state/session';
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
// The map is asked about its centre once it has rested this long, so a drag does not send a request per stop.
const LOOKUP_DELAY_MS = 600;
// The API's limit.
const NAME_MAX = 100;

type Lookup =
  | { state: 'loading' }
  | { state: 'found'; name: string; address: string }
  // Nothing found there, or OpenStreetMap cannot be reached: the user names the place.
  | { state: 'failed' };

export default function PostPlaceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isGuest } = useSession();
  const picked = usePickedPlace();
  const [query, setQuery] = useState('');
  const [point, setPoint] = useState<MapPoint>(picked?.location ?? KYIV_CENTER);
  // The answer for a point; while the latest point has none, the card shows the spinner.
  const [answer, setAnswer] = useState<{ point: MapPoint; lookup: Lookup }>();
  const [typedName, setTypedName] = useState('');
  // Only the answer for the latest point is shown.
  const latest = useRef(0);
  useStatusBarStyle('dark');

  useEffect(() => {
    const request = ++latest.current;
    const timer = setTimeout(() => {
      void describePlace(point).then((result) => {
        if (request !== latest.current) return;
        setAnswer({ point, lookup: result.ok ? { state: 'found', ...result.data } : { state: 'failed' } });
      });
    }, LOOKUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [point]);
  const lookup: Lookup = answer?.point === point ? answer.lookup : { state: 'loading' };

  // The post editor is for signed-in users only, and so is the lookup.
  if (isGuest) return <Redirect href="/announcements" />;

  // Opened straight from a link, the screen has no history; it goes to the post editor on Т3, where Д2.1 comes from.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/announcements'));

  const name = lookup.state === 'found' ? lookup.name : typedName.trim();
  const address = lookup.state === 'found' ? lookup.address : '';
  const canPick = lookup.state !== 'loading' && name.length > 0 && name.length <= NAME_MAX;

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
        style={{
          width: PIN_SIZE,
          height: PIN_SIZE,
          left: '50%',
          top: '50%',
          marginLeft: -PIN_SIZE / 2,
          marginTop: -PIN_SIZE / 2,
          boxShadow: DROP_PIN_SHADOW,
          pointerEvents: 'none',
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
        <View className="h-1 w-10 rounded-sm bg-border-default" />
        <View className="flex-row items-center gap-3.5 self-stretch">
          <View className="size-11 items-center justify-center rounded-[14px] bg-brand-coral">
            <Icon name="pin" size={22} color={colors.text['on-dark']} />
          </View>
          <View className="flex-1 gap-0.5">
            {lookup.state === 'loading' ? (
              <ActivityIndicator
                accessibilityLabel="Шукаємо місце"
                size="small"
                color={colors.brand.coral}
                className="self-start"
              />
            ) : lookup.state === 'found' ? (
              <>
                <Text numberOfLines={1} className="font-inter-medium text-body text-text-primary">
                  {lookup.name}
                </Text>
                {lookup.address ? (
                  <Text numberOfLines={1} className="font-inter text-caption text-text-secondary">
                    {lookup.address}
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
        {lookup.state === 'failed' && (
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
