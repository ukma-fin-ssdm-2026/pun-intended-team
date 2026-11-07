// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { InterestPicker } from '@/components/profile/profile-form';

const options = [
  { id: 'films', name: 'Кіно', group: 'Культура' },
  { id: 'hiking', name: 'Походи', group: 'Активний відпочинок' },
];

describe('InterestPicker', () => {
  test('toggles an interest and opens the full list', async () => {
    const onToggle = jest.fn();
    const onMore = jest.fn();
    await render(
      <InterestPicker options={options} selected={['films']} onToggle={onToggle} note="обрано 1" onMore={onMore} />,
    );

    expect(screen.getByRole('checkbox', { name: 'Кіно' })).toBeChecked();
    await fireEvent.press(screen.getByText('Походи'));
    await fireEvent.press(screen.getByText('+ ще'));

    expect(onToggle).toHaveBeenCalledWith('hiking');
    expect(onMore).toHaveBeenCalled();
  });
});
