// Written with the help of Claude
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { EventsCollage } from '@/components/onboarding/events-collage';
import { useEvents } from '@/hooks/use-events';

import { anEvent } from './fixtures/events';

jest.mock('@/hooks/use-events', () => ({ useEvents: jest.fn() }));

function eventsResult(overrides: Partial<ReturnType<typeof useEvents>>): ReturnType<typeof useEvents> {
  return {
    data: undefined,
    loading: false,
    error: undefined,
    reload: jest.fn(),
    hasMore: false,
    loadMore: jest.fn(),
    loadingMore: false,
    loadMoreFailed: false,
    lastUpdated: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EventsCollage', () => {
  test('keeps the bundled tiles when the catalog cannot be loaded', async () => {
    jest.mocked(useEvents).mockReturnValue(eventsResult({ error: 'Could not reach the server.' }));

    await render(<EventsCollage />);

    expect(screen.queryAllByTestId(/^collage-event-/)).toHaveLength(0);
  });

  test('shows catalog events, those with an image first, and keeps bundled tiles for the rest', async () => {
    const withoutImage = anEvent('e1', 'Лекція без фото');
    const withImage = { ...anEvent('e2', 'Концерт у Кураж'), imageUrl: 'https://karabas.com/image.jpg' };
    jest.mocked(useEvents).mockReturnValue(eventsResult({ data: [withoutImage, withImage] }));

    await render(<EventsCollage />);

    const tiles = screen.getAllByTestId(/^collage-event-/).map((node) => node.props.testID);
    expect(tiles).toEqual(['collage-event-e2', 'collage-event-e1']);
    // The tiles show no titles.
    expect(screen.queryByText('Концерт у Кураж')).toBeNull();
  });
});
