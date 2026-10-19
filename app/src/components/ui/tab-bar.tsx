// Written with the help of Claude
// AI Usage: bottom tab bar with the Figma notch for the active tab; reviewed by Daryna Halytska.
import { useState } from 'react';
import { Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { BAR_HEIGHT, tabBarPath } from '@/components/ui/tab-bar-shape';
import { Icon, type IconName } from '@/components/ui/icon';
import { colors, shadows, tabBarShadow } from '@/styles/tokens';

export type TabName = 'events' | 'map' | 'matches' | 'announcements' | 'profile';

const tabs: { name: TabName; label: string; icon: IconName }[] = [
  { name: 'events', label: 'Події', icon: 'home' },
  { name: 'map', label: 'Мапа', icon: 'pin' },
  { name: 'matches', label: 'Метчі', icon: 'matches' },
  { name: 'announcements', label: 'Оголошення', icon: 'list' },
  { name: 'profile', label: 'Профіль', icon: 'user' },
];

const SIDE_PADDING = 20;
const CIRCLE_SIZE = 56;

// A shadow that follows the drawn shape: iOS shadows the opaque pixels of a transparent view, Android 12+ and the web
// use a drop-shadow filter. Android 10 and 11 draw the bar without a shadow.
const { offsetY, blur, color } = tabBarShadow;
const shapeShadow: ViewStyle =
  Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: 0.06,
      shadowRadius: blur / 2,
    },
    android: { filter: [{ dropShadow: { offsetX: 0, offsetY, standardDeviation: blur / 2, color } }] },
    default: { filter: `drop-shadow(0px ${offsetY}px ${blur}px ${color})` },
  }) ?? {};

type Props = {
  active: TabName;
  onTabPress: (tab: TabName) => void;
};

export function TabBar({ active, onTabPress }: Props) {
  const [width, setWidth] = useState(0);
  const activeIndex = tabs.findIndex((tab) => tab.name === active);
  const tabWidth = (width - 2 * SIDE_PADDING) / tabs.length;
  const activeCenter = SIDE_PADDING + (activeIndex + 0.5) * tabWidth;

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="w-full flex-row px-5 py-3"
      style={{ height: BAR_HEIGHT }}
    >
      {width > 0 && (
        <>
          <View className="absolute left-0 top-0" style={[shapeShadow, { pointerEvents: 'none' }]}>
            <Svg width={width} height={BAR_HEIGHT}>
              <Path d={tabBarPath(width, activeCenter)} fill={colors.surface.card} />
            </Svg>
          </View>
          <View
            className="absolute rounded-full bg-brand-coral"
            style={{
              pointerEvents: 'none',
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              left: activeCenter - CIRCLE_SIZE / 2,
              top: -14,
              boxShadow: shadows.tabActive,
            }}
          />
        </>
      )}

      {tabs.map((tab) => {
        const selected = tab.name === active;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => onTabPress(tab.name)}
            className="h-12 flex-1 items-center"
          >
            {selected ? (
              // The active icon is lifted 10 px into the coral circle and has no label.
              <View style={{ marginTop: -10 }}>
                <Icon name={tab.icon} color={colors.text['on-dark']} />
              </View>
            ) : (
              <>
                <Icon name={tab.icon} color={colors.text.secondary} />
                {/* At 320 px a tab is 56 px wide, narrower than "Оголошення"; the label may overhang its tab. */}
                <View className="absolute -left-3 -right-3 top-7 items-center" style={{ pointerEvents: 'none' }}>
                  <Text numberOfLines={1} className="font-inter text-tag text-text-secondary">
                    {tab.label}
                  </Text>
                </View>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
