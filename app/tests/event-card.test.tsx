// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { EventCard } from '@/components/ui/event-card';
import { priceLabel } from '@/price';

// The cover and the glass need native views; plain ones keep the card's own content.
jest.mock('@/components/ui/event-cover', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return { EventCover: () => <View testID="cover" /> };
});
jest.mock('@/components/ui/glass', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return { Glass: ({ children }: { children?: React.ReactNode }) => <View>{children}</View> };
});
jest.mock('expo-blur', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return { BlurTargetView: View };
});

function renderCard(price: string | undefined) {
  return render(
    <EventCard
      title="Джаз-вечір у Мистецькому Арсеналі"
      category="Концерт"
      dateLabel="Сб, 24 жовт · 19:00"
      place="Поділ"
      price={price}
      favorite={false}
      onToggleFavorite={() => {}}
    />,
  );
}

describe('EventCard', () => {
  test.each([
    { min: 450, max: null, title: 'one price' },
    { min: 300, max: 700, title: 'a range' },
    { min: 0, max: 500, title: 'a range from free' },
    { min: 0, max: null, title: 'a free event' },
  ])('shows the price tag for $title, and reads it out with the card', async ({ min, max }) => {
    const label = priceLabel(min, max);

    await renderCard(label);

    expect(label).toBeDefined();
    expect(screen.getByText(label!)).toBeTruthy();
    expect(screen.getByRole('link').props.accessibilityLabel).toBe(
      `Джаз-вечір у Мистецькому Арсеналі, Концерт, Сб, 24 жовт · 19:00, Поділ, ${label}`,
    );
  });

  test('shows no price tag for an unknown price', async () => {
    await renderCard(priceLabel(null, null));

    expect(screen.queryByText(/₴|Безкоштовно/)).toBeNull();
    expect(screen.getByRole('link').props.accessibilityLabel).toBe(
      'Джаз-вечір у Мистецькому Арсеналі, Концерт, Сб, 24 жовт · 19:00, Поділ',
    );
  });
});
