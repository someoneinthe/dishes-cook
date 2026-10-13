import type { ReactNode } from 'react';

// Type of this module, for `jest.requireActual<NavigationMock>(…)` in `jest.mock` factories.
export type NavigationMock = Readonly<{ ScreenWithHeaderButtons: typeof ScreenWithHeaderButtons }>;

type ScreenProps = Readonly<{ options?: Readonly<{ headerRight?: () => ReactNode }> }>;

// Stands in for `<Stack.Screen>` / `<Drawer.Screen>` in screen tests (no navigator there): renders
// the header's buttons so tests can press them like users do.
export function ScreenWithHeaderButtons({ options }: ScreenProps) {
  return options?.headerRight?.() ?? null;
}
