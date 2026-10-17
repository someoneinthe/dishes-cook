import type { Messages, WordUnit } from './en';
import { unitName } from './en';

// French typography: a narrow no-break space before "?", "!" and ":", no-break spaces inside « ».
const NARROW_SPACE = '\u{202F}';
const quote = (text: string) => `«\u{A0}${text}\u{A0}»`;

// French uses the singular for 0 and 1.
function plural(count: number, one: string, other: string): string {
  return count <= 1 ? one : other;
}

const UNIT_WORDS: Readonly<Record<WordUnit, readonly [one: string, other: string]>> = {
  bunch: ['botte', 'bottes'],
  can: ['boîte', 'boîtes'],
  clove: ['gousse', 'gousses'],
  cup: ['tasse', 'tasses'],
  pinch: ['pincée', 'pincées'],
  tbsp: ['c. à soupe', 'c. à soupe'],
  tsp: ['c. à café', 'c. à café'],
};

export const fr: Messages = {
  about: {
    deviceList: [
      `Vos recettes, ingrédients et paramètres sont enregistrés dans une base de données sur cet appareil. C’est la copie de référence${NARROW_SPACE}: l’application fonctionne entièrement sans serveur ni connexion internet.`,
      `La sauvegarde d’Android ne les inclut pas${NARROW_SPACE}: sans serveur de synchronisation, désinstaller l’application les supprime.`,
    ],
    deviceTitle: 'Sur cet appareil',
    intro:
      'Dishes Cook garde vos recettes sur votre appareil. Voici où vont vos données, et où elles ne vont pas.',
    othersList: [
      `La lecture d’une recette depuis une photo se fait sur votre téléphone, avec la reconnaissance de texte ML Kit de Google intégrée à l’application. L’application supprime sa copie de la photo dès que le texte est lu${NARROW_SPACE}: la photo n’est pas enregistrée avec la recette et ne quitte jamais votre téléphone.`,
      `ML Kit signalerait son utilisation à Google${NARROW_SPACE}: l’application le bloque.`,
      'Pas de compte chez nous, pas de publicité, pas de statistiques d’utilisation, pas de pistage. L’application ne se connecte qu’à votre serveur de synchronisation, si vous en configurez un.',
    ],
    othersTitle: 'Rien pour personne d’autre',
    serverList: [
      'Désactivée par défaut. Dans Paramètres › Stockage des données, vous pouvez synchroniser avec un serveur PocketBase que vous installez et gérez vous-même, pour partager vos recettes entre vos appareils.',
      `Seul ce serveur reçoit vos données${NARROW_SPACE}: vos recettes (titre, type de plat, saison, instructions, ingrédients et quantités), vos ingrédients, et ceux que vous avez supprimés. Les paramètres restent sur chaque appareil.`,
      'L’appareil garde l’adresse du serveur, votre e-mail et un jeton de connexion chiffré, jamais votre mot de passe. La connexion est chiffrée (HTTPS).',
      `Le serveur est à vous${NARROW_SPACE}: personne d’autre ne le gère, et les développeurs de l’application ne peuvent pas le voir.`,
    ],
    serverTitle: 'Sur votre propre serveur, si vous le souhaitez',
    version: (version) => `Version ${version}`,
  },
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
    another: 'Une autre',
    createRecipe: 'Créer une recette',
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
    about: 'À propos',
    close: 'Fermer le menu',
    ingredients: 'Ingrédients',
    mealChoice: 'Choix du repas',
    open: 'Ouvrir le menu',
    openScreenHint: 'Ouvre cet écran',
    recipes: 'Recettes',
    settings: 'Paramètres',
  },
  quantities: {
    amountLabel: (name) => `Quantité de ${name}`,
    amountPlaceholder: 'Qté',
    chooseUnit: (name) => `Unité de ${name}`,
    decimalSeparator: ',',
    invalidAmount: 'Saisissez un nombre, comme 2, 1,5 ou 1/2.',
    line: (name, quantity) => `${name}${NARROW_SPACE}: ${quantity}`,
    pieces: 'pièces',
    // Singular below 2: « 1,5 tasse », « 2 tasses ».
    unit: (unit, amount) => unitName(UNIT_WORDS, unit, amount >= 2),
    unitButtonHint: 'Ouvre la liste des unités',
    unitButtonLabel: (name, unit) => `Unité de ${name}${NARROW_SPACE}: ${unit}`,
    unitOptionHint: 'Utilise cette unité pour la quantité',
  },
  recipes: {
    course: 'Type de plat',
    deleteMessage: 'Ses ingrédients restent dans votre liste.',
    editRecipe: 'Modifier la recette',
    emptyMessage:
      'Enregistrez les plats que vous aimez cuisiner, puis laissez le hasard en choisir un pour vous.',
    // On a TV, read-only: recipes can't be added there.
    emptyMessageOnTv:
      'Les recettes s’écrivent dans l’application, sur un téléphone. Pour les voir ici, synchronisez cette télé avec votre serveur dans les Paramètres.',
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
    newHint: 'Demande s’il faut l’écrire ou la lire sur une photo',
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
  recipeScan: {
    cameraDenied:
      'Autorisez l’appareil photo dans les réglages du téléphone pour prendre une photo, ou choisissez-en une existante.',
    choiceRequired: (existing) =>
      `Vous avez déjà ${quote(existing)}${NARROW_SPACE}: faites votre choix pour enregistrer la recette.`,
    choosePhoto: 'Choisir une photo',
    chooseTitle: 'Lire une recette sur une photo',
    keepNew: 'Garder le nouveau',
    keepNewHint: 'Crée cet ingrédient à l’enregistrement de la recette',
    keepNewLabel: (name) => `Garder ${quote(name)} comme nouvel ingrédient`,
    nothingFoundMessage:
      'Aucun texte n’a pu être lu. Essayez une photo nette et bien éclairée de la page.',
    nothingFoundTitle: 'Aucune recette trouvée',
    readFailed:
      'Impossible de lire la photo. Si cela se reproduit, fermez l’application et rouvrez-la.',
    similarMessage: (existing) =>
      `Vous avez déjà ${quote(existing)}. L’utiliser à la place${NARROW_SPACE}?`,
    startMessage: `Écrivez-la vous-même, ou remplissez-la depuis la photo d’une recette${NARROW_SPACE}: le texte est lu sur votre téléphone et la photo n’est pas gardée.`,
    takePhoto: 'Prendre une photo',
    useSimilar: (existing) => `Utiliser ${quote(existing)}`,
    useSimilarHint: 'Utilise votre ingrédient existant au lieu d’en créer un nouveau',
    write: 'L’écrire',
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
    units: 'Unités',
    unitsMetric: 'Européennes (g, l)',
    unitsUs: 'Américaines (oz, tasses)',
  },
  sync: {
    appUpdateAvailable: `Votre serveur a une version plus récente${NARROW_SPACE}: mettez l’application à jour pour profiter de ses nouveautés.`,
    chooseStorage: 'Stockage des données',
    connect: 'Se connecter',
    connectedAs: (server: string, email: string) =>
      `Synchronisé avec ${server} en tant que ${email}.`,
    connecting: 'Connexion…',
    email: 'E-mail',
    errorAppOutdated: `Cette application est trop ancienne pour votre serveur${NARROW_SPACE}: mettez-la à jour pour synchroniser à nouveau. Vos modifications restent sur ce téléphone en attendant.`,
    errorFailed: 'Le serveur a refusé la demande. Réessayez plus tard.',
    errorServerOutdated: `Votre serveur est plus ancien que cette application${NARROW_SPACE}: mettez-le à jour pour synchroniser à nouveau. Vos modifications restent sur ce téléphone en attendant.`,
    errorUnauthorized: `Le serveur a refusé la connexion. Choisissez ${quote('Cet appareil uniquement')}, puis reconnectez-vous.`,
    errorUnreachable: `Le serveur ne répond pas. L’appareil doit être sur le réseau de la maison${NARROW_SPACE}: il se resynchronise tout seul.`,
    invalidAddress: 'Saisissez l’adresse du serveur, comme recettes.exemple.fr.',
    lastSynced: (time: number) =>
      `Dernière synchronisation${NARROW_SPACE}: ${new Date(time).toLocaleString('fr', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' })}.`,
    localOnly: 'Cet appareil uniquement',
    localOnlyDescription: 'Vos données sont gardées sur cet appareil uniquement.',
    missingAccount: 'Saisissez l’e-mail et le mot de passe de votre compte sur le serveur.',
    notSyncedYet: 'Pas encore synchronisé.',
    password: 'Mot de passe',
    serverAddress: 'Adresse du serveur',
    serverAddressHint: 'Par exemple recettes.exemple.fr',
    signInDescription:
      'Connectez-vous avec le compte créé sur votre serveur. L’appareil garde ses données et les fusionne avec celles du serveur.',
    statusFailed: 'Échec de la synchronisation',
    statusFailedLabel: (pendingCount: number) =>
      pendingCount === 0
        ? 'Échec de la synchronisation'
        : plural(
            pendingCount,
            'Échec de la synchronisation, 1 modification attend sur cet appareil',
            `Échec de la synchronisation, ${pendingCount} modifications attendent sur cet appareil`,
          ),
    statusHint: 'Ouvre les réglages de synchronisation',
    statusWaiting: (pendingCount: number) =>
      plural(
        pendingCount,
        `${pendingCount} modification à synchroniser`,
        `${pendingCount} modifications à synchroniser`,
      ),
    stopSyncing: 'Arrêter',
    stopSyncingMessage: 'Vos données restent sur cet appareil et sur le serveur.',
    stopSyncingTitle: `Arrêter la synchronisation avec le serveur${NARROW_SPACE}?`,
    syncing: 'Synchronisation…',
    syncNow: 'Synchroniser',
    withServer: 'Synchronisé avec un serveur',
    wrongAccount: 'E-mail ou mot de passe incorrect.',
  },
};
