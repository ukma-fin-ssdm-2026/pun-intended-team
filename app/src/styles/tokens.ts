// Written with the help of Claude
// AI Usage: design tokens generated from the Figma variables; reviewed by Daryna Halytska.

// Names follow the Figma variables (`brand/coral` → `colors.brand.coral`), so a token can be traced back to the design.
export const colors = {
  brand: {
    coral: '#DF544A',
    'coral-dark': '#B83E35',
    ink: '#121212',
  },
  text: {
    primary: '#121212',
    secondary: '#6B6B6B',
    'on-dark': '#FFFFFF',
    'on-dark-muted': '#CFCFCF',
  },
  surface: {
    background: '#F8F8F8',
    card: '#FFFFFF',
  },
  border: {
    default: '#EBEBE9',
  },
};

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // The "Nearby" logotype.
  logo: 'Alice_400Regular',
};

// Size and line height of the Figma text styles; the weight comes from the font family.
export const typography = {
  logo: { fontSize: 30, lineHeight: 34 },
  h1: { fontSize: 22, lineHeight: 28 },
  title: { fontSize: 16, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 13, lineHeight: 18 },
  button: { fontSize: 16, lineHeight: 20 },
  'button-sm': { fontSize: 12, lineHeight: 15 },
  tag: { fontSize: 11, lineHeight: 14 },
};

// CSS box-shadow strings; React Native supports them on iOS, Android and web (New Architecture).
export const shadows = {
  small: '0px 1px 3px rgba(13, 13, 26, 0.08)',
  medium: '0px 4px 16px rgba(13, 13, 26, 0.14)',
  button: '0px 10px 12px rgba(0, 0, 0, 0.22)',
  tabActive: '0px 0px 18px 2px rgba(223, 84, 74, 0.35), 0px 4px 10px rgba(223, 84, 74, 0.25)',
  toggleKnob: '0px 1px 3px rgba(0, 0, 0, 0.18)',
};

// The tab bar is not a rectangle, so its shadow follows the drawn shape instead of using box-shadow.
export const tabBarShadow = { offsetY: -4, blur: 16, color: 'rgba(0, 0, 0, 0.06)' };
