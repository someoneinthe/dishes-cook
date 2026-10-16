import type { Text } from '@infinitered/react-native-mlkit-text-recognition';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
} from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useMessages } from '@/i18n/i18n-provider';
import type { ScannedBlock, ScannedRecipe } from '../recipe-from-text';
import { readRecipeText } from '../recipe-from-text';

type PhotoSource = 'camera' | 'library';

// The text recognition's result as the recipe reader takes it: blocks of lines with their height.
export function toScannedBlocks(text: Text): ScannedBlock[] {
  return text.blocks.map((block) => ({
    lineList: block.lines.map((line) => ({
      height: line.frame.bottom - line.frame.top,
      text: line.text,
    })),
  }));
}

// A recipe read from a photo, taken or chosen by the user: the text is recognized on the phone
// (ML Kit, no network) and the photo isn't kept. `onRead` gets the recipe when some text was found.
export function useRecipeScan(onRead: (recipe: ScannedRecipe) => void) {
  const t = useMessages();
  const [isReading, setIsReading] = useState(false);

  const showMessage = (title: string, message?: string) => {
    Alert.alert(title, message, [{ text: t.common.ok }]);
  };

  const read = async (source: PhotoSource) => {
    if (source === 'camera') {
      const { granted: isGranted } = await requestCameraPermissionsAsync();
      if (!isGranted) {
        showMessage(t.recipeScan.chooseTitle, t.recipeScan.cameraDenied);
        return;
      }
    }
    // Cropping to the recipe leaves out the rest of the page (another recipe, a second column).
    const options = { allowsEditing: true, mediaTypes: 'images' as const };
    const result = await (source === 'camera'
      ? launchCameraAsync(options)
      : launchImageLibraryAsync(options));
    const uri = result.canceled ? undefined : result.assets[0]?.uri;
    if (uri === undefined) {
      return;
    }
    setIsReading(true);
    try {
      const recipe = readRecipeText(toScannedBlocks(await recognizeText(uri)));
      if (recipe.title || recipe.instructions || recipe.ingredientList.length > 0) {
        onRead(recipe);
      } else {
        showMessage(t.recipeScan.nothingFoundTitle, t.recipeScan.nothingFoundMessage);
      }
    } finally {
      setIsReading(false);
    }
  };

  const readFrom = async (source: PhotoSource) => {
    try {
      await read(source);
    } catch {
      // Also when Android recreated the app's screen (e.g. a font size change): the photo picker
      // then fails until the app is reopened (https://github.com/expo/expo/issues/50386).
      showMessage(t.recipeScan.readFailed);
    }
  };

  return {
    isReading,
    // Asks where the photo comes from, then reads it.
    scan: () => {
      Alert.alert(t.recipeScan.chooseTitle, t.recipeScan.chooseMessage, [
        { style: 'cancel', text: t.common.cancel },
        { onPress: () => void readFrom('library'), text: t.recipeScan.choosePhoto },
        { onPress: () => void readFrom('camera'), text: t.recipeScan.takePhoto },
      ]);
    },
  };
}
