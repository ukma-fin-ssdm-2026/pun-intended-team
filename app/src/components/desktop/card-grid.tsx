// Written with the help of Claude
// AI Usage: the card grid of the Figma desktop frames ("Сітка подій"); reviewed by Daryna Halytska.
import type { ReactNode } from 'react';
import { View } from 'react-native';

// "Сітка подій": three cards in a row, 24 px apart; the last row keeps the column width.
export const GRID_COLUMNS = 3;
export const GRID_GAP = 24;

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  columns?: number;
};

export function CardGrid<T>({ items, keyOf, render, columns = GRID_COLUMNS }: Props<T>) {
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += columns) rows.push(items.slice(start, start + columns));
  return (
    <View style={{ gap: GRID_GAP }}>
      {rows.map((row) => (
        <View key={row.map(keyOf).join()} className="flex-row" style={{ gap: GRID_GAP }}>
          {row.map((item) => (
            <View key={keyOf(item)} className="flex-1">
              {render(item)}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, index) => (
            <View key={`empty-${index}`} className="flex-1" />
          ))}
        </View>
      ))}
    </View>
  );
}
