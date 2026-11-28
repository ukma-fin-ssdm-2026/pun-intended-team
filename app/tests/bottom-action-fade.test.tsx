// Written with the help of Claude
import { describe, expect, jest, test } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BottomActionFade } from '@/components/ui/bottom-action-fade';
import { Button } from '@/components/ui/button';

describe('BottomActionFade', () => {
  // As props: react-native-web drops pointerEvents from an inline style, and the fade then catches every click on the
  // content under it in a browser.
  test('passes touches outside the button through to the content under it', async () => {
    await render(
      <BottomActionFade id="fade">
        <Button label="Далі" variant="dark" />
      </BottomActionFade>,
    );

    const fade = screen.root;
    expect(fade?.props.pointerEvents).toBe('box-none');
    expect(StyleSheet.flatten(fade?.props.style).pointerEvents).toBeUndefined();
    // The gradient is a child of the box-none layer, so it has to let touches through itself.
    const gradient = fade?.children[0];
    expect(typeof gradient === 'object' && gradient?.props.pointerEvents).toBe('none');
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
