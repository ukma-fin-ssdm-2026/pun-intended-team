// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SafetyRequiredDialog } from '@/components/matching/safety-required-dialog';
import { SafetySheet } from '@/components/matching/safety-sheet';

// FR-032, SAFE-002
describe('SafetySheet', () => {
  test('on a match, names the person and points to the profile', async () => {
    const onConfirm = jest.fn();
    await render(<SafetySheet visible person={{ name: 'Олена' }} onClose={jest.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText(/Олена теж хоче піти разом!/)).toBeOnTheScreen();
    expect(screen.getByText('Памʼятка завжди є в «Профіль → Безпека»')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Зрозуміло' }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  test('passes on "Більше не показувати" when it is ticked', async () => {
    const onConfirm = jest.fn();
    await render(<SafetySheet visible person={{ name: 'Олена' }} onClose={jest.fn()} onConfirm={onConfirm} />);

    await fireEvent.press(screen.getByRole('checkbox'));
    await fireEvent.press(screen.getByRole('button', { name: 'Зрозуміло' }));

    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  test('from the profile, shows the rules without a person', async () => {
    await render(<SafetySheet visible onClose={jest.fn()} onConfirm={jest.fn()} />);

    expect(screen.getByText('Кілька простих правил для зустрічі з новими людьми.')).toBeOnTheScreen();
    expect(screen.queryByText('Памʼятка завжди є в «Профіль → Безпека»')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('SafetyRequiredDialog', () => {
  test('offers only to read the notice', async () => {
    const onRead = jest.fn();
    await render(<SafetyRequiredDialog visible onRead={onRead} onClose={jest.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Прочитати памʼятку' }));
    expect(onRead).toHaveBeenCalledTimes(1);
  });
});
