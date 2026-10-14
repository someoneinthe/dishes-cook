import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SegmentedOption } from '@/components/segmented-control';
import type { Messages } from '@/i18n/en';
import { Button } from '@/components/button';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { useDatabase } from '@/db/database-context';
import { useMessages } from '@/i18n/i18n-provider';
import { isTv } from '@/lib/device';
import type { SyncErrorKind } from '../sync-api';
import type { SyncState } from '../sync-store';
import { normalizeServerUrl, serverHost, SyncError } from '../sync-api';
import { connect, disconnect, syncNow, useSyncState } from '../sync-store';

type Storage = 'local' | 'server';

// Settings › Data storage: on this device only, or synced with a server (address + account).
export function ServerSyncSection() {
  const t = useMessages();
  const database = useDatabase();
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
      {isConnected && <SyncStatus onSyncNow={() => void syncNow(database)} state={syncState} />}
      {!isConnected && isConnectFormShown && <ConnectForm />}
      {!isConnected && !isConnectFormShown && (
        <Text style={styles.text}>{t.sync.localOnlyDescription}</Text>
      )}
    </View>
  );
}

function ConnectForm() {
  const t = useMessages();
  const database = useDatabase();
  const [serverAddress, setServerAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [isConnecting, setIsConnecting] = useState(false);

  const onConnect = async () => {
    const serverUrl = normalizeServerUrl(serverAddress);
    if (!serverUrl) {
      setError(t.sync.invalidAddress);
      return;
    }
    if (!password || !email.trim()) {
      setError(t.sync.missingAccount);
      return;
    }
    setError(undefined);
    setIsConnecting(true);
    try {
      await connect(database, { email, password, serverUrl });
    } catch (connectError) {
      const kind = connectError instanceof SyncError ? connectError.kind : 'failed';
      // Signing in: "unauthorized" is a wrong email or password.
      setError(kind === 'unauthorized' ? t.sync.wrongAccount : errorMessage(t, kind));
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
        hint={t.sync.serverAddressHint}
        keyboardType="url"
        label={t.sync.serverAddress}
        onChangeText={setServerAddress}
        value={serverAddress}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        editable={!isConnecting}
        keyboardType="email-address"
        label={t.sync.email}
        onChangeText={setEmail}
        textContentType="username"
        value={email}
      />
      <TextField
        autoCapitalize="none"
        autoComplete="current-password"
        autoCorrect={false}
        editable={!isConnecting}
        error={error}
        label={t.sync.password}
        onChangeText={setPassword}
        onSubmitEditing={() => void onConnect()}
        returnKeyType="go"
        secureTextEntry
        textContentType="password"
        value={password}
      />
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
  if (kind === 'unreachable') {
    return t.sync.errorUnreachable;
  }
  return kind === 'unauthorized' ? t.sync.errorUnauthorized : t.sync.errorFailed;
}

function storageOptionList(t: Messages): readonly SegmentedOption<Storage>[] {
  return [
    { icon: isTv ? 'television' : 'cellphone', label: t.sync.localOnly, value: 'local' },
    { icon: 'cloud-sync-outline', label: t.sync.withServer, value: 'server' },
  ];
}

function SyncStatus({ onSyncNow, state }: Readonly<{ onSyncNow: () => void; state: SyncState }>) {
  const t = useMessages();
  const { connection, error, isSyncing, lastSyncedAt } = state;
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
      <Button
        icon="sync"
        isDisabled={isSyncing}
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
