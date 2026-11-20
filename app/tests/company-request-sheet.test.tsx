// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ApplicationAnswers } from '@/api/applications';
import { ageRangeLabel, CompanyRequestSheet } from '@/components/matching/company-request-sheet';

const ANYONE: ApplicationAnswers = {
  desiredCompany: 'company',
  afterEventPlans: ['walk'],
  preferredGender: 'any',
  ageMin: 18,
  ageMax: null,
};

async function openSheet(initial: ApplicationAnswers = ANYONE) {
  const onSubmit = jest.fn<(answers: ApplicationAnswers) => void>();
  await render(
    <CompanyRequestSheet
      visible
      onClose={() => {}}
      eventLabel="Джаз-вечір · Сб, 18 жовт"
      initial={initial}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

const submit = () => fireEvent.press(screen.getByRole('button', { name: 'Знайти мені метч' }));

describe('CompanyRequestSheet "З ким хочеш піти?"', () => {
  test('starts with anyone of any age and sends no filter', async () => {
    const onSubmit = await openSheet();

    expect(screen.getByRole('radio', { name: 'Будь-хто' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('18–60+ років')).toBeTruthy();
    await submit();

    expect(onSubmit).toHaveBeenCalledWith({ ...ANYONE });
  });

  test('pre-fills the preferences of the application being changed', async () => {
    const onSubmit = await openSheet({ ...ANYONE, preferredGender: 'female', ageMin: 20, ageMax: 30 });

    expect(screen.getByRole('radio', { name: 'Жінка' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText('20–30 років')).toBeTruthy();
    await submit();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ preferredGender: 'female', ageMin: 20, ageMax: 30 }),
    );
  });

  test('sends the picked gender and the age range moved with the handles', async () => {
    const onSubmit = await openSheet({ ...ANYONE, ageMin: 20, ageMax: 30 });

    await fireEvent.press(screen.getByRole('radio', { name: 'Чоловік' }));
    await fireEvent(screen.getByLabelText('Вік від'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await fireEvent(screen.getByLabelText('Вік до'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    await submit();

    expect(screen.getByText('21–29 років')).toBeTruthy();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ preferredGender: 'male', ageMin: 21, ageMax: 29 }));
  });

  test('never moves the youngest age past the oldest', async () => {
    const onSubmit = await openSheet({ ...ANYONE, ageMin: 25, ageMax: 25 });

    await fireEvent(screen.getByLabelText('Вік від'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    await submit();

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ageMin: 25, ageMax: 25 }));
  });
});

describe('ageRangeLabel', () => {
  const cases: [number, number, string][] = [
    [20, 30, '20–30 років'],
    [18, 60, '18–60+ років'],
    [21, 21, '21 рік'],
    [23, 23, '23 роки'],
    [60, 60, '60+ років'],
  ];

  for (const [low, high, label] of cases) {
    test(`${low} to ${high} reads "${label}"`, () => {
      expect(ageRangeLabel(low, high)).toBe(label);
    });
  }
});
