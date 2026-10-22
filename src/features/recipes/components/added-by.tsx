import { Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { Messages } from '@/i18n/en';
import { useSyncState } from '@/features/sync/sync-store';
import { useMessages } from '@/i18n/i18n-provider';
import type { Recipe } from '../db/recipe-queries';

type AddedByProps = Readonly<{ addedBy: Recipe['addedBy'] }>;

// Who added the recipe: "Added by Alice". Only with a sync server (without one, every recipe is
// the phone's), and only for a recipe that has an author.
export function AddedBy({ addedBy }: AddedByProps) {
  const t = useMessages();
  const { connection } = useSyncState();
  if (!connection || !addedBy) {
    return null;
  }
  const text = describeAuthor(t, addedBy, connection.accountId);
  return <Text style={styles.text}>{text}</Text>;
}

// The account's name; without one, "you" for this phone's account (or a recipe not on the server
// yet), "someone else" for another account.
function describeAuthor(
  t: Messages,
  addedBy: NonNullable<Recipe['addedBy']>,
  myAccountId: string | undefined,
): string {
  if (addedBy.name) {
    return t.recipes.addedBy(addedBy.name);
  }
  return addedBy.accountId === null || addedBy.accountId === myAccountId
    ? t.recipes.addedByYou
    : t.recipes.addedBySomeoneElse;
}

const styles = StyleSheet.create((theme) => ({
  text: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));
