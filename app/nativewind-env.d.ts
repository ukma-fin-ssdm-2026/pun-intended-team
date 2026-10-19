// Written with the help of Claude
// AI Usage: type declarations for NativeWind classes and SVG imports; reviewed by Daryna Halytska.
/// <reference types="nativewind/types" />

declare module '*.svg' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: FC<SvgProps>;
  export default content;
}
