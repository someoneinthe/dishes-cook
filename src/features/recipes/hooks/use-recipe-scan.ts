import type { Rect, Text, TextLine } from '@infinitered/react-native-mlkit-text-recognition';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { Directory, Paths } from 'expo-file-system';
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

// The photo picker copies the taken or chosen photo, and its crop, to this folder of the app's
// cache, and leaves them there.
const PICKED_PHOTO_FOLDER = 'ImagePicker';

// Where the photo comes from: the camera, or the phone's photos.
export type PhotoSource = 'camera' | 'library';

// The text recognition's result as the recipe reader takes it: blocks of lines, where they are on
// the page, and the height of their letters: the middle height of their words (a slanted photo
// makes a long line's box taller than its letters).
export function toScannedBlocks(text: Text): ScannedBlock[] {
  return text.blocks.map((block) => ({
    frame: block.frame,
    lineList: block.lines.map((line) => ({ height: letterHeight(line), text: line.text })),
  }));
}

// A recipe read from a photo, taken or chosen by the user: the text is recognized on the phone
// (ML Kit, no network) and the photo isn't kept: the picker's copies are deleted once read, or
// when the reading failed or was cancelled. `onRead` gets the recipe when some text was found.
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
    try {
      const result = await (source === 'camera'
        ? launchCameraAsync(options)
        : launchImageLibraryAsync(options));
      const uri = result.canceled ? undefined : result.assets[0]?.uri;
      if (uri === undefined) {
        return;
      }
      setIsReading(true);
      const recipe = readRecipeText(toScannedBlocks(await recognizeText(uri)));
      if (recipe.title || recipe.instructions || recipe.ingredientList.length > 0) {
        onRead(recipe);
      } else {
        showMessage(t.recipeScan.nothingFoundTitle, t.recipeScan.nothingFoundMessage);
      }
    } finally {
      deletePickedPhotos();
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
    // Reads a photo from this source, without asking (the user already chose it).
    readFrom,
  };
}

// Deletes the photo picker's copies (the user's own photos are elsewhere, untouched). A copy that
// can't be deleted stays in the cache, which Android clears when it needs room.
function deletePickedPhotos() {
  try {
    const folder = new Directory(Paths.cache, PICKED_PHOTO_FOLDER);
    if (folder.exists) {
      folder.delete();
    }
  } catch {
    // Nothing the user can do about it: the recipe was read all the same.
  }
}

function frameHeight({ bottom, top }: Rect): number {
  return bottom - top;
}

function letterHeight(line: TextLine): number {
  const heightList = line.elements.map(({ frame }) => frameHeight(frame));
  const sortedList = [...heightList].sort((first, second) => first - second);
  return sortedList[Math.floor(sortedList.length / 2)] ?? frameHeight(line.frame);
}
