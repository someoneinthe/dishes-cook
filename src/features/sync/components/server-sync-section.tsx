import { useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Messages } from '@/i18n/en';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { useDatabaseConnection } from '@/db/database-context';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import type { SyncErrorKind } from '../sync-api';
import type { SyncState } from '../sync-store';
import { isInsecureServerUrl, normalizeServerUrl, serverHost, SyncError } from '../sync-api';
import { connect, disconnect, syncNow, useSyncState } from '../sync-store';

// A refused connection: its message, and the field to fix ('form' when none is to blame).
type ConnectError = Readonly<{ field: ConnectField; message: string }>;

type ConnectField = 'address' | 'email' | 'form' | 'password';

type ServerSyncSectionProps = Readonly<{
  // Opened from the header's sync status on a TV: the remote's focus goes to Sync now.
  isSyncNowFocused?: boolean;
}>;

type Storage = 'local' | 'server';

// Settings › Data storage: on this device only, or synced with a server (address + account).
export function ServerSyncSection({ isSyncNowFocused = false }: ServerSyncSectionProps) {
  const t = useMessages();
  const connection = useDatabaseConnection();
  const syncState = useSyncState();
  const isConnected = syncState.connection !== undefined;
  // "Synced with a server" chosen, before connecting.
  const [isConnectFormShown, setIsConnectFormShown] = useState(false);

  const onChangeStorage = (storage: Storage) => {
    if (storage === 'server') {
      setIsConnectFormShown(true);
      return;
    }
    setIsConnectFormShown(false);
    if (isConnected) {
      Alert.alert(t.sync.stopSyncingTitle, t.sync.stopSyncingMessage, [
        { style: 'cancel', text: t.common.cancel },
        { onPress: () => void disconnect(), text: t.sync.stopSyncing },
      ]);
    }
  };

  return (
    <View style={styles.section}>
      <SegmentedControl
        label={t.sync.chooseStorage}
        onChange={onChangeStorage}
        optionList={storageOptionList(t)}
        value={isConnected || isConnectFormShown ? 'server' : 'local'}
      />
      {isConnected && (
        <SyncStatus
          isSyncNowFocused={isSyncNowFocused}
          onSyncNow={() => void syncNow(connection)}
          state={syncState}
        />
      )}
      {!isConnected && isConnectFormShown && <ConnectForm />}
      {!isConnected && !isConnectFormShown && (
        <Text style={styles.text}>{t.sync.localOnlyDescription}</Text>
      )}
    </View>
  );
}

function ConnectForm() {
  const t = useMessages();
  const connection = useDatabaseConnection();
  const [serverAddress, setServerAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ConnectError>();
  const [isConnecting, setIsConnecting] = useState(false);
  const errorOf = (field: ConnectField) => (error?.field === field ? error.message : undefined);
  // Editing a field clears its error, and the form's own; another field's error stays.
  const edit = (field: ConnectField, setValue: (value: string) => void) => (value: string) => {
    setValue(value);
    if (error?.field === field || error?.field === 'form') {
      setError(undefined);
    }
  };

  const onConnect = async () => {
    const serverUrl = normalizeServerUrl(serverAddress);
    if (!serverUrl) {
      setError({ field: 'address', message: t.sync.invalidAddress });
      return;
    }
    if (isInsecureServerUrl(serverUrl)) {
      setError({ field: 'address', message: t.sync.insecureAddress });
      return;
    }
    if (!password || !email.trim()) {
      setError({ field: email.trim() ? 'password' : 'email', message: t.sync.missingAccount });
      return;
    }
    setError(undefined);
    setIsConnecting(true);
    try {
      await connect(connection, { email, password, serverUrl });
    } catch (connectError) {
      const kind = connectError instanceof SyncError ? connectError.kind : 'failed';
      setError(signInError(t, kind));
      setIsConnecting(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.text}>{t.sync.signInDescription}</Text>
      <TextField
        autoCapitalize="none"
        autoComplete="url"
        autoCorrect={false}
        editable={!isConnecting}
        error={errorOf('address')}
        hint={t.sync.serverAddressHint}
        keyboardType="url"
        label={t.sync.serverAddress}
        onChangeText={edit('address', setServerAddress)}
        value={serverAddress}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        editable={!isConnecting}
        error={errorOf('email')}
        keyboardType="email-address"
        label={t.sync.email}
        onChangeText={edit('email', setEmail)}
        textContentType="username"
        value={email}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="current-password"
        autoCorrect={false}
        editable={!isConnecting}
        error={errorOf('password')}
        label={t.sync.password}
        onChangeText={edit('password', setPassword)}
        onSubmitEditing={() => void onConnect()}
        returnKeyType="go"
        secureTextEntry
        textContentType="password"
        value={password}
      />
      {error?.field === 'form' && (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          {error.message}
        </Text>
      )}
      <Button
        icon="cloud-sync-outline"
        isDisabled={isConnecting}
        label={isConnecting ? t.sync.connecting : t.sync.connect}
        onPress={() => void onConnect()}
      />
    </View>
  );
}

function errorMessage(t: Messages, kind: SyncErrorKind): string {
  const messages: Record<SyncErrorKind, string> = {
    'app-outdated': t.sync.errorAppOutdated,
    failed: t.sync.errorFailed,
    'server-outdated': t.sync.errorServerOutdated,
    unauthorized: t.sync.errorUnauthorized,
    unreachable: t.sync.errorUnreachable,
  };
  return messages[kind];
}

// A refused sign-in, shown under the field to fix: a wrong email or password ("unauthorized"), a
// server that doesn't answer; under the form otherwise.
function signInError(t: Messages, kind: SyncErrorKind): ConnectError {
  if (kind === 'unauthorized') {
    return { field: 'password', message: t.sync.wrongAccount };
  }
  return { field: kind === 'unreachable' ? 'address' : 'form', message: errorMessage(t, kind) };
}

function storageOptionList(t: Messages): readonly SegmentedOption<Storage>[] {
  return [
    { icon: isTv ? 'television' : 'cellphone', label: t.sync.localOnly, value: 'local' },
    { icon: 'cloud-sync-outline', label: t.sync.withServer, value: 'server' },
  ];
}

function SyncStatus({
  isSyncNowFocused,
  onSyncNow,
  state,
}: Readonly<{ isSyncNowFocused: boolean; onSyncNow: () => void; state: SyncState }>) {
  const t = useMessages();
  const { connection, error, isAppUpdateAvailable, isSyncing, lastSyncedAt } = state;
  if (!connection) {
    return null;
  }
  let status = lastSyncedAt === undefined ? t.sync.notSyncedYet : t.sync.lastSynced(lastSyncedAt);
  if (isSyncing) {
    status = t.sync.syncing;
  } else if (error) {
    status = errorMessage(t, error);
  }

  return (
    <View style={styles.form}>
      <Text style={styles.text}>
        {t.sync.connectedAs(serverHost(connection.serverUrl), connection.email)}
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        accessibilityRole={error && !isSyncing ? 'alert' : undefined}
        style={[styles.text, error !== undefined && !isSyncing && styles.error]}
      >
        {status}
      </Text>
      {isAppUpdateAvailable && error === undefined && (
        <Text style={styles.text}>{t.sync.appUpdateAvailable}</Text>
      )}
      <Button
        icon="sync"
        isDisabled={isSyncing}
        isTvPreferredFocus={isSyncNowFocused}
        label={t.sync.syncNow}
        onPress={onSyncNow}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  error: {
    color: theme.colors.danger,
  },
  form: {
    gap: theme.gap(3),
  },
  section: {
    gap: theme.gap(3),
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.text,
  },
}));
