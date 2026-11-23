// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { EventCard } from '@/components/ui/event-card';

// The cover needs native views; a plain one keeps the card's own content.
jest.mock('@/components/ui/event-cover', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return { EventCover: () => <View testID="cover" /> };
});

const LONG_TITLE = 'Благодійний концерт хорової капели НаУКМА «Почайна» пам’яті героїв-могилянців';

function renderCard({
  title = 'Джаз-вечір у Мистецькому Арсеналі',
  favorite = false,
}: {
  title?: string;
  favorite?: boolean;
}) {
  return render(
    <EventCard
      title={title}
      category="Концерт"
      dateLabel="Сб, 24 жовт · 19:00"
      place="Поділ"
      favorite={favorite}
      onToggleFavorite={() => {}}
    />,
  );
}

describe('EventCard', () => {
  test('shows the title in two lines at most', async () => {
    await renderCard({ title: LONG_TITLE });

    expect(screen.getByText(LONG_TITLE).props.numberOfLines).toBe(2);
  });

  test('keeps the full title in its accessibility label', async () => {
    await renderCard({ title: LONG_TITLE });

    expect(screen.getByRole('link').props.accessibilityLabel).toContain(LONG_TITLE);
  });

  // The price is on the event page only.
  test('reads out the title, category, date and place, without a price', async () => {
    await renderCard({});

    expect(screen.queryByText(/₴|Безкоштовно/)).toBeNull();
    expect(screen.getByRole('link').props.accessibilityLabel).toBe(
      'Джаз-вечір у Мистецькому Арсеналі, Концерт, Сб, 24 жовт · 19:00, Поділ',
    );
  });

  test.each([false, true])(
    'keeps the heart a button with its label and state when favorite is %s',
    async (favorite) => {
      await renderCard({ favorite });

      const heart = screen.getByRole('button', { name: 'В обране' });
      expect(heart.props.accessibilityState).toEqual({ selected: favorite });
    },
  );
});
