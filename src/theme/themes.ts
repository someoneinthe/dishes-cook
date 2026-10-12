// Design tokens. Backgrounds match the native splash screen (app.config.ts) so startup has no flash.
const base = {
  gap: (multiplier: number) => multiplier * 4,
  radius: { lg: 16, md: 8, sm: 4 },
  typography: {
    body: { fontSize: 16, lineHeight: 24 },
    caption: { fontSize: 13, lineHeight: 18 },
    title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  },
} as const;

const lightColors = {
  background: '#FFFFFF',
  border: '#E7E5E4',
  onPrimary: '#FFFFFF',
  primary: '#C2410C',
  surface: '#FAFAF9',
  text: '#1C1917',
  textMuted: '#57534E',
};

// Every theme defines exactly the same color tokens (checked by TypeScript).
type ThemeColors = Record<keyof typeof lightColors, string>;

const darkColors: ThemeColors = {
  background: '#121212',
  border: '#3A3633',
  onPrimary: '#1C1917',
  primary: '#FB923C',
  surface: '#1E1E1E',
  text: '#F5F5F4',
  textMuted: '#A8A29E',
};

export const lightTheme = { ...base, colors: lightColors satisfies ThemeColors };
export const darkTheme = { ...base, colors: darkColors };
