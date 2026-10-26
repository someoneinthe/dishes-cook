// Design tokens. Backgrounds match the native splash screen (app.config.ts) so startup has no flash.
const base = {
  borderWidth: 1,
  // The ring around the control focused with a TV remote or a keyboard.
  borderWidthFocus: 3,
  // Quote bars.
  borderWidthThick: 4,
  fontFamily: { mono: 'monospace' },
  gap: (multiplier: number) => multiplier * 4,
  iconSize: { lg: 24, md: 20, sm: 16 },
  opacity: { disabled: 0.5, pressed: 0.6 },
  radius: { lg: 16, md: 8 },
  // Heights: 48 = minimum touch target (Material; Apple asks for 44).
  // minText: width under which a row's text gives its line to the row's buttons.
  // maxContent: width of a screen's content on wide screens (TV), centered, so lines stay readable.
  size: {
    // The widest an ⓘ's explanation bubble gets (src/components/info-tip.tsx): a few short lines.
    bubbleMaxWidth: 320,
    // A chip's outline; its touch area is a touch target, the rest being transparent.
    chip: 36,
    maxContent: 720,
    minText: 160,
    multilineInput: 160,
    tableCell: 160,
    touchTarget: 48,
    // The menu, always shown on the left of a TV screen.
    tvMenu: 240,
  },
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
  // A secondary button whose option is on (e.g. Filters while filters apply): a light blue tint,
  // blue border and content (contrast ≥ 4.5:1).
  actionSoft: '#DBEAFE',
  background: '#FFFFFF',
  // Dividers and decorative outlines (cards, quotes, tables).
  border: '#E7E5E4',
  // The outline of controls (fields, chips, outlined buttons, choices, an off switch): their only
  // edge, so contrast with the background and the surface ≥ 3:1.
  borderStrong: '#8A8580',
  // Course icons (contrast with the background ≥ 3:1).
  courseDessert: '#BE185D',
  courseMain: '#6D28D9',
  courseStarter: '#047857',
  // Error text.
  danger: '#B91C1C',
  // Ring around the control focused with a TV remote (contrast with the background ≥ 3:1).
  focus: '#1D4ED8',
  // Menu entry icons, one color each (contrast with the background ≥ 3:1).
  menuAbout: '#0F766E',
  menuDrinks: '#0E7490',
  menuIngredients: '#C2410C',
  menuMealChoice: '#1D4ED8',
  menuRecipes: '#15803D',
  menuSettings: '#57534E',
  menuShoppingList: '#B45309',
  onAction: '#FFFFFF',
  onActionSoft: '#1D4ED8',
  // Dims the screen behind a sheet (e.g. the unit picker of the recipe form).
  overlay: 'rgba(0, 0, 0, 0.4)',
  // Season icons: a warm sun, a cold snowflake (contrast with the background ≥ 3:1).
  seasonSummer: '#B45309',
  seasonWinter: '#0369A1',
  surface: '#FAFAF9',
  text: '#1C1917',
  textMuted: '#57534E',
  // Lighter than textMuted, for secondary details (who added a recipe); contrast with the
  // background ≥ 4.5:1 (4.8:1 here).
  textSubtle: '#78716C',
};

export type ColorToken = keyof typeof lightColors;

// Every theme defines exactly the same color tokens (checked by TypeScript).
type ThemeColors = Record<ColorToken, string>;

const darkColors: ThemeColors = {
  actionDanger: '#DC2626',
  actionPrimary: '#2563EB',
  actionSoft: '#172554',
  background: '#121212',
  border: '#3A3633',
  borderStrong: '#77716C',
  courseDessert: '#F472B6',
  courseMain: '#A78BFA',
  courseStarter: '#34D399',
  danger: '#F87171',
  focus: '#60A5FA',
  menuAbout: '#2DD4BF',
  menuDrinks: '#22D3EE',
  menuIngredients: '#FB923C',
  menuMealChoice: '#60A5FA',
  menuRecipes: '#4ADE80',
  menuSettings: '#A8A29E',
  menuShoppingList: '#FBBF24',
  onAction: '#FFFFFF',
  onActionSoft: '#BFDBFE',
  overlay: 'rgba(0, 0, 0, 0.6)',
  seasonSummer: '#FBBF24',
  seasonWinter: '#38BDF8',
  surface: '#1E1E1E',
  text: '#F5F5F4',
  textMuted: '#A8A29E',
  // 5.4:1 with the background, 4.8:1 with surface.
  textSubtle: '#8F8984',
};

export const lightTheme = { ...base, colors: lightColors satisfies ThemeColors };
export const darkTheme = { ...base, colors: darkColors };
