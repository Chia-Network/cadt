const hexToRgba = (hex, opacity) => {
  opacity = opacity || 1;
  hex = hex.replace(/[^0-9A-F]/gi, '');
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return `rgba(${[r, g, b, opacity].join(',')})`;
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
 * Values should be hex values and not rgb/rgba
 * https://material.io/design/color/the-color-system.html#tools-for-picking-colors
 * @type {ThemeVariant}
 */
const colors = {
  light: {
    // The color displayed most frequently across the app screens
    primary: 'NOT USED',
    primaryVarient: 'NOT USED',
    // Secondary color provides more ways to accent and distinguish the app
    secondary: 'NOT USED',
    secondaryVarient: 'NOT USED',
    // appears behind scrollable content
    background: '#fafafa',
    // affect surfaces of componennts such as cards sheets and menus
    surface: '#ffffff',
    surfaceShadow:
      '0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%);',
    //"On" colors
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
    //(such as primary color) with the prefix "on."
    //
    // "On" colors are primarily applied to text, iconography, and strokes.
    // Sometimes, they are applied to surfaces.
    onPrimary: '#00000',
    onSecondary: '#00000',
    onSurfacePrimaryVarient: '#f9f9f9',
    onSurfaceSecondaryVarient: '#eeeeee',
    onBackground: '#757575',
    onSurface: '#212121',
    onError: '#00000',
    status: {
      error: '#dc3546',
      warning: '#f7c93e',
      ok: '#3AAC59',
    },
  },
  dark: {
    primary: 'NOT USED',
    primaryVarient: 'NOT USED',
    secondary: 'NOT USED',
    secondaryVarient: 'NOT USED',
    background: '#303030',
    surface: '#424242',
    surfaceShadow:
      '0px 2px 1px -1px rgb(0 0 0 / 20%), 0px 1px 1px 0px rgb(0 0 0 / 14%), 0px 1px 3px 0px rgb(0 0 0 / 12%);',
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',
    onBackground: '#ffffff',
    onSurface: '#ffffff',
    onSurfacePrimaryVarient: '#515151',
    onSurfaceSecondaryVarient: '#202020',
    onError: '#ffffff',
    status: {
      error: '#dc3546',
      warning: '#f7c93e',
      ok: '#3AAC59',
    },
  },
};

const typography = {
  primary: "'Roboto', 'Helvetica', 'Arial', 'sans-serif'",
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
