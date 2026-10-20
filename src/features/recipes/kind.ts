import { useUnistyles } from 'react-native-unistyles';
import type { RecipeKind } from '@/db/schema';
import type { Messages } from '@/i18n/en';
import { headerTitleWithIcon } from '@/components/header-title';
import { MENU_ICONS } from '@/components/menu-entry-options';

// A recipe is a dish or a drink (RECIPE_KIND_LIST). Drinks have their own list (Drinks, in the menu),
// no course, and no meal history; Meal choice only suggests dishes.

// The texts that name what the screen is about: "recipe" for a dish, "drink" for a drink.
export type KindTexts = Pick<Messages['recipes'], keyof Messages['drinks']>;

export function kindTexts(t: Messages, kind: RecipeKind): KindTexts {
  return kind === 'drink' ? t.drinks : t.recipes;
}

// The header title's icon of a drink's screens (a dish's is the stack's default, src/app/_layout.tsx).
export function useKindHeaderOptions(kind: RecipeKind) {
  // Navigation options aren't styles: the theme is read here, and updates on light/dark changes.
  const { theme } = useUnistyles();
  return kind === 'drink'
    ? { headerTitle: headerTitleWithIcon(MENU_ICONS.drinks, theme.colors.menuDrinks) }
    : {};
}
