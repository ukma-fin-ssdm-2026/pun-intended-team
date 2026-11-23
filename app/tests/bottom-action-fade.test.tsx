// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BottomActionFade } from '@/components/ui/bottom-action-fade';
import { Button } from '@/components/ui/button';

describe('BottomActionFade', () => {
  test('passes touches outside the button through to the content under it', async () => {
    await render(
      <BottomActionFade id="fade">
        <Button label="Далі" variant="dark" />
      </BottomActionFade>,
    );

    const fade = screen.root;
    expect(StyleSheet.flatten(fade?.props.style).pointerEvents).toBe('box-none');
  });

  test('keeps the button pressable', async () => {
    const onPress = jest.fn();
    await render(
      <BottomActionFade id="fade">
        <Button label="Далі" variant="dark" onPress={onPress} />
      </BottomActionFade>,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Далі' }));

    expect(onPress).toHaveBeenCalled();
  });
});
