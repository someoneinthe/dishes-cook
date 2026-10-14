import type { Messages } from './en';

// French typography: a narrow no-break space before "?", "!" and ":", no-break spaces inside « ».
const NARROW_SPACE = '\u{202F}';
const quote = (text: string) => `«\u{A0}${text}\u{A0}»`;

// French uses the singular for 0 and 1.
function plural(count: number, one: string, other: string): string {
  return count <= 1 ? one : other;
}

export const fr: Messages = {
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    chooseOneOption: 'Choisissez une option',
    delete: 'Supprimer',
    deleteHint: 'Demande d’abord une confirmation',
    deleteTitle: (name) => `Supprimer ${quote(name)}${NARROW_SPACE}?`,
    edit: 'Modifier',
    loadingMore: 'Chargement de la suite',
    loadingMoreHint: 'D’autres éléments s’affichent une fois chargés',
    new: 'Nouveau',
    save: 'Enregistrer',
    setsChoice: (label, option) => `Sélectionne ${quote(option)} pour ${quote(label)}`,
  },
  courses: {
    dessert: 'Dessert',
    main: 'Plat principal',
    starter: 'Entrée',
  },
  ingredientPicker: {
    addHint: 'L’ajoute à la sélection',
    addLabel: (name) => `Ajouter ${name}`,
    createChip: (name) => `Nouveau${NARROW_SPACE}: ${name}`,
    createHint: 'Crée l’ingrédient et l’ajoute à la sélection',
    createLabel: (name) => `Créer ${name}`,
    noMatch: 'Aucun ingrédient correspondant.',
    // Short: a one-line field can't wrap its placeholder at large font sizes.
    placeholder: 'Chercher un ingrédient',
    placeholderWithCreate: 'Chercher ou ajouter',
    removeHint: 'Le retire de la sélection',
    removeLabel: (name) => `Retirer ${name}`,
    searchLabel: (label) => `Rechercher${NARROW_SPACE}: ${label.toLowerCase()}`,
  },
  ingredients: {
    add: 'Ajouter',
    addHint: 'Ajoute le nom saisi dans le champ de recherche',
    addLabel: 'Ajouter l’ingrédient',
    alreadyExists: (name) => `${quote(name)} existe déjà.`,
    deleteLabel: (name) => `Supprimer ${name}`,
    emptyMessage: 'Ajoutez les ingrédients que vous cuisinez, ici ou en écrivant une recette.',
    emptyTitle: 'Aucun ingrédient pour l’instant',
    inUseMessage: 'Retirez-le d’abord de ses recettes.',
    inUseTitle: (name) => `${quote(name)} est utilisé dans une recette`,
    nameBlank: 'Le nom ne peut pas être vide.',
    nameTaken: 'Un autre ingrédient porte déjà ce nom.',
    noMatch: (search) => `Aucun ingrédient ne correspond à ${quote(search)}.`,
    placeholder: 'ex. Carotte',
    rename: 'Renommer',
    renameHint: 'Permet de modifier son nom',
    renameLabel: (name) => `Renommer ${name}`,
    searchOrAdd: 'Rechercher ou ajouter un ingrédient',
    typeName: 'Saisissez le nom de l’ingrédient à ajouter.',
    usage: (recipeCount) =>
      recipeCount === 0
        ? 'Pas encore utilisé'
        : plural(recipeCount, 'Utilisé dans 1 recette', `Utilisé dans ${recipeCount} recettes`),
  },
  loading: {
    hint: 'L’app s’ouvre d’elle-même une fois chargée',
    label: 'Chargement de Dishes Cook',
  },
  markdown: {
    image: (description) => (description ? `Image${NARROW_SPACE}: ${description}` : 'Image'),
  },
  mealChoice: {
    addRecipe: 'Ajouter une recette',
    any: 'Indifférent',
    emptyMessage: 'Ajoutez quelques recettes, puis revenez laisser le hasard choisir le repas.',
    matchCount: (count) =>
      count === 0
        ? 'Aucune recette ne correspond à ces filtres.'
        : plural(count, '1 recette correspond.', `${count} recettes correspondent.`),
    noUsedIngredient: 'Aucun ingrédient n’est encore utilisé dans une recette.',
    suggest: 'Suggérer',
    suggestAnother: 'Suggérer une autre recette',
    suggestHint: 'Choisit une recette au hasard parmi celles qui correspondent',
    suggestRecipe: 'Suggérer une recette',
    withIngredients: 'Avec les ingrédients',
  },
  menu: {
    close: 'Fermer le menu',
    ingredients: 'Ingrédients',
    mealChoice: 'Choix du repas',
    open: 'Ouvrir le menu',
    recipes: 'Recettes',
    settings: 'Réglages',
  },
  recipes: {
    course: 'Type de plat',
    deleteMessage: 'Ses ingrédients restent dans votre liste.',
    editRecipe: 'Modifier la recette',
    emptyMessage:
      'Enregistrez les plats que vous aimez cuisiner, puis laissez le choix du repas en choisir un pour vous.',
    emptyTitle: 'Aucune recette pour l’instant',
    formatHint:
      `Mise en forme en Markdown${NARROW_SPACE}: #\u{A0}Titre, **gras**, *italique*, ` +
      '-\u{A0}élément de liste, 1.\u{A0}étape numérotée. Les retours à la ligne sont conservés.',
    ingredientCount: (count) => plural(count, `${count} ingrédient`, `${count} ingrédients`),
    ingredients: 'Ingrédients',
    ingredientsEmpty: 'Saisissez un ingrédient pour l’ajouter.',
    instructionsPlaceholder: 'Étapes, quantités, temps de cuisson…',
    newHint: 'Ouvre un formulaire de recette vide',
    newRecipe: 'Nouvelle recette',
    noCourse: 'Aucun',
    noIngredients: 'Aucun ingrédient indiqué.',
    noInstructions: 'Pas encore d’instructions.',
    notFoundMessage: 'Elle a peut-être été supprimée.',
    notFoundTitle: 'Recette introuvable',
    nothingToPreview: 'Rien à prévisualiser pour l’instant.',
    openHint: 'Ouvre la recette',
    preview: 'Aperçu',
    recipe: 'Recette',
    recipeText: 'Texte de la recette',
    saveHint: 'Enregistre la recette et l’affiche',
    saveRecipe: 'Enregistrer la recette',
    season: 'Saison',
    title: 'Titre',
    titlePlaceholder: 'ex. Soupe de potiron',
    titleRequired: 'Donnez un titre à la recette.',
    write: 'Écrire',
  },
  seasons: {
    both: 'Les deux',
    summer: 'Été',
    winter: 'Hiver',
    winterAndSummer: 'Hiver et été',
  },
  settings: {
    appearance: 'Apparence',
    dark: 'Sombre',
    language: 'Langue',
    light: 'Clair',
    showButtonLabels: 'Afficher le texte des boutons',
    showButtonLabelsHint: 'Ajoute le texte à côté des boutons à icône',
    system: 'Système',
  },
};
