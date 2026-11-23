// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { EventCard } from '@/components/ui/event-card';

// The cover and the glass need native views; neither is about the title.
jest.mock('@/components/ui/event-cover', () => ({ EventCover: () => null }));

const LONG_TITLE = 'Благодійний концерт хорової капели НаУКМА «Почайна» пам’яті героїв-могилянців';

describe('EventCard', () => {
  test('shows the title in two lines at most', async () => {
    await render(
      <EventCard
        title={LONG_TITLE}
        category="Концерти"
        dateLabel="Сб, 24 жовт · 19:00"
        place="Мистецький Арсенал"
        favorite={false}
        onToggleFavorite={() => {}}
      />,
    );

    expect(screen.getByText(LONG_TITLE).props.numberOfLines).toBe(2);
  });

  test('keeps the full title in its accessibility label', async () => {
    await render(
      <EventCard
        title={LONG_TITLE}
        category="Концерти"
        dateLabel="Сб, 24 жовт · 19:00"
        place="Мистецький Арсенал"
        favorite={false}
        onToggleFavorite={() => {}}
      />,
    );

    expect(screen.getByRole('link').props.accessibilityLabel).toContain(LONG_TITLE);
  });
});
