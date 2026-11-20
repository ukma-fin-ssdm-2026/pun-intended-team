// Written with the help of Claude
import { describe, expect, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { MatchActionBar } from '@/components/matching/match-action-bar';
import { actionNotchFillPath } from '@/components/ui/tab-bar-shape';

const WIDTH = 393;

async function renderBar(label: string) {
  await render(<MatchActionBar label={label} onPress={() => {}} bottomInset={0} />);
  const bar = screen.root;
  if (!bar) throw new Error('The bar did not render');
  await fireEvent(bar, 'layout', { nativeEvent: { layout: { width: WIDTH } } });
}

// "таб бар новий": the notch is white under and around the button, so the page never shows through it.
describe('MatchActionBar', () => {
  for (const label of ['Знайти метч', 'Стежити за метчингом', 'Відкрити метч']) {
    test(`fills the notch white for "${label}"`, async () => {
      await renderBar(label);

      const fill = screen.getByTestId('action-notch-fill');
      expect(fill.props.d).toBe(actionNotchFillPath(WIDTH));
      // react-native-svg passes colours on as ARGB numbers: 0xffffffff is opaque white.
      expect(fill.props.fill).toEqual({ type: 0, payload: 0xffffffff });
    });
  }
});
