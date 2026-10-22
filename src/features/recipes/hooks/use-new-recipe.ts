import { router } from 'expo-router';
import { Alert } from 'react-native';
import type { RecipeKind } from '@/db/schema';
import { useMessages } from '@/i18n/i18n-provider';
import { kindTexts } from '../kind';
import { useRecipeScan } from './use-recipe-scan';

// Starts a new recipe (a dish or a drink, the form's `kind` parameter): asks whether to write it,
// or to fill it in from a chosen file (a photo or a document) or a photo taken now. It's read here, then the form opens filled in with it (its `scanned` parameter, read by
// readScannedParam). Back (or a tap outside) dismisses the question.
export function useNewRecipe(kind: RecipeKind = 'dish') {
  const t = useMessages();
  const { isReading, readFrom } = useRecipeScan((recipe) => {
    router.push({ params: { kind, scanned: JSON.stringify(recipe) }, pathname: '/recipe/new' });
  });

  return {
    isReading,
    start: () => {
      Alert.alert(
        kindTexts(t, kind).newRecipe,
        t.recipeScan.startMessage,
        [
          {
            onPress: () => router.push({ params: { kind }, pathname: '/recipe/new' }),
            text: t.recipeScan.write,
          },
          { onPress: () => void readFrom('file'), text: t.recipeScan.chooseFile },
          { onPress: () => void readFrom('camera'), text: t.recipeScan.takePhoto },
        ],
        { cancelable: true },
      );
    },
  };
}
