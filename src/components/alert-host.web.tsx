import type { AlertButton } from 'react-native';
import { useSyncExternalStore } from 'react';
import { Modal, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { closeAlert, getShownAlert, subscribeToAlerts } from './alert.web';
import { Button } from './button';

type DialogButtonProps = Readonly<{
  button: AlertButton;
  // The dialog's only action (OK, Stop syncing…): the main one, blue.
  isOnlyAction: boolean;
  label: string;
  onPress: () => void;
}>;

// The web's dialogs (alert.web.ts), in the app's look: the title, the message, then the buttons,
// side by side, or one under the other when there are more than two (a choice: camera, photos…).
// Escape presses Cancel, or closes a dialog without one.
export function AlertHost() {
  const t = useMessages();
  const alert = useSyncExternalStore(subscribeToAlerts, getShownAlert);
  if (!alert) {
    return null;
  }
  const { buttonList, id, message, title } = alert;
  const actionCount = buttonList.filter((button) => button.style !== 'cancel').length;
  const isStacked = buttonList.length > 2;

  return (
    <Modal
      onRequestClose={() =>
        closeAlert(
          id,
          buttonList.find((button) => button.style === 'cancel'),
        )
      }
      transparent
      visible
    >
      <View style={styles.overlay}>
        <View accessibilityRole="alert" aria-modal style={styles.dialog}>
          {title !== '' && <Text style={styles.title}>{title}</Text>}
          {message !== undefined && <Text style={styles.message}>{message}</Text>}
          <View style={[styles.buttons, isStacked && styles.stackedButtons]}>
            {buttonList.map((button) => (
              <DialogButton
                button={button}
                isOnlyAction={actionCount === 1}
                key={button.text ?? t.common.ok}
                label={button.text ?? t.common.ok}
                onPress={() => closeAlert(id, button)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// A deletion is red with the trash icon, Cancel and the choices of a list outlined, a dialog's
// only action blue (CONTRIBUTING › Buttons).
function DialogButton({ button, isOnlyAction, label, onPress }: DialogButtonProps) {
  const style = button.style ?? 'default';
  // Neither Cancel nor a plain button: a deletion (only useConfirmDelete asks for one).
  if (style !== 'cancel' && style !== 'default') {
    return <Button icon="trash-can-outline" label={label} onPress={onPress} variant="danger" />;
  }
  const isMain = style === 'default' && isOnlyAction;
  return <Button label={label} onPress={onPress} variant={isMain ? 'primary' : 'secondary'} />;
}

const styles = StyleSheet.create((theme) => ({
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
    justifyContent: 'flex-end',
  },
  dialog: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.lg,
    gap: theme.gap(4),
    maxWidth: theme.size.dialogMaxWidth,
    padding: theme.gap(6),
    width: '100%',
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: theme.colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: theme.gap(4),
  },
  stackedButtons: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  title: {
    ...theme.typography.subtitle,
    color: theme.colors.text,
  },
}));
