import type { ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { isTv } from '@/lib/device';

// A screen the read-only TV doesn't have: a link to it leads to the meal choice there.
export function PhoneOnly({ children }: Readonly<{ children: ReactNode }>) {
  // Sonar (S100) only sees a component when it returns a JSX element, not a ternary.
  // eslint-disable-next-line unicorn/prefer-ternary
  if (isTv) {
    return <Redirect href="/" />;
  }
  return <>{children}</>;
}
