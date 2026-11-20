// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { GenderField, genderFields, isGenderComplete, type GenderAnswer } from '@/components/profile/profile-form';

// expo-router is not needed by the field, only by the module's other parts.
jest.mock('expo-router', () => ({ useRouter: () => ({}), useFocusEffect: () => {} }));

function Field({ initial = { gender: null, description: '' } }: { initial?: GenderAnswer }) {
  const [value, setValue] = useState<GenderAnswer>(initial);
  return <GenderField value={value} onChange={setValue} />;
}

describe('GenderField', () => {
  test('marks the picked gender', async () => {
    await render(<Field />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Чоловік' }));

    expect(screen.getByRole('radio', { name: 'Чоловік' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByLabelText('Свій гендер')).toBeNull();
  });

  test('"Інше" asks for the user’s own words and says so when they are left empty', async () => {
    await render(<Field />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Інше' }));
    const input = screen.getByLabelText('Свій гендер');
    await fireEvent(input, 'blur');

    expect(input.props.placeholder).toBe('Введи свою відповідь');
    expect(screen.getByText('Впиши, як ти себе визначаєш')).toBeTruthy();
  });

  test('"Інше" with words shows no error', async () => {
    await render(<Field />);

    await fireEvent.press(screen.getByRole('radio', { name: 'Інше' }));
    await fireEvent.changeText(screen.getByLabelText('Свій гендер'), 'Небінарна людина');
    await fireEvent(screen.getByLabelText('Свій гендер'), 'blur');

    expect(screen.queryByText('Впиши, як ти себе визначаєш')).toBeNull();
  });
});

describe('isGenderComplete', () => {
  const cases: { answer: GenderAnswer; complete: boolean }[] = [
    { answer: { gender: null, description: '' }, complete: false },
    { answer: { gender: 'female', description: '' }, complete: true },
    { answer: { gender: 'male', description: '' }, complete: true },
    { answer: { gender: 'other', description: '   ' }, complete: false },
    { answer: { gender: 'other', description: 'Небінарна людина' }, complete: true },
  ];

  for (const { answer, complete } of cases) {
    test(`${answer.gender ?? 'none'} with "${answer.description}" is ${complete ? '' : 'not '}complete`, () => {
      expect(isGenderComplete(answer)).toBe(complete);
    });
  }
});

describe('genderFields', () => {
  test('sends the trimmed words only with "other"', () => {
    expect(genderFields({ gender: 'other', description: ' Небінарна людина ' })).toEqual({
      gender: 'other',
      genderDescription: 'Небінарна людина',
    });
    expect(genderFields({ gender: 'female', description: 'leftover' })).toEqual({ gender: 'female' });
    expect(genderFields({ gender: null, description: '' })).toEqual({});
  });
});
