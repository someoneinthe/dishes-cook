import type { AlertButton } from 'react-native';
import { createListeners } from '@/lib/listeners';

// The web's dialogs: react-native-web's Alert does nothing, so Alert.alert queues the dialog and
// AlertHost (alert-host.web.tsx) shows it, one at a time, like Android does.

export type ShownAlert = Readonly<{
  buttonList: readonly AlertButton[];
  id: number;
  message?: string;
  title: string;
}>;

const queue: { list: readonly ShownAlert[]; nextId: number } = { list: [], nextId: 0 };
const listeners = createListeners();

export const Alert = {
  alert(title: string, message?: string, buttonList?: AlertButton[]): void {
    queue.list = [
      ...queue.list,
      // Without buttons, an OK button, like Android's (AlertHost names it).
      { buttonList: buttonList ?? [{}], id: queue.nextId, message, title },
    ];
    queue.nextId += 1;
    listeners.notify();
  },
};

// Closes the dialog, then runs the button pressed, if any (it may show another dialog).
export function closeAlert(id: number, button?: AlertButton): void {
  queue.list = queue.list.filter((alert) => alert.id !== id);
  listeners.notify();
  button?.onPress?.();
}

// The dialog shown now: the oldest one not closed.
export function getShownAlert(): ShownAlert | undefined {
  return queue.list[0];
}

export const subscribeToAlerts = listeners.subscribe;
