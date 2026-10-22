import { getDocumentAsync } from 'expo-document-picker';
import { Directory, Paths } from 'expo-file-system';
import { launchCameraAsync, requestCameraPermissionsAsync } from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';
import { useMessages } from '@/i18n/i18n-provider';
import type { DocumentKind } from '../recipe-documents';
import type { ScannedRecipe } from '../recipe-from-text';
import { deleteFolder, MAX_PDF_PAGES, readDocument } from '../read-document';
import { DOCUMENT_TYPE_LIST, toDocumentKind } from '../recipe-documents';
import { readRecipeText } from '../recipe-from-text';

// The pickers copy the photo taken (and its crop) or the file chosen to these folders of the app's
// cache, and leave them there.
const PICKER_FOLDER_LIST = ['ImagePicker', 'DocumentPicker'];

// Where the recipe comes from: a photo taken now, or a file chosen on the phone (a photo, a PDF,
// a Word, OpenDocument or text document).
export type ScanSource = 'camera' | 'file';

// A recipe read from a photo taken or a file chosen by the user, all on the phone (ML Kit's text
// recognition for photos and PDF pages, no network); the photo or file isn't kept: the pickers'
// copies are deleted once read, or when the reading failed or was cancelled. `onRead` gets the
// recipe when some text was found.
export function useRecipeScan(onRead: (recipe: ScannedRecipe) => void) {
  const t = useMessages();
  const [isReading, setIsReading] = useState(false);

  const showMessage = (title: string, message?: string) => {
    Alert.alert(title, message, [{ text: t.common.ok }]);
  };

  // The photo taken or the file chosen, and what it is; undefined when the user cancelled, was
  // told why it can't be read, or refused the camera.
  const pick = async (
    source: ScanSource,
  ): Promise<Readonly<{ kind: DocumentKind; uri: string }> | undefined> => {
    if (source === 'camera') {
      const { granted: isGranted } = await requestCameraPermissionsAsync();
      if (!isGranted) {
        showMessage(t.recipeScan.chooseTitle, t.recipeScan.cameraDenied);
        return undefined;
      }
      // Cropping to the recipe leaves out the rest of the page (another recipe, a second column).
      const photo = await launchCameraAsync({ allowsEditing: true, mediaTypes: 'images' });
      const uri = photo.canceled ? undefined : photo.assets[0]?.uri;
      return uri === undefined ? undefined : { kind: 'image', uri };
    }
    const result = await getDocumentAsync({ type: [...DOCUMENT_TYPE_LIST] });
    const file = result.canceled ? undefined : result.assets[0];
    const kind = file && toDocumentKind(file);
    if (file && !kind) {
      showMessage(t.recipeScan.unsupportedTitle, t.recipeScan.unsupportedMessage);
    }
    return file && kind && { kind, uri: file.uri };
  };

  const read = async (source: ScanSource) => {
    try {
      const picked = await pick(source);
      if (!picked) {
        return;
      }
      setIsReading(true);
      const { blockList, isCut, isLevel } = await readDocument(picked.uri, picked.kind);
      const recipe = readRecipeText(blockList, isLevel);
      if (recipe.title || recipe.instructions || recipe.ingredientList.length > 0) {
        onRead(recipe);
        if (isCut) {
          showMessage(t.recipeScan.pagesCutTitle, t.recipeScan.pagesCutMessage(MAX_PDF_PAGES));
        }
      } else {
        showMessage(t.recipeScan.nothingFoundTitle, t.recipeScan.nothingFoundMessage);
      }
    } finally {
      for (const folder of PICKER_FOLDER_LIST) {
        deleteFolder(new Directory(Paths.cache, folder));
      }
      setIsReading(false);
    }
  };

  const readFrom = async (source: ScanSource) => {
    try {
      await read(source);
    } catch {
      // A damaged or password-protected file; also when Android recreated the app's screen (e.g. a
      // font size change): the camera then fails until the app is reopened
      // (https://github.com/expo/expo/issues/50386).
      showMessage(t.recipeScan.readFailed);
    }
  };

  return {
    isReading,
    // Reads a photo taken now or a chosen file, without asking (the user already chose).
    readFrom,
  };
}
