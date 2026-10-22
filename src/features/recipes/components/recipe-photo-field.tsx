import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@/components/button';
import { useConfirmDelete } from '@/components/use-confirm-delete';
import { useMessages } from '@/i18n/i18n-provider';
import type { PhotoSource } from '../recipe-photos';
import { pickRecipePhoto, recipePhotoFile } from '../recipe-photos';
import { RecipePhoto } from './recipe-photo';

type RecipePhotoFieldProps = Readonly<{
  // The photo's file, or undefined without one.
  file?: string;
  onChange: (file: string | undefined) => void;
  title: string;
}>;

// The recipe form's photo: add one (camera or gallery, cropped), change it, or remove it (asked
// first). The file is saved when picked; the recipe keeps it once the form is saved.
export function RecipePhotoField({ file, onChange, title }: RecipePhotoFieldProps) {
  const t = useMessages();
  const confirmDelete = useConfirmDelete();

  const pickFrom = async (source: PhotoSource) => {
    try {
      const result = await pickRecipePhoto(source);
      if (result === 'denied') {
        Alert.alert(t.recipes.addPhoto, t.recipeScan.cameraDenied, [{ text: t.common.ok }]);
      } else if (result !== 'cancelled') {
        onChange(result.file);
      }
    } catch {
      Alert.alert(t.recipes.photoFailed, undefined, [{ text: t.common.ok }]);
    }
  };
  const choose = () => {
    Alert.alert(file === undefined ? t.recipes.addPhoto : t.recipes.changePhoto, undefined, [
      { style: 'cancel', text: t.common.cancel },
      { onPress: () => void pickFrom('library'), text: t.recipeScan.choosePhoto },
      { onPress: () => void pickFrom('camera'), text: t.recipeScan.takePhoto },
    ]);
  };
  const askToRemove = () => {
    confirmDelete({
      message: t.recipes.removePhotoMessage,
      name: t.recipes.photoName,
      onConfirm: () => onChange(undefined),
    });
  };

  // A photo synced from another phone may not be downloaded yet: its buttons, without it, sit
  // under the label.
  const isPhotoShown = file !== undefined && recipePhotoFile(file).exists;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{t.recipes.photo}</Text>
      {file === undefined ? (
        <View style={styles.actions}>
          <Button
            accessibilityHint={t.recipes.addPhotoHint}
            icon="camera-plus-outline"
            isFilling
            label={t.recipes.addPhoto}
            onPress={choose}
            variant="secondary"
          />
        </View>
      ) : (
        <View>
          <RecipePhoto file={file} title={title} />
          {/* On the photo, at its bottom right; their text shows with Settings › button labels. */}
          <View style={[styles.actions, isPhotoShown && styles.onPhoto]}>
            <Button
              accessibilityHint={t.recipes.addPhotoHint}
              icon="image-edit-outline"
              isIconOnly
              label={t.recipes.changePhoto}
              onPress={choose}
              variant="secondary"
            />
            <Button
              accessibilityHint={t.common.deleteHint}
              icon="trash-can-outline"
              isIconOnly
              label={t.recipes.removePhoto}
              onPress={askToRemove}
              variant="danger"
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.gap(2),
    justifyContent: 'flex-end',
  },
  field: {
    gap: theme.gap(2),
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  // Inside the photo's rounded corner; they wrap, right-aligned, with long labels or a large font.
  onPhoto: {
    bottom: theme.gap(3),
    left: theme.gap(3),
    position: 'absolute',
    right: theme.gap(3),
  },
}));
