import { Image } from 'expo-image';
import { StyleSheet } from 'react-native-unistyles';
import { useMessages } from '@/i18n/i18n-provider';
import { recipePhotoFile } from '../recipe-photos';

type RecipePhotoProps = Readonly<{ file: string; title: string }>;

// A recipe's photo, 4:3 like the picker crops it. Nothing while its file is missing (a photo
// synced from another phone and not downloaded yet). Skipped by screen readers: the recipe's title,
// right next to it, already says what it shows.
export function RecipePhoto({ file, title }: RecipePhotoProps) {
  const t = useMessages();
  const photo = recipePhotoFile(file);
  if (!photo.exists) {
    return null;
  }
  return (
    <Image
      accessibilityElementsHidden
      alt={t.recipes.photoAlt(title)}
      contentFit="cover"
      importantForAccessibility="no-hide-descendants"
      source={{ uri: photo.uri }}
      style={styles.photo}
      testID="recipe-photo"
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  photo: {
    aspectRatio: 4 / 3,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    width: '100%',
  },
}));
