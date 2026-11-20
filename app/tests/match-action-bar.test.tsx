// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MatchActionBar } from '@/components/matching/match-action-bar';
import { actionNotchFillPath } from '@/components/ui/tab-bar-shape';

const WIDTH = 393;

async function renderBar(label: string, icon = false) {
  await render(<MatchActionBar label={label} icon={icon} onPress={() => {}} bottomInset={0} />);
  const bar = screen.root;
  if (!bar) throw new Error('The bar did not render');
  await fireEvent(bar, 'layout', { nativeEvent: { layout: { width: WIDTH } } });
}

// "таб бар новий": the notch is white under and around the button, so the page never shows through it.
describe('MatchActionBar', () => {
  // The 232 px "Знайти мені метч" of "таб бар новий", and the 266 px label-only pill of "таб бар 2".
  const states = [
    { label: 'Знайти метч', icon: true, buttonWidth: 232 },
    { label: 'Стежити за метчингом', icon: false, buttonWidth: 266 },
    { label: 'Відкрити метч', icon: false, buttonWidth: 266 },
  ];

  for (const { label, icon, buttonWidth } of states) {
    test(`fills the notch around "${label}" white`, async () => {
      await renderBar(label, icon);

      const fill = screen.getByTestId('action-notch-fill');
      expect(fill.props.d).toBe(actionNotchFillPath(WIDTH, buttonWidth));
      // react-native-svg passes colours on as ARGB numbers: 0xffffffff is opaque white.
      expect(fill.props.fill).toEqual({ type: 0, payload: 0xffffffff });
    });
  }

  test('draws the notch around the button as it is laid out', async () => {
    await renderBar('Стежити за метчингом');

    await fireEvent(screen.getByRole('button', { name: 'Стежити за метчингом' }).parent!, 'layout', {
      nativeEvent: { layout: { width: 300 } },
    });

    expect(screen.getByTestId('action-notch-fill').props.d).toBe(actionNotchFillPath(WIDTH, 300));
  });

  test('shows the orbit icon with "Знайти метч" only', async () => {
    await renderBar('Знайти метч', true);
    const withIcon = screen.toJSON();
    await renderBar('Відкрити метч');

    expect(JSON.stringify(withIcon)).toContain('tail-1');
    expect(JSON.stringify(screen.toJSON())).not.toContain('tail-1');
  });
});
