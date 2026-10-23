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
  leaf: ['feuille', 'feuilles'],
  pinch: ['pincée', 'pincées'],
  sprig: ['brin', 'brins'],
  tbsp: ['c. à soupe', 'c. à soupe'],
  tsp: ['c. à café', 'c. à café'],
};

export const fr: Messages = {
  about: {
    deviceList: [
      `Vos recettes et boissons (avec leurs photos), ingrédients et paramètres sont enregistrés sur cet appareil. C’est la copie de référence${NARROW_SPACE}: l’application fonctionne entièrement sans serveur ni connexion internet.`,
      `La sauvegarde d’Android ne les inclut pas${NARROW_SPACE}: sans serveur de synchronisation, désinstaller l’application les supprime.`,
    ],
    deviceTitle: 'Sur cet appareil',
    intro:
      'Dishes Cook garde vos recettes sur votre appareil. Voici où vont vos données, et où elles ne vont pas.',
    othersList: [
      `La lecture d’une recette depuis une photo ou un fichier (un PDF, un document Word, OpenDocument ou texte) se fait sur votre téléphone${NARROW_SPACE}: les photos et les pages des PDF avec la reconnaissance de texte ML Kit de Google intégrée à l’application, les autres documents par l’application elle-même. L’application supprime ses copies de la photo ou du fichier (et des pages du PDF) dès qu’ils sont lus${NARROW_SPACE}: rien n’est gardé et rien ne quitte votre téléphone. La photo d’une recette, ajoutée dans le formulaire, est gardée avec la recette.`,
      `ML Kit signalerait son utilisation à Google${NARROW_SPACE}: l’application le bloque.`,
      `Partager une liste de courses envoie son texte uniquement à l’application que vous choisissez (notes, messages…). La liste n’est pas enregistrée${NARROW_SPACE}: elle est oubliée quand l’application se ferme.`,
      'Partager une recette crée un PDF sur votre téléphone et l’envoie uniquement à l’application que vous choisissez. L’application supprime sa copie dès votre retour du partage.',
      'Pas de compte chez nous, pas de publicité, pas de statistiques d’utilisation, pas de pistage. L’application ne se connecte qu’à votre serveur de synchronisation, si vous en configurez un.',
    ],
    othersTitle: 'Rien pour personne d’autre',
    serverList: [
      'Désactivée par défaut. Dans Paramètres › Stockage des données, vous pouvez synchroniser avec un serveur PocketBase que vous installez et gérez vous-même, pour partager vos recettes entre vos appareils.',
      `Seul ce serveur reçoit vos données${NARROW_SPACE}: vos recettes et boissons (titre, plat ou boisson, type de plat, saison, temps de préparation et de cuisson, temps de maturation d’une boisson, instructions, ingrédients et quantités, photo), vos ingrédients, les dates où vous avez cuisiné chaque recette, et ce que vous avez supprimé. Le serveur note aussi lequel de ses comptes a ajouté chaque recette (affiché sur la recette et pour le filtre ${quote('Ajoutée par')}), et chaque compte peut y voir le nom des autres, pas leur e-mail. Les paramètres restent sur chaque appareil.`,
      'L’appareil garde l’adresse du serveur, votre e-mail, l’identifiant de votre compte sur le serveur, le nom des comptes du serveur et un jeton de connexion chiffré, jamais votre mot de passe. La connexion est chiffrée (HTTPS).',
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
    infoHint: 'Affiche une explication',
    loadingMore: 'Chargement de la suite',
    loadingMoreHint: 'D’autres éléments s’affichent une fois chargés',
    more: 'Plus d’actions',
    moreHint: 'Ouvre un menu avec les autres actions',
    ok: 'OK',
    save: 'Enregistrer',
    setsChoice: (label, option) => `Choisit ${option} comme ${label.toLowerCase()}`,
    tryAgain: 'Réessayer',
  },
  courses: {
    dessert: 'Dessert',
    main: 'Plat principal',
    starter: 'Entrée',
  },
  database: {
    openFailed: (reason) => `Impossible d’ouvrir la base des recettes${NARROW_SPACE}: ${reason}`,
  },
  drinks: {
    deletedWhileEditingMessage: `Elle a été supprimée sur un autre appareil pendant que vous la modifiiez. Enregistrer votre version comme nouvelle boisson${NARROW_SPACE}?`,
    deletedWhileEditingTitle: 'Cette boisson a été supprimée',
    editRecipe: 'Modifier la boisson',
    emptyMessage: `Enregistrez les boissons que vous aimez préparer${NARROW_SPACE}: cocktails, smoothies, boissons chaudes…`,
    emptyMessageOnTv:
      'Les boissons s’écrivent dans l’application, sur un téléphone. Pour les voir ici, synchronisez cette télé avec votre serveur dans les Paramètres.',
    emptyTitle: 'Aucune boisson pour l’instant',
    instructionsPlaceholder: 'Étapes, quantités…',
    matchCount: (count) =>
      count === 0
        ? 'Aucune boisson ne correspond à ces filtres.'
        : plural(count, '1 boisson correspond.', `${count} boissons correspondent.`),
    newRecipe: 'Nouvelle boisson',
    noMatch: (search) => `Aucune boisson ne correspond à ${quote(search)}.`,
    notFoundTitle: 'Boisson introuvable',
    openHint: 'Ouvre la boisson',
    saveHint: 'Enregistre la boisson et l’affiche',
    saveRecipe: 'Enregistrer la boisson',
    search: 'Rechercher des boissons',
    showFiltersHint: (isAuthorShown) =>
      isAuthorShown
        ? 'Affiche les filtres d’auteur et d’ingrédients'
        : 'Affiche le filtre d’ingrédients',
    titlePlaceholder: `Ex.${NARROW_SPACE}: mojito`,
    titleRequired: 'Donnez un nom à la boisson.',
  },
  filters: {
    addedBy: 'Ajoutée par',
    any: 'Indifférent',
    anyone: 'Tout le monde',
    hideHint: 'Masque les filtres, qui restent appliqués',
    me: 'Moi',
    noUsedIngredient: 'Aucun ingrédient n’est encore utilisé dans une recette.',
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
    resultSummary: (count, canCreate) => {
      if (count > 0) {
        return plural(count, `${count} ingrédient trouvé.`, `${count} ingrédients trouvés.`);
      }
      return canCreate
        ? `Aucun ingrédient correspondant${NARROW_SPACE}: vous pouvez le créer.`
        : 'Aucun ingrédient correspondant.';
    },
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
  languageCode: 'fr',
  loading: {
    hint: 'L’application s’ouvre d’elle-même une fois chargée',
    label: 'Chargement de Dishes Cook',
  },
  markdown: {
    image: (description) => (description ? `Image${NARROW_SPACE}: ${description}` : 'Image'),
  },
  mealChoice: {
    allPicked: 'Toutes les recettes qui correspondent sont dans votre liste de courses.',
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
  mealHistory: {
    about: (skipDays, isOnTv) => {
      const skip =
        skipDays > 0 ? ` Le choix du repas l’évite ensuite pendant ${skipDays}\u{A0}jours.` : '';
      return isOnTv
        ? `La dernière fois que cette recette a été cuisinée, notée avec ${quote('Je l’ai cuisinée')} sur un téléphone.${skip}`
        : `Appuyez sur ${quote('Je l’ai cuisinée')} une fois la recette faite${NARROW_SPACE}: la date s’affiche ici.${skip || ' Le choix du repas peut éviter les repas récents (Paramètres › Éviter les repas récents).'}`;
    },
    aboutLabel: 'À propos de l’historique des repas',
    cooked: 'Je l’ai cuisinée',
    cookedHint: `Note que vous l’avez cuisinée aujourd’hui${NARROW_SPACE}: le choix du repas l’évite pendant un temps`,
    lastCooked: (daysAgo, time) => {
      if (daysAgo <= 0) {
        return 'Cuisinée aujourd’hui';
      }
      if (daysAgo === 1) {
        return 'Cuisinée hier';
      }
      return daysAgo <= 30
        ? `Cuisinée il y a ${daysAgo}\u{A0}jours`
        : `Cuisinée le ${new Date(time).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    },
    neverCooked: 'Pas encore cuisinée',
    remove: 'Retirer',
    removeLabel: 'Retirer la dernière fois où elle a été cuisinée',
    removeMessage: 'Seule cette date est retirée, pas la recette.',
  },
  menu: {
    about: 'À propos',
    close: 'Fermer le menu',
    drinks: 'Boissons',
    ingredients: 'Ingrédients',
    mealChoice: 'Choix du repas',
    open: 'Ouvrir le menu',
    openScreenHint: 'Ouvre cet écran',
    recipes: 'Recettes',
    settings: 'Paramètres',
    shoppingList: 'Liste de courses',
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
    addedBy: (name) => `Ajoutée par ${name}`,
    addedBySomeoneElse: 'Ajoutée par quelqu’un d’autre',
    addedByYou: 'Ajoutée par vous',
    addPhoto: 'Ajouter une photo',
    addPhotoHint: 'Prend une photo ou en choisit une dans votre galerie',
    cantShowMessage:
      'Une partie ne peut pas s’afficher. Vos autres recettes ne sont pas concernées.',
    cantShowTitle: 'Cette recette ne peut pas s’afficher',
    changePhoto: 'Changer la photo',
    cookTime: 'Cuisson (min)',
    course: 'Type de plat',
    deletedWhileEditingMessage: `Elle a été supprimée sur un autre appareil pendant que vous la modifiiez. Enregistrer votre version comme nouvelle recette${NARROW_SPACE}?`,
    deletedWhileEditingTitle: 'Cette recette a été supprimée',
    deleteMessage: 'Ses ingrédients restent dans votre liste.',
    duration: (hours, minutes) => {
      if (hours === 0) {
        return `${minutes}\u{A0}min`;
      }
      return minutes === 0 ? `${hours}\u{A0}h` : `${hours}\u{A0}h\u{A0}${minutes}`;
    },
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
    invalidMaturation: 'Entrez un nombre de mois jusqu’à 24, comme 0,5 ou 2.',
    invalidMinutes: 'Entrez un nombre de minutes, comme 20.',
    matchCount: (count) =>
      count === 0
        ? 'Aucune recette ne correspond à ces filtres.'
        : plural(count, '1 recette correspond.', `${count} recettes correspondent.`),
    maturationTime: 'Maturation (mois)',
    minutesPlaceholder: 'ex. 20',
    months: (count) => `${count}\u{A0}mois`,
    monthsPlaceholder: 'ex. 0,5',
    new: 'Nouvelle',
    newHint: 'Demande s’il faut l’écrire, ou la lire depuis un fichier ou une photo',
    newRecipe: 'Nouvelle recette',
    noIngredients: 'Aucun ingrédient indiqué.',
    noInstructions: 'Pas encore d’instructions.',
    noMatch: (search) => `Aucune recette ne correspond à ${quote(search)}.`,
    notFoundMessage: 'Elle a peut-être été supprimée.',
    notFoundTitle: 'Recette introuvable',
    nothingToPreview: 'Rien à prévisualiser pour l’instant.',
    openHint: 'Ouvre la recette',
    photo: 'Photo',
    photoAlt: (title) => `Photo de ${title}`,
    photoFailed: 'La photo n’a pas pu être ajoutée. Essayez-en une autre.',
    photoName: 'cette photo',
    prepTime: 'Préparation (min)',
    preview: 'Aperçu',
    recipe: 'Recette',
    recipeText: 'Texte de la recette',
    removePhoto: 'Retirer la photo',
    removePhotoMessage: 'La recette reste telle quelle.',
    rowLabel: (title, detailList) => [title, ...detailList].filter(Boolean).join(', '),
    saveAsNew: 'Enregistrer comme nouvelle',
    saveHint: 'Enregistre la recette et l’affiche',
    saveRecipe: 'Enregistrer la recette',
    search: 'Rechercher des recettes',
    searchPlaceholder: 'Chercher par titre',
    season: 'Saison',
    share: 'Partager en PDF',
    shareDialogTitle: (title) => `Partager ${title}`,
    shareFailedMessage: 'Réessayez. Si cela se reproduit, fermez l’application et rouvrez-la.',
    shareFailedTitle: 'Le PDF n’a pas pu être créé',
    shareHint: `Envoie la recette en PDF à une autre application${NARROW_SPACE}: messages, e-mail, un drive…`,
    showFiltersHint: (isAuthorShown) =>
      isAuthorShown
        ? 'Affiche les filtres d’auteur, de saison, de type de plat et d’ingrédients'
        : 'Affiche les filtres de saison, de type de plat et d’ingrédients',
    times: (times) =>
      [
        times.prep && `Préparation ${times.prep}`,
        times.cook && `Cuisson ${times.cook}`,
        times.total && `${times.total} en tout`,
        times.maturation && `Maturation ${times.maturation}`,
      ]
        .filter(Boolean)
        .join(' · '),
    title: 'Titre',
    titlePlaceholder: `Ex.${NARROW_SPACE}: soupe de potiron`,
    titleRequired: 'Donnez un titre à la recette.',
    write: 'Écrire',
  },
  recipeScan: {
    cameraDenied:
      'Autorisez l’appareil photo dans les réglages du téléphone pour prendre une photo, ou choisissez plutôt un fichier.',
    choiceRequired: (existing) =>
      `Vous avez déjà ${quote(existing)}${NARROW_SPACE}: faites votre choix pour enregistrer la recette.`,
    chooseFile: 'Choisir un fichier',
    choosePhoto: 'Choisir une photo',
    chooseTitle: 'Lire une recette sur une photo',
    keepNew: 'Garder le nouveau',
    keepNewHint: 'Crée cet ingrédient à l’enregistrement de la recette',
    keepNewLabel: (name) => `Garder ${quote(name)} comme nouvel ingrédient`,
    nothingFoundMessage:
      'Aucun texte n’a pu être lu. Pour une photo, essayez-en une nette et bien éclairée de la page.',
    nothingFoundTitle: 'Aucune recette trouvée',
    pagesCutMessage: (maxPages) =>
      `Seules ses ${maxPages} premières pages ont été lues${NARROW_SPACE}: vérifiez la fin de la recette.`,
    pagesCutTitle: 'Un long PDF',
    readFailed: `Impossible de lire le fichier (abîmé, ou protégé par un mot de passe${NARROW_SPACE}?). Si cela se reproduit avec d’autres, fermez l’application et rouvrez-la.`,
    reading: 'Lecture de la recette…',
    similarMessage: (existing) =>
      `Vous avez déjà ${quote(existing)}. L’utiliser à la place${NARROW_SPACE}?`,
    startMessage: `Écrivez-la vous-même, ou remplissez-la depuis un fichier (une photo, un PDF, un document Word, OpenDocument ou texte) ou la photo d’une page de recette${NARROW_SPACE}: c’est lu sur votre téléphone et rien n’est gardé.`,
    takePhoto: 'Prendre une photo',
    unsupportedMessage: `Choisissez une photo, un PDF, un fichier Word (.docx), OpenDocument (.odt) ou texte (.txt). Les anciens fichiers Word (.doc) ne peuvent pas être lus${NARROW_SPACE}: enregistrez-les d’abord en .docx.`,
    unsupportedTitle: 'Ce fichier ne peut pas être lu',
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
    appGroup: 'Application et données',
    cookingGroup: 'Cuisine',
    dark: 'Sombre',
    language: 'Langue',
    light: 'Clair',
    recentMeals: 'Éviter les repas récents',
    recentMealsDays: (days) => (days === 0 ? 'Non' : `${days}\u{A0}jours`),
    showButtonLabels: 'Afficher le texte des boutons',
    showButtonLabelsHint: 'Ajoute le texte à côté des boutons à icône',
    system: 'Système',
    units: 'Unités',
    unitsMetric: 'Européennes (g, l)',
    unitsUs: 'Américaines (oz, tasses)',
  },
  shoppingList: {
    add: 'Ajouter à la liste',
    addHint: 'Ajoute ses ingrédients à la liste de courses, et suggère une autre recette',
    addLabel: (title) => `Ajouter ${title} à la liste de courses`,
    addToList: 'Ajouter à la liste de courses',
    addToListHint: 'Ajoute ses ingrédients à la liste de courses',
    emptyMessage: `Ajoutez des repas depuis le choix du repas ou une recette${NARROW_SPACE}: leurs ingrédients sont listés ici, prêts à partager.`,
    emptyTitle: 'Aucun repas choisi',
    fullHint: (max) => `La liste de courses est pleine${NARROW_SPACE}: ${max}\u{A0}repas au plus`,
    helpContinue: (count) =>
      plural(
        count,
        '1\u{A0}repas est dans votre liste de courses. Ajoutez-en d’autres, ou ouvrez la liste avec le bouton ci-dessous pour partager ses ingrédients.',
        `${count}\u{A0}repas sont dans votre liste de courses. Ajoutez-en d’autres, ou ouvrez la liste avec le bouton ci-dessous pour partager leurs ingrédients.`,
      ),
    helpStart: `Pour faire une liste de courses, ajoutez un ou plusieurs repas avec le bouton panier, puis ouvrez la liste avec le bouton qui apparaît en bas pour partager leurs ingrédients.`,
    ingredients: 'Ingrédients',
    markCooked: 'Noter comme cuisinés',
    markCookedHint: 'Le choix du repas les évite ensuite pendant un temps',
    markCookedMessage: (count) =>
      plural(
        count,
        `Noter ce repas comme cuisiné aujourd’hui${NARROW_SPACE}? Le choix du repas l’évite ensuite pendant un temps.`,
        `Noter ces ${count}\u{A0}repas comme cuisinés aujourd’hui${NARROW_SPACE}? Le choix du repas les évite ensuite pendant un temps.`,
      ),
    meals: (count) => `Repas (${count})`,
    mealsLine: (titleList) => `Repas${NARROW_SPACE}: ${titleList.join(', ')}`,
    noIngredients: 'Ces repas ne listent aucun ingrédient.',
    notNow: 'Plus tard',
    openButton: (count) => `Liste de courses (${count})`,
    openHint: 'Ouvre la liste de courses',
    openLabel: (count) =>
      count === 0 ? 'Liste de courses' : `Liste de courses, ${count}\u{A0}repas`,
    quantitySeparator: ' + ',
    removeFromList: 'Retirer de la liste de courses',
    removeHint: 'L’enlève de la liste de courses',
    removeLabel: (title) => `Retirer ${title} de la liste`,
    share: 'Partager',
    shareHint: `Envoie la liste à une autre application${NARROW_SPACE}: notes, messages, e-mail…`,
    title: 'Liste de courses',
    truncated: (max) => `Seules les ${max}\u{A0}premières lignes sont listées.`,
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
    insecureAddress: `Utilisez une adresse en https://${NARROW_SPACE}: le mot de passe et les recettes voyagent chiffrés.`,
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
