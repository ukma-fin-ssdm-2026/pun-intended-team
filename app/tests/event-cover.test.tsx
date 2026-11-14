// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';

import { coverOf, EventCover } from '@/components/ui/event-cover';

// The props EventCover hands to expo-image, and the gradient, as plain views to look for.
jest.mock('expo-image', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return { Image: (props: object) => <View testID="cover-image" {...props} /> };
});
jest.mock('@/components/ui/coral-gradient', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return { CoralGradient: ({ preset }: { preset: string }) => <View testID={`gradient-${preset}`} /> };
});

const IMAGE_URL = 'https://artwizard.io/cdn-cgi/imagedelivery/x/77cb1aba/public';

describe('EventCover', () => {
  test('shows a linked image, cached in memory and on disk', async () => {
    await render(<EventCover cover={coverOf(IMAGE_URL)} />);

    const image = screen.getByTestId('cover-image');
    expect(image.props.source).toEqual({ uri: IMAGE_URL });
    expect(image.props.cachePolicy).toBe('memory-disk');
  });

  test('shows the gradient instead of an image that fails to load', async () => {
    await render(<EventCover cover={coverOf(IMAGE_URL)} gradient="thumb" />);

    await act(() => screen.getByTestId('cover-image').props.onError({ error: 'HTTP 404' }));

    expect(screen.queryByTestId('cover-image')).toBeNull();
    expect(screen.getByTestId('gradient-thumb')).toBeTruthy();
  });

  test('tries a new image again after an earlier one failed', async () => {
    const { rerender } = await render(<EventCover cover={coverOf(IMAGE_URL)} />);
    await act(() => screen.getByTestId('cover-image').props.onError({ error: 'HTTP 404' }));

    await rerender(<EventCover cover={coverOf(`${IMAGE_URL}?v=2`)} />);

    expect(screen.getByTestId('cover-image')).toBeTruthy();
  });

  test('shows the gradient for an event without an image', async () => {
    await render(<EventCover cover={coverOf(null)} />);

    expect(screen.getByTestId('gradient-cover')).toBeTruthy();
  });
});
