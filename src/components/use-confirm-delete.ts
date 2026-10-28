import { Alert } from '@/components/alert';
import { useMessages } from '@/i18n/i18n-provider';

type DeleteRequest = Readonly<{
  // What's said about the consequences, under the question (optional).
  message?: string;
  // The name of what's deleted, as the user knows it: "Delete “Pumpkin soup”?".
  name: string;
  onConfirm: () => void;
}>;

// Every deletion asks first (CONTRIBUTING › Deleting): a dialog with Cancel and a red Delete.
// ESLint only allows destructive dialog buttons here, so no deletion can skip the question.
export function useConfirmDelete() {
  const t = useMessages();

  return ({ message, name, onConfirm }: DeleteRequest) => {
    Alert.alert(t.common.deleteTitle(name), message, [
      { style: 'cancel', text: t.common.cancel },
      { onPress: onConfirm, style: 'destructive', text: t.common.delete },
    ]);
  };
}
