import { router, useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { Button } from '@/components/button';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import { useSyncStatus } from '../use-sync-status';

// On a TV, Back from the Settings it opened brings the remote's focus back to the sync status (the
// focused button left the screen, and the focus would fall on the menu's first entry).
const focusReturn = { isWanted: false };

// In the header of the menu's screens, before their own buttons: shown when the last sync failed
// or changes wait to be sent, hidden otherwise. Opens Settings › Data storage, which tells more.
export function SyncStatusButton() {
  const t = useMessages();
  const status = useSyncStatus();
  const isScreenFocused = useIsFocused();
  const isTvPreferredFocus = isTv && isScreenFocused && focusReturn.isWanted;
  // Once back (focused, or nothing left to show): later screens keep the focus where it is.
  const isBack = isScreenFocused && (isTvPreferredFocus || !status);
  useEffect(() => {
    if (isBack) {
      focusReturn.isWanted = false;
    }
  }, [isBack]);
  if (!status) {
    return null;
  }

  const isFailed = status.kind === 'failed';
  return (
    <Button
      accessibilityHint={t.sync.statusHint}
      accessibilityLabel={
        isFailed
          ? t.sync.statusFailedLabel(status.pendingCount)
          : t.sync.statusWaiting(status.pendingCount)
      }
      icon={isFailed ? 'cloud-alert-outline' : 'cloud-upload-outline'}
      isIconOnly
      isTvPreferredFocus={isTvPreferredFocus}
      label={isFailed ? t.sync.statusFailed : t.sync.statusWaiting(status.pendingCount)}
      onPress={() => {
        focusReturn.isWanted = isTv;
        router.navigate({ params: { section: 'sync' }, pathname: '/settings' });
      }}
      variant="secondary"
    />
  );
}
