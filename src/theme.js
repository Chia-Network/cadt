const black = '#000000';
const darkestGrey = '#727272';
const darkGrey = '#999999';
const grey = '#cccccc';
const lightGrey = '#D9D9D9';
const lightestGrey = '#F5F5F5';
const white = '#FFFFFF';
const accent = '#DD2288';

const hexToRgba = (hex, opacity) => {
  opacity = opacity || 1;
  hex = hex.replace(/[^0-9A-F]/gi, '');
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return [r, g, b, opacity].join(',');
};

const headings = {
  xs: '10px',
  sm: '12px',
  md: '14px',
  lg: '36px',
  xl: '43px',
  xxl: '60px',
};

/**
 * https://material.io/design/color/the-color-system.html#tools-for-picking-colors
 * @type {ThemeVariant}
 */
const colors = {
  common: {
    black,
    darkestGrey,
    darkGrey,
    grey,
    lightGrey,
    lightestGrey,
    white,
    accent,
  },
  light: {
    // The color displayed most frequently across the app screens
    primary: '#6200EE',
    primaryVarient: '#3700B3',
    // Secondary color provides more ways to accent and distinguish the app
    secondary: '#03DAC6',
    secondaryVarient: '#018786',
    // appears behind scrollable content
    background: '#FFFFFF',
    // affect surfaces of componennts such as cards sheets and menus
    surface: '#FFFFFF',
    // indicates errors in components
    error: '#B00020',
    errorVarient: 'rgba(187, 34, 136, 0.05)',
    // "On" colors
    // App surfaces use colors from specific categories in your color palette,
    // such as a primary color. Whenever elements, such as text or icons, appear in
    // front of those surfaces, those elements should use colors designed to be clear
    // and legible against the colors behind them.
    //
    // This category of colors is called "on" colors, referring to the fact that
    // they color elements that appear "on" top of surfaces that use the following
    // colors: a primary color, secondary color, surface color, background color,
    // or error color. When a color appears "on" top of a primary color, it's called
    // an "on primary color." They are labelled using the original color category
    // (such as primary color) with the prefix "on."
    //
    // "On" colors are primarily applied to text, iconography, and strokes.
    // Sometimes, they are applied to surfaces.
    onPrimary: '#FFFFFF',
    onSecondary: '#00000',
    onBackground: '#00000',
    onSurface: '#00000',
    onError: '#FFFFFF',
  },
  dark: {
    primary: '6200EE',
    primaryVarient: '#3700B3',
    secondary: '#03DAC6',
    secondaryVarient: '#018786',
    background: '#FFFFF',
    surface: '#121212',
    error: '#B00020',
    errorVarient: 'rgba(187, 34, 136, 0.05)',
    onPrimary: '#FFFFFF',
    onSecondary: '#00000',
    onBackground: '#00000',
    onSurface: '#00000',
    onError: '#FFFFFF',
  },
};

const typography = {
  primary: 'Arial',
  primaryVariant: 'Arial',
  secondary: 'Arial',
  secondaryVarient: 'Arial',
  tertiary: 'Arial',
  tertiaryVarient: 'Arial',
};

const theme = {
  colors,
  headings,
  typography,
  hexToRgba,
};

export default theme;
