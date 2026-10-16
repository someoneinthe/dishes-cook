import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useMessages } from '@/i18n/i18n-provider';
import { useRecipeScan } from './use-recipe-scan';

// Starts a new recipe: asks whether to write it or to fill it in from a photo (taken or chosen).
// A photo is read here, then the form opens filled in with it (its `scanned` parameter, read by
// readScannedParam). Back (or a tap outside) dismisses the question.
export function useNewRecipe() {
  const t = useMessages();
  const { isReading, readFrom } = useRecipeScan((recipe) => {
    router.push({ params: { scanned: JSON.stringify(recipe) }, pathname: '/recipe/new' });
  });

  return {
    isReading,
    start: () => {
      Alert.alert(
        t.recipes.newRecipe,
        t.recipeScan.startMessage,
        [
          { onPress: () => router.push('/recipe/new'), text: t.recipeScan.write },
          { onPress: () => void readFrom('library'), text: t.recipeScan.choosePhoto },
          { onPress: () => void readFrom('camera'), text: t.recipeScan.takePhoto },
        ],
        { cancelable: true },
      );
    },
  };
}
