// Design tokens. Backgrounds match the native splash screen (app.config.ts) so startup has no flash.
const base = {
  borderWidth: 1,
  // Quote bars.
  borderWidthThick: 4,
  fontFamily: { mono: 'monospace' },
  gap: (multiplier: number) => multiplier * 4,
  iconSize: { lg: 24, md: 20, sm: 16 },
  opacity: { disabled: 0.5, pressed: 0.6 },
  radius: { lg: 16, md: 8, sm: 4 },
  // Heights: 44 = minimum touch target (Material/Apple guidelines).
  // minText: width under which a row's text gives its line to the row's buttons.
  size: { chip: 36, minText: 160, multilineInput: 160, tableCell: 160, touchTarget: 44 },
  typography: {
    body: { fontSize: 16, lineHeight: 24 },
    caption: { fontSize: 13, lineHeight: 18 },
    // Android's header title.
    headerTitle: { fontSize: 20, fontWeight: '500', lineHeight: 28 },
    label: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
    subtitle: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
    title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  },
} as const;

const lightColors = {
  // Buttons and selected controls (CONTRIBUTING › Buttons): blue; deletions red; white text/icons.
  // Contrast with white ≥ 4.5:1 in both themes.
  actionDanger: '#B91C1C',
  actionPrimary: '#1D4ED8',
  background: '#FFFFFF',
  border: '#E7E5E4',
  // Course icons (contrast with the background ≥ 3:1).
  courseDessert: '#BE185D',
  courseMain: '#6D28D9',
  courseStarter: '#047857',
  // Error text.
  danger: '#B91C1C',
  // Menu entry icons, one color each (contrast with the background ≥ 3:1).
  menuIngredients: '#C2410C',
  menuMealChoice: '#1D4ED8',
  menuRecipes: '#15803D',
  menuSettings: '#57534E',
  onAction: '#FFFFFF',
  // Season icons: a warm sun, a cold snowflake (contrast with the background ≥ 3:1).
  seasonSummer: '#B45309',
  seasonWinter: '#0369A1',
  surface: '#FAFAF9',
  text: '#1C1917',
  textMuted: '#57534E',
};

export type ColorToken = keyof typeof lightColors;

// Every theme defines exactly the same color tokens (checked by TypeScript).
type ThemeColors = Record<ColorToken, string>;

const darkColors: ThemeColors = {
  actionDanger: '#DC2626',
  actionPrimary: '#2563EB',
  background: '#121212',
  border: '#3A3633',
  courseDessert: '#F472B6',
  courseMain: '#A78BFA',
  courseStarter: '#34D399',
  danger: '#F87171',
  menuIngredients: '#FB923C',
  menuMealChoice: '#60A5FA',
  menuRecipes: '#4ADE80',
  menuSettings: '#A8A29E',
  onAction: '#FFFFFF',
  seasonSummer: '#FBBF24',
  seasonWinter: '#38BDF8',
  surface: '#1E1E1E',
  text: '#F5F5F4',
  textMuted: '#A8A29E',
};

export const lightTheme = { ...base, colors: lightColors satisfies ThemeColors };
export const darkTheme = { ...base, colors: darkColors };
