// Written with the help of Claude
// AI Usage: coral radial gradient from the Figma catalog header and event covers; reviewed by Daryna Halytska.
import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

// The Figma gradient fill: coral in the corner, a black band, coral again at the far edge.
const stops: [offset: number, color: string][] = [
  [0, 'rgb(217,85,80)'],
  [0.080875, 'rgb(163,64,60)'],
  [0.16175, 'rgb(109,43,40)'],
  [0.20219, 'rgb(81,32,30)'],
  [0.24263, 'rgb(54,21,20)'],
  [0.28306, 'rgb(27,11,10)'],
  [0.30328, 'rgb(14,5,5)'],
  [0.3235, 'rgb(0,0,0)'],
  [0.4586, 'rgb(0,0,0)'],
  [0.49244, 'rgb(14,5,5)'],
  [0.52628, 'rgb(27,11,10)'],
  [0.59395, 'rgb(54,21,20)'],
  [0.66163, 'rgb(81,32,30)'],
  [0.7293, 'rgb(109,43,40)'],
  [0.86465, 'rgb(163,64,60)'],
  [1, 'rgb(217,85,80)'],
];

// Frame size and gradient transform of each place the gradient is used in Figma; the drawing stretches to the view.
const presets = {
  header: { width: 390, height: 484, transform: 'matrix(46.5 76.637 -41.64 85.833 10.803 -35.526)' },
  cover: { width: 334, height: 170, transform: 'matrix(39.823 26.918 -35.661 30.148 9.2518 -12.478)' },
  // "00 Фон / Градієнт" of 04 Пошук компанії.
  search: { width: 390, height: 472, transform: 'matrix(46.5 74.736 -41.64 83.704 10.803 -34.645)' },
  // The full-screen background of 05 Запропонований метч and its states.
  screen: { width: 390, height: 844, transform: 'matrix(46.5 133.64 -41.64 149.67 10.803 -61.95)' },
  // "01 Шапка" of 07 Взаємний метч.
  mutual: { width: 390, height: 354, transform: 'matrix(46.5 56.052 -41.64 62.778 10.803 -25.984)' },
  // The 178 px header of the Метчі tab.
  tabHeader: { width: 390, height: 178, transform: 'matrix(46.5 28.185 -41.64 31.567 10.803 -13.065)' },
  // A 40 px event thumbnail without a cover.
  thumb: { width: 40, height: 40, transform: 'matrix(4.7692 6.3336 -4.2708 7.0936 1.108 -2.936)' },
};

type Props = {
  preset: keyof typeof presets;
};

// Fills its parent; position the parent.
export function CoralGradient({ preset }: Props) {
  // Several gradients can be on screen at once, and on the web their ids share one document.
  const id = `coral-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { width, height, transform } = presets[preset];

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
    >
      <Defs>
        <RadialGradient id={id} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={10} gradientTransform={transform}>
          {stops.map(([offset, color]) => (
            <Stop key={offset} offset={offset} stopColor={color} />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}
