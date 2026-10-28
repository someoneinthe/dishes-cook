/* eslint-disable sonarjs/no-wildcard-import -- whole modules compared, types only */
import type * as AlertPhone from '@/components/alert';
import type * as AlertHostPhone from '@/components/alert-host';
import type * as AlertHostWeb from '@/components/alert-host.web';
import type * as AlertWeb from '@/components/alert.web';
/* eslint-enable sonarjs/no-wildcard-import */
import type { SamePlatformApi } from './platform';

// Every web version of a module (`x.web.ts`) checked against its phone version (see
// SamePlatformApi). Add a line with each new one.
export type PlatformApis = [
  // The app only shows dialogs (Alert.alert).
  SamePlatformApi<typeof AlertWeb, { Alert: Pick<typeof AlertPhone.Alert, 'alert'> }>,
  SamePlatformApi<typeof AlertHostWeb, typeof AlertHostPhone>,
];
