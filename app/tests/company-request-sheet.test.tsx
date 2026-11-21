// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { ApplicationAnswers } from '@/api/applications';
import { ageRangeLabel, CompanyRequestSheet } from '@/components/matching/company-request-sheet';
import { activeTrackFrame, handleOffset } from '@/components/ui/range-slider';

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

// The 350 px slider of the 390 px frame: the handles travel 326 px over 42 years, about 7.76 px a year.
const SLIDER_WIDTH = 350;
const PX_PER_YEAR = (SLIDER_WIDTH - 24) / (60 - 18);

async function layOutSlider() {
  await fireEvent(screen.getByTestId('range-slider'), 'layout', { nativeEvent: { layout: { width: SLIDER_WIDTH } } });
}

async function drag(handle: 'low' | 'high', translationX: number) {
  await act(() =>
    fireGestureHandler(getByGestureTestId(`range-slider-${handle}`), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: translationX / 2 },
      { state: State.ACTIVE, translationX },
      { state: State.END, translationX },
    ]),
  );
}

// Figma 03: the sheet sits at the bottom of the screen. The overlay aligns it there; a wrapper between them that grows
// to the full height, such as gesture handler's root view with its default flex: 1, would pin it to the top instead.
test('CompanyRequestSheet stays at the bottom of the overlay', async () => {
  await openSheet();

  const growing: string[] = [];
  let node = screen.getByText('Що ти шукаєш?').parent;
  while (node) {
    // Jest leaves NativeWind's classes as they are, so both the classes and the styles are read.
    const style = StyleSheet.flatten(node.props.style) ?? {};
    const classes: string[] = node.props.className?.split(' ') ?? [];
    if (style.justifyContent === 'flex-end' || classes.includes('justify-end')) break;
    if (style.flex === 1 || (style.flexGrow ?? 0) > 0 || classes.includes('flex-1')) growing.push(String(node.type));
    node = node.parent;
  }

  expect(node).toBeTruthy();
  expect(growing).toEqual([]);
});

// Figma "03 Запит на компанію" no longer has the "1-2-3" steps between the answers and the button.
test('CompanyRequestSheet shows no steps block', async () => {
  await openSheet();

  expect(screen.queryByText('Гайда на подію!')).toBeNull();
  expect(screen.queryByText('Підберемо тобі компанію')).toBeNull();
});

describe('CompanyRequestSheet age slider', () => {
  test('dragging the max handle from "60+" gives a bounded range', async () => {
    const onSubmit = await openSheet();
    await layOutSlider();

    await drag('high', -30 * PX_PER_YEAR);
    await submit();

    expect(screen.getByText('18–30 років')).toBeTruthy();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ageMin: 18, ageMax: 30 }));
  });

  test('dragging the max handle back to the end sends no upper bound', async () => {
    const onSubmit = await openSheet({ ...ANYONE, ageMin: 25, ageMax: 30 });
    await layOutSlider();

    await drag('high', 400);
    await submit();

    expect(screen.getByText('25–60+ років')).toBeTruthy();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ageMin: 25, ageMax: null }));
  });

  test('dragging the min handle stops at the max handle', async () => {
    const onSubmit = await openSheet({ ...ANYONE, ageMin: 20, ageMax: 30 });
    await layOutSlider();

    await drag('low', 300);
    await submit();

    expect(screen.getByText('30 років')).toBeTruthy();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ageMin: 30, ageMax: 30 }));
  });
});

// "Обраний діапазон": coral from the centre of the min handle to the centre of the max one.
describe('active track', () => {
  const frame = (low: number, high: number) =>
    activeTrackFrame(handleOffset(low, 18, 60, SLIDER_WIDTH), handleOffset(high, 18, 60, SLIDER_WIDTH));

  test('runs from 28 px, 77 px wide, for 20–30 on the 350 px Figma slider', () => {
    const { left, width } = frame(20, 30);

    expect(Math.round(left)).toBe(28);
    expect(Math.abs(width - 77)).toBeLessThan(1);
  });

  test('reaches the centre of the end handle at "60+"', () => {
    const { left, width } = frame(25, 60);

    expect(left + width).toBeCloseTo(SLIDER_WIDTH - 12, 5);
  });

  test('has no length when both handles are on one age', () => {
    expect(frame(30, 30).width).toBe(0);
  });

  test('is drawn coral over the grey track', async () => {
    await openSheet({ ...ANYONE, ageMin: 20, ageMax: 30 });

    const style = StyleSheet.flatten(screen.getByTestId('range-slider-active').props.style);
    expect(style).toMatchObject({ position: 'absolute', backgroundColor: '#DF544A', height: 4 });
  });
});

describe('ageRangeLabel', () => {
  const cases: [number, number | null, string][] = [
    [20, 30, '20–30 років'],
    [18, null, '18–60+ років'],
    [25, null, '25–60+ років'],
    [60, null, '60+ років'],
    [21, 21, '21 рік'],
    [23, 23, '23 роки'],
    [30, 30, '30 років'],
  ];

  for (const [low, high, label] of cases) {
    test(`${low} to ${high ?? 'no upper bound'} reads "${label}"`, () => {
      expect(ageRangeLabel(low, high)).toBe(label);
    });
  }
});
