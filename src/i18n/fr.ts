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
    ok: 'OK',
    save: 'Enregistrer',
    setsChoice: (label, option) => `Choisit ${option} comme ${label.toLowerCase()}`,
  },
  courses: {
    dessert: 'Dessert',
    main: 'Plat principal',
    starter: 'Entrée',
  },
  database: {
    openFailed: (reason) => `Impossible d’ouvrir la base des recettes${NARROW_SPACE}: ${reason}`,
  },
  filters: {
    any: 'Indifférent',
    hideHint: 'Masque les filtres, qui restent appliqués',
    noUsedIngredient: 'Aucun ingrédient n’est encore utilisé dans une recette.',
    showHint: 'Affiche les filtres de saison, de type de plat et d’ingrédients',
    toggle: (activeCount) => (activeCount > 0 ? `Filtres (${activeCount})` : 'Filtres'),
    withIngredients: 'Avec les ingrédients',
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
    placeholder: `Ex.${NARROW_SPACE}: carotte`,
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
    hint: 'L’application s’ouvre d’elle-même une fois chargée',
    label: 'Chargement de Dishes Cook',
  },
  markdown: {
    image: (description) => (description ? `Image${NARROW_SPACE}: ${description}` : 'Image'),
  },
  mealChoice: {
    addRecipe: 'Ajouter une recette',
    another: 'Une autre',
    emptyMessage: 'Ajoutez quelques recettes, puis revenez laisser le hasard choisir le repas.',
    open: 'Ouvrir',
    openLabel: (title) => `Ouvrir ${title}`,
    promptMessage: (count) =>
      count === 1
        ? `Touchez Suggérer${NARROW_SPACE}: le hasard choisit la seule recette qui correspond.`
        : `Touchez Suggérer${NARROW_SPACE}: le hasard choisit parmi les ${count} recettes qui correspondent.`,
    promptTitle: `Qu’est-ce qu’on mange${NARROW_SPACE}?`,
    suggest: 'Suggérer',
    suggestAnother: 'Suggérer une autre recette',
    suggestHint: 'Choisit au hasard une recette qui correspond',
    suggestionIntro: 'Et si on mangeait…',
    suggestRecipe: 'Suggérer une recette',
  },
  menu: {
    close: 'Fermer le menu',
    ingredients: 'Ingrédients',
    mealChoice: 'Choix du repas',
    open: 'Ouvrir le menu',
    recipes: 'Recettes',
    settings: 'Paramètres',
  },
  recipes: {
    course: 'Type de plat',
    deleteMessage: 'Ses ingrédients restent dans votre liste.',
    editRecipe: 'Modifier la recette',
    emptyMessage:
      'Enregistrez les plats que vous aimez cuisiner, puis laissez le hasard en choisir un pour vous.',
    emptyTitle: 'Aucune recette pour l’instant',
    formatHint:
      `Mise en forme en Markdown${NARROW_SPACE}: #\u{A0}Titre, **gras**, *italique*, ` +
      '-\u{A0}élément de liste, 1.\u{A0}étape numérotée. Les retours à la ligne sont conservés.',
    ingredientCount: (count) => plural(count, `${count} ingrédient`, `${count} ingrédients`),
    ingredients: 'Ingrédients',
    ingredientsEmpty: 'Saisissez un ingrédient pour l’ajouter.',
    instructionsPlaceholder: 'Étapes, quantités, temps de cuisson…',
    matchCount: (count) =>
      count === 0
        ? 'Aucune recette ne correspond à ces filtres.'
        : plural(count, '1 recette correspond.', `${count} recettes correspondent.`),
    new: 'Nouvelle',
    newHint: 'Ouvre un formulaire de recette vide',
    newRecipe: 'Nouvelle recette',
    noIngredients: 'Aucun ingrédient indiqué.',
    noInstructions: 'Pas encore d’instructions.',
    noMatch: (search) => `Aucune recette ne correspond à ${quote(search)}.`,
    notFoundMessage: 'Elle a peut-être été supprimée.',
    notFoundTitle: 'Recette introuvable',
    nothingToPreview: 'Rien à prévisualiser pour l’instant.',
    openHint: 'Ouvre la recette',
    preview: 'Aperçu',
    recipe: 'Recette',
    recipeText: 'Texte de la recette',
    rowLabel: (title, season, course) => [title, season, course].filter(Boolean).join(', '),
    saveHint: 'Enregistre la recette et l’affiche',
    saveRecipe: 'Enregistrer la recette',
    search: 'Rechercher des recettes',
    searchPlaceholder: 'Chercher par titre',
    season: 'Saison',
    title: 'Titre',
    titlePlaceholder: `Ex.${NARROW_SPACE}: soupe de potiron`,
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
  sync: {
    chooseStorage: 'Stockage des données',
    connect: 'Se connecter',
    connectedAs: (server: string, email: string) =>
      `Synchronisé avec ${server} en tant que ${email}.`,
    connecting: 'Connexion…',
    email: 'E-mail',
    errorFailed: 'Le serveur a refusé la demande. Réessayez plus tard.',
    errorUnauthorized: `Le serveur a refusé la connexion. Choisissez ${quote('Ce téléphone uniquement')}, puis reconnectez-vous.`,
    errorUnreachable: `Le serveur ne répond pas. Le téléphone doit être sur le réseau de la maison${NARROW_SPACE}: il se resynchronise tout seul.`,
    invalidAddress: 'Saisissez l’adresse du serveur, comme recettes.exemple.fr.',
    lastSynced: (time: number) =>
      `Dernière synchronisation${NARROW_SPACE}: ${new Date(time).toLocaleString('fr', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' })}.`,
    localOnly: 'Ce téléphone uniquement',
    localOnlyDescription: 'Vos données sont gardées sur ce téléphone uniquement.',
    missingAccount: 'Saisissez l’e-mail et le mot de passe de votre compte sur le serveur.',
    notSyncedYet: 'Pas encore synchronisé.',
    password: 'Mot de passe',
    serverAddress: 'Adresse du serveur',
    serverAddressHint: 'Par exemple recettes.exemple.fr',
    signInDescription:
      'Connectez-vous avec le compte créé sur votre serveur. Le téléphone garde ses données et les fusionne avec celles du serveur.',
    stopSyncing: 'Arrêter',
    stopSyncingMessage: 'Vos données restent sur ce téléphone et sur le serveur.',
    stopSyncingTitle: `Arrêter la synchronisation avec le serveur${NARROW_SPACE}?`,
    syncing: 'Synchronisation…',
    syncNow: 'Synchroniser',
    withServer: 'Synchronisé avec un serveur',
    wrongAccount: 'E-mail ou mot de passe incorrect.',
  },
};
