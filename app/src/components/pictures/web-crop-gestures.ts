// Written with the help of Claude
// The crop preview's gestures in a browser. react-native-gesture-handler's pan and pinch do not answer a mouse there,
// so the picture follows DOM pointer and wheel events instead: drag to move, the wheel or a trackpad pinch to zoom,
// two fingers on a touch screen to pinch, and a double click to zoom in and out, as the double tap on a phone.
import { useEffect, useState, type RefObject } from 'react';

// How much one pixel of wheel turns the zoom: a mouse wheel moves about 100 px a notch, a trackpad pinch (a wheel
// event with ctrlKey in Chrome, Edge and Firefox) a few pixels at a time.
const WHEEL_STEP = 0.0015;
const PINCH_STEP = 0.01;

/** The zoom after a wheel event, kept between 1 and `max`. */
export function wheelZoom(zoom: number, deltaY: number, pinch: boolean, max: number): number {
  const next = zoom * Math.exp(-deltaY * (pinch ? PINCH_STEP : WHEEL_STEP));
  return Math.min(Math.max(next, 1), max);
}

type Handlers = {
  // A drag starts; the moves that follow are from where it started.
  onStart: () => void;
  onMove: (dx: number, dy: number) => void;
  // A two-finger pinch: the distance between the fingers over the one they started at.
  onPinch: (scale: number) => void;
  onWheel: (deltaY: number, pinch: boolean) => void;
  onDoubleClick: () => void;
};

/** Returns the ref for the View the gestures are on; react-native-web renders it as a div. */
export function useWebCropGestures(handlers: RefObject<Handlers>) {
  const [element, setElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!element) return;
    element.style.setProperty('touch-action', 'none');
    element.style.setProperty('cursor', 'grab');

    const pointers = new Map<number, { x: number; y: number }>();
    let origin = { x: 0, y: 0 };
    let spread = 0;
    const distance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    // Each change in the number of fingers starts the gesture again from where the picture is.
    const restart = () => {
      handlers.current.onStart();
      const [first] = pointers.values();
      if (first) origin = first;
      spread = pointers.size === 2 ? distance() : 0;
    };

    const down = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      element.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      element.style.setProperty('cursor', 'grabbing');
      restart();
    };
    const move = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2 && spread > 0) handlers.current.onPinch(distance() / spread);
      else if (pointers.size === 1) handlers.current.onMove(event.clientX - origin.x, event.clientY - origin.y);
    };
    const up = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return;
      if (pointers.size === 0) element.style.setProperty('cursor', 'grab');
      restart();
    };
    const wheel = (event: WheelEvent) => {
      // Keeps the page from scrolling, and a trackpad pinch from zooming the whole page.
      event.preventDefault();
      handlers.current.onWheel(event.deltaY, event.ctrlKey);
    };
    const doubleClick = () => handlers.current.onDoubleClick();
    // A mouse drag on the picture would start the browser's own image drag, which cancels the pointer after one move.
    const noNativeDrag = (event: DragEvent) => event.preventDefault();

    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('dblclick', doubleClick);
    element.addEventListener('dragstart', noNativeDrag);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('dblclick', doubleClick);
      element.removeEventListener('dragstart', noNativeDrag);
    };
  }, [element, handlers]);

  return (node: unknown) => setElement(node instanceof HTMLElement ? node : null);
}
