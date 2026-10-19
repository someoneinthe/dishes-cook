import { useState } from 'react';
import { Alert } from 'react-native';
import { Button } from '@/components/button';
import { usePreferences } from '@/features/settings/preferences';
import { useMessages } from '@/i18n/i18n-provider';
import type { Recipe } from '../db/recipe-queries';
import { toRecipeHtml } from '../recipe-html';
import { shareRecipePdf } from '../share-recipe-pdf';

type ShareRecipeButtonProps = Readonly<{ recipe: Recipe }>;

// Shares the recipe as a PDF (a header button of the recipe screen), in the reader's language and
// units. Disabled while the PDF is made.
export function ShareRecipeButton({ recipe }: ShareRecipeButtonProps) {
  const t = useMessages();
  const { units } = usePreferences();
  const [isSharing, setIsSharing] = useState(false);

  const share = async () => {
    setIsSharing(true);
    try {
      await shareRecipePdf({
        dialogTitle: t.recipes.shareDialogTitle(recipe.title),
        html: toRecipeHtml(t, recipe, { language: t.languageCode, units }),
        title: recipe.title,
        units,
      });
    } catch {
      Alert.alert(t.recipes.shareFailedTitle, t.recipes.shareFailedMessage);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      accessibilityHint={t.recipes.shareHint}
      icon="share-variant"
      isDisabled={isSharing}
      isIconOnly
      label={t.recipes.share}
      onPress={() => void share()}
      variant="secondary"
    />
  );
}
