// Design tokens. Backgrounds match the native splash screen (app.config.ts) so startup has no flash.
const base = {
  borderWidth: 1,
  gap: (multiplier: number) => multiplier * 4,
  iconSize: { md: 20, sm: 16 },
  opacity: { disabled: 0.5, pressed: 0.6 },
  radius: { lg: 16, md: 8, sm: 4 },
  // Heights: 44 = minimum touch target (Material/Apple guidelines).
  // minText: width under which a row's text gives its line to the row's buttons.
  size: { chip: 36, minText: 160, multilineInput: 160, touchTarget: 44 },
  typography: {
    body: { fontSize: 16, lineHeight: 24 },
    caption: { fontSize: 13, lineHeight: 18 },
    label: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
    subtitle: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
    title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  },
} as const;

const lightColors = {
  // Buttons (CONTRIBUTING › Buttons): primary actions blue, deletions red, white text and icon.
  // Contrast with white ≥ 4.5:1 in both themes.
  actionDanger: '#B91C1C',
  actionPrimary: '#1D4ED8',
  background: '#FFFFFF',
  border: '#E7E5E4',
  // Error text.
  danger: '#B91C1C',
  onAction: '#FFFFFF',
  onPrimary: '#FFFFFF',
  primary: '#C2410C',
  surface: '#FAFAF9',
  text: '#1C1917',
  textMuted: '#57534E',
};

// Every theme defines exactly the same color tokens (checked by TypeScript).
type ThemeColors = Record<keyof typeof lightColors, string>;

const darkColors: ThemeColors = {
  actionDanger: '#DC2626',
  actionPrimary: '#2563EB',
  background: '#121212',
  border: '#3A3633',
  danger: '#F87171',
  onAction: '#FFFFFF',
  onPrimary: '#1C1917',
  primary: '#FB923C',
  surface: '#1E1E1E',
  text: '#F5F5F4',
  textMuted: '#A8A29E',
};

export const lightTheme = { ...base, colors: lightColors satisfies ThemeColors };
export const darkTheme = { ...base, colors: darkColors };
