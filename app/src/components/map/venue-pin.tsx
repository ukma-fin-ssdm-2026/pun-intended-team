// Written with the help of Claude
import { Text, View } from 'react-native';

import { PIN_SIZE, SELECTED_PIN_SIZE } from './venue-map-props';

// Figma DROP_SHADOW values (radius as the CSS blur).
const PIN_SHADOW = '0px 4px 10px rgba(0, 0, 0, 0.2)';

/** A venue pin of Т1 on the native map: the number of events in an ink circle, coral when selected. */
export function VenuePinView({ count, selected }: { count: number; selected: boolean }) {
  const size = selected ? SELECTED_PIN_SIZE : PIN_SIZE;
  return (
    <View
      className={`items-center justify-center border-[3px] border-white ${selected ? 'bg-brand-coral' : 'bg-brand-ink'}`}
      style={{ width: size, height: size, borderRadius: size / 2, boxShadow: PIN_SHADOW }}
    >
      <Text className="font-inter-medium text-label text-text-on-dark">{count}</Text>
    </View>
  );
}
