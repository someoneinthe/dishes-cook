// The app's UI text in English: the reference language. Every other language defines the same
// entries (type `Messages`, checked by TypeScript). Functions build the texts with a name or a
// count in them. User content (recipe titles, ingredients) is never translated.

import type { Unit } from '@/lib/units';

// A unit's symbol ("kg"), or its word in the singular or plural ("cup", "cups").
export function unitName(
  wordList: Readonly<Record<WordUnit, readonly [one: string, other: string]>>,
  unit: Unit,
  isPlural: boolean,
): string {
  if (Object.hasOwn(UNIT_SYMBOLS, unit)) {
    return UNIT_SYMBOLS[unit as keyof typeof UNIT_SYMBOLS];
  }
  return wordList[unit as WordUnit][isPlural ? 1 : 0];
}

function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}

// Units written the same in every language; the others are words, translated in each dictionary.
export const UNIT_SYMBOLS = {
  cl: 'cl',
  fl_oz: 'fl oz',
  g: 'g',
  kg: 'kg',
  l: 'l',
  lb: 'lb',
  ml: 'ml',
  oz: 'oz',
} as const satisfies Partial<Record<Unit, string>>;
export type WordUnit = Exclude<Unit, keyof typeof UNIT_SYMBOLS>;

const UNIT_WORDS: Readonly<Record<WordUnit, readonly [one: string, other: string]>> = {
  bunch: ['bunch', 'bunches'],
  can: ['can', 'cans'],
  clove: ['clove', 'cloves'],
  cup: ['cup', 'cups'],
  leaf: ['leaf', 'leaves'],
  pinch: ['pinch', 'pinches'],
  sprig: ['sprig', 'sprigs'],
  tbsp: ['tbsp', 'tbsp'],
  tsp: ['tsp', 'tsp'],
};

export const en = {
  // The About screen: where people's data goes. It must stay true: a change to what the app keeps
  // or sends (sync, a new network call, analytics…) updates it in every language (CONTRIBUTING.md).
  about: {
    deviceList: [
      'Your recipes and drinks (their photos included), ingredients and settings are saved on this device. It’s the reference copy: the app works fully without a server or an internet connection.',
      'Android’s backup doesn’t save them: without a sync server, uninstalling the app deletes them.',
    ],
    deviceTitle: 'On this device',
    intro:
      'Dishes Cook keeps your recipes on your device. Here is where your data goes, and where it doesn’t.',
    othersList: [
      'Reading a recipe from a photo happens on your phone, with Google’s ML Kit text recognition built into the app. The app deletes its copy of that photo as soon as the text is read: it isn’t kept and never leaves your phone. A recipe’s own photo, added in the form, is kept with the recipe.',
      'ML Kit would report how it’s used to Google: the app blocks this.',
      'Sharing a shopping list sends its text only to the app you pick (notes, messages…). The list isn’t saved: it’s forgotten when the app closes.',
      'Sharing a recipe makes a PDF on your phone and sends it only to the app you pick. The app deletes its copy as soon as you come back from sharing.',
      'No account with us, no ads, no analytics, no tracking. The app connects to nothing but your sync server, if you set one up.',
    ],
    othersTitle: 'Nothing for anyone else',
    serverList: [
      'Off by default. In Settings › Data storage, you can sync with a PocketBase server that you install and run yourself, to share your recipes between your devices.',
      'Only that server receives your data: your recipes and drinks (title, dish or drink, course, season, times, instructions, ingredients and quantities, photo), your ingredients, the dates you cooked each recipe, and what you deleted. Settings stay on each device.',
      'The device keeps the server’s address, your email and an encrypted sign-in token, never your password. The connection is encrypted (HTTPS).',
      'The server is yours: no one else runs it, and the app’s developers can’t see it.',
    ],
    serverTitle: 'On your own server, if you choose',
    version: (version: string) => `Version ${version}`,
  },
  common: {
    back: 'Go back',
    cancel: 'Cancel',
    chooseOneOption: 'Choose one option',
    delete: 'Delete',
    deleteHint: 'Asks for confirmation first',
    deleteTitle: (name: string) => `Delete “${name}”?`,
    edit: 'Edit',
    loadingMore: 'Loading more',
    loadingMoreHint: 'More items appear when they are loaded',
    ok: 'OK',
    save: 'Save',
    // Hint of a segmented choice: "Sets season to Winter" (options keep their case: "English").
    setsChoice: (label: string, option: string) => `Sets ${label.toLowerCase()} to ${option}`,
    tryAgain: 'Try again',
  },
  courses: {
    dessert: 'Dessert',
    main: 'Main course',
    starter: 'Starter',
  },
  database: {
    openFailed: (reason: string) => `The recipes database could not be opened: ${reason}`,
  },
  // The texts of src/features/recipes/kind.ts that differ for a drink (the others are the recipes').
  drinks: {
    deletedWhileEditingMessage:
      'It was deleted on another device while you were editing it. Save your version as a new drink?',
    deletedWhileEditingTitle: 'This drink was deleted',
    editRecipe: 'Edit drink',
    emptyMessage: 'Save the drinks you like to make: cocktails, smoothies, hot drinks…',
    emptyMessageOnTv:
      'Drinks are written in the app on a phone. To see them here, sync this TV with your server in Settings.',
    emptyTitle: 'No drinks yet',
    instructionsPlaceholder: 'Steps, quantities…',
    matchCount: (count: number) =>
      count === 0
        ? 'No drink matches these filters.'
        : plural(count, '1 drink matches.', `${count} drinks match.`),
    newRecipe: 'New drink',
    noMatch: (search: string) => `No drink matches “${search}”.`,
    notFoundTitle: 'Drink not found',
    openHint: 'Opens the drink',
    saveHint: 'Saves the drink and shows it',
    saveRecipe: 'Save drink',
    search: 'Search drinks',
    showFiltersHint: 'Shows the ingredient filter',
    titlePlaceholder: 'e.g. Mojito',
    titleRequired: 'Give the drink a name.',
  },
  filters: {
    any: 'Any',
    hideHint: 'Hides the filters; they stay applied',
    noUsedIngredient: 'No ingredient is used by a recipe yet.',
    // The show / hide button, with how many filters are on: "Filters (2)".
    toggle: (activeCount: number) => (activeCount > 0 ? `Filters (${activeCount})` : 'Filters'),
    withIngredients: 'With ingredients',
  },
  ingredientPicker: {
    addHint: 'Adds it to the selection',
    addLabel: (name: string) => `Add ${name}`,
    createChip: (name: string) => `New: ${name}`,
    createHint: 'Creates the ingredient and adds it to the selection',
    createLabel: (name: string) => `Create ${name}`,
    noMatch: 'No matching ingredient.',
    placeholder: 'Search an ingredient',
    placeholderWithCreate: 'Search or add an ingredient',
    removeHint: 'Removes it from the selection',
    removeLabel: (name: string) => `Remove ${name}`,
    // Read by screen readers once typing pauses: what the search found.
    resultSummary: (count: number, canCreate: boolean) => {
      if (count > 0) {
        return plural(count, '1 ingredient found.', `${count} ingredients found.`);
      }
      return canCreate ? 'No matching ingredient: it can be created.' : 'No matching ingredient.';
    },
    // Label of the search field, from the picker's label: "Search ingredients".
    searchLabel: (label: string) => `Search ${label.toLowerCase()}`,
  },
  ingredients: {
    add: 'Add',
    addHint: 'Adds the name typed in the search field',
    addLabel: 'Add ingredient',
    alreadyExists: (name: string) => `“${name}” already exists.`,
    deleteLabel: (name: string) => `Delete ${name}`,
    emptyMessage: 'Add the ingredients you cook with, here or while writing a recipe.',
    emptyTitle: 'No ingredients yet',
    inUseMessage: 'Remove it from its recipes first.',
    inUseTitle: (name: string) => `“${name}” is used by a recipe`,
    nameBlank: 'The name cannot be empty.',
    nameTaken: 'Another ingredient already has this name.',
    noMatch: (search: string) => `No ingredient matches “${search}”.`,
    placeholder: 'e.g. Carrot',
    rename: 'Rename',
    renameHint: 'Lets you edit its name',
    renameLabel: (name: string) => `Rename ${name}`,
    searchOrAdd: 'Search or add an ingredient',
    typeName: 'Type the name of the ingredient to add.',
    usage: (recipeCount: number) =>
      recipeCount === 0
        ? 'Not used yet'
        : plural(recipeCount, 'Used in 1 recipe', `Used in ${recipeCount} recipes`),
  },
  // The language's code (BCP 47), e.g. for the shared PDF's `lang`.
  languageCode: 'en',
  loading: {
    hint: 'The app opens automatically once it has loaded',
    label: 'Loading Dishes Cook',
  },
  markdown: {
    image: (description: string) => (description ? `Image: ${description}` : 'Image'),
  },
  mealChoice: {
    // Every matching recipe is in the shopping list: none left to suggest.
    allPicked: 'Every matching recipe is in your shopping list.',
    another: 'Another one',
    createRecipe: 'Create a recipe',
    emptyMessage: 'Add a few recipes, then come back to let chance decide what to eat.',
    open: 'Open',
    openLabel: (title: string) => `Open ${title}`,
    promptMessage: (count: number) =>
      count === 1
        ? 'Tap Suggest: chance picks the only matching recipe.'
        : `Tap Suggest: chance picks one of the ${count} matching recipes.`,
    promptTitle: 'What shall we eat?',
    suggest: 'Suggest',
    suggestAnother: 'Suggest another one',
    suggestHint: 'Picks a matching recipe at random',
    suggestionIntro: 'How about…',
    suggestRecipe: 'Suggest a recipe',
  },
  mealHistory: {
    cooked: 'I cooked it',
    cookedHint: 'Records that you cooked it today: the meal choice skips it for a while',
    // When the recipe was last cooked, from the number of calendar days since: "Cooked yesterday".
    lastCooked: (daysAgo: number, time: number) => {
      if (daysAgo <= 0) {
        return 'Cooked today';
      }
      if (daysAgo === 1) {
        return 'Cooked yesterday';
      }
      return daysAgo <= 30
        ? `Cooked ${daysAgo} days ago`
        : `Cooked on ${new Date(time).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    },
    neverCooked: 'Not cooked yet',
    remove: 'Remove',
    removeLabel: 'Remove the last time it was cooked',
    removeMessage: 'Only this date is removed, not the recipe.',
  },
  menu: {
    about: 'About',
    close: 'Close the menu',
    drinks: 'Drinks',
    ingredients: 'Ingredients',
    mealChoice: 'Meal choice',
    open: 'Show navigation menu',
    openScreenHint: 'Opens this screen',
    recipes: 'Recipes',
    settings: 'Settings',
    shoppingList: 'Shopping list',
  },
  quantities: {
    amountLabel: (name: string) => `Quantity of ${name}`,
    amountPlaceholder: 'Qty',
    chooseUnit: (name: string) => `Unit of ${name}`,
    decimalSeparator: '.',
    invalidAmount: 'Enter a number, like 2, 1.5 or 1/2.',
    line: (name: string, quantity: string) => `${name}: ${quantity}`,
    pieces: 'pieces',
    // Up to 1 in the singular: "1 cup", "0.5 cup", "2 cups".
    unit: (unit: Unit, amount: number) => unitName(UNIT_WORDS, unit, amount > 1),
    unitButtonHint: 'Opens the list of units',
    unitButtonLabel: (name: string, unit: string) => `Unit of ${name}: ${unit}`,
    unitOptionHint: 'Uses this unit for the quantity',
  },
  recipes: {
    addPhoto: 'Add a photo',
    addPhotoHint: 'Takes a photo or picks one from your gallery',
    // A recipe screen that failed to show (src/features/recipes/recipe-error-boundary.tsx).
    cantShowMessage: 'Something in it can’t be displayed. Your other recipes aren’t affected.',
    cantShowTitle: 'This recipe can’t be shown',
    changePhoto: 'Change the photo',
    cookTime: 'Cooking (min)',
    course: 'Course',
    deletedWhileEditingMessage:
      'It was deleted on another device while you were editing it. Save your version as a new recipe?',
    deletedWhileEditingTitle: 'This recipe was deleted',
    deleteMessage: 'Its ingredients stay in your list.',
    // A duration from its hours and minutes: "45 min", "1 h", "1 h 30 min".
    duration: (hours: number, minutes: number) => {
      if (hours === 0) {
        return `${minutes} min`;
      }
      return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
    },
    editRecipe: 'Edit recipe',
    emptyMessage: 'Save the dishes you like to cook, then let the meal choice pick one for you.',
    // On a TV, read-only: recipes can't be added there.
    emptyMessageOnTv:
      'Recipes are written in the app on a phone. To see them here, sync this TV with your server in Settings.',
    emptyTitle: 'No recipes yet',
    // No-break spaces keep each example on one line ("-" never ends a line alone).
    formatHint:
      'Format it with Markdown: #\u{A0}Heading, **bold**, *italic*, -\u{A0}list item, ' +
      '1.\u{A0}numbered step. Line breaks are kept.',
    ingredientCount: (count: number) => plural(count, '1 ingredient', `${count} ingredients`),
    ingredients: 'Ingredients',
    ingredientsEmpty: 'Type an ingredient to add it.',
    instructionsPlaceholder: 'Steps, quantities, cooking time…',
    invalidMinutes: 'Enter a number of minutes, like 20.',
    matchCount: (count: number) =>
      count === 0
        ? 'No recipe matches these filters.'
        : plural(count, '1 recipe matches.', `${count} recipes match.`),
    minutesPlaceholder: 'e.g. 20',
    // Label of the add-recipe buttons, shown with Settings › Show button labels.
    new: 'New',
    newHint: 'Asks whether to write it or to read it from a photo',
    newRecipe: 'New recipe',
    noIngredients: 'No ingredients listed.',
    noInstructions: 'No instructions written yet.',
    noMatch: (search: string) => `No recipe matches “${search}”.`,
    notFoundMessage: 'It may have been deleted.',
    notFoundTitle: 'Recipe not found',
    nothingToPreview: 'Nothing to preview yet.',
    openHint: 'Opens the recipe',
    photo: 'Photo',
    photoAlt: (title: string) => `Photo of ${title}`,
    photoFailed: 'The photo couldn’t be added. Try another one.',
    // The photo removed, in the confirmation: "Delete “this photo”?".
    photoName: 'this photo',
    prepTime: 'Preparation (min)',
    preview: 'Preview',
    recipe: 'Recipe',
    recipeText: 'Recipe text',
    removePhoto: 'Remove the photo',
    removePhotoMessage: 'The recipe stays as it is.',
    // What screen readers say for a row of the recipe list: "Pumpkin soup, Winter, Starter".
    // A recipe of the list, read as one: "Leek soup, Winter, Main course, 3 ingredients".
    rowLabel: (title: string, season?: string, course?: string, ingredients?: string) =>
      [title, season, course, ingredients].filter(Boolean).join(', '),
    saveAsNew: 'Save as new',
    saveHint: 'Saves the recipe and shows it',
    saveRecipe: 'Save recipe',
    search: 'Search recipes',
    searchPlaceholder: 'Search by title',
    season: 'Season',
    share: 'Share as PDF',
    shareDialogTitle: (title: string) => `Share ${title}`,
    shareFailedMessage: 'Try again. If it happens again, close the app and open it again.',
    shareFailedTitle: 'The PDF couldn’t be made',
    shareHint: 'Sends the recipe as a PDF to another app: messages, email, a drive…',
    // The Filters button of the recipe list (a drink's: drinks.showFiltersHint).
    showFiltersHint: 'Shows the season, course and ingredient filters',
    // "Preparation 15 min · Cooking 30 min · 45 min in all": the times a recipe gives.
    times: (times: Readonly<{ cook?: string; prep?: string; total?: string }>) =>
      [
        times.prep && `Preparation ${times.prep}`,
        times.cook && `Cooking ${times.cook}`,
        times.total && `${times.total} in all`,
      ]
        .filter(Boolean)
        .join(' · '),
    title: 'Title',
    titlePlaceholder: 'e.g. Pumpkin soup',
    titleRequired: 'Give the recipe a title.',
    write: 'Write',
  },
  recipeScan: {
    cameraDenied:
      'Allow the camera in the phone’s settings to take a photo, or choose an existing one.',
    choiceRequired: (existing: string) =>
      `You already have “${existing}”: choose one to save the recipe.`,
    choosePhoto: 'Choose a photo',
    chooseTitle: 'Read a recipe from a photo',
    keepNew: 'Keep the new one',
    keepNewHint: 'Creates this ingredient when the recipe is saved',
    keepNewLabel: (name: string) => `Keep “${name}” as a new ingredient`,
    nothingFoundMessage: 'No text could be read. Try a sharp, well-lit photo of the page.',
    nothingFoundTitle: 'No recipe found',
    readFailed: 'The photo couldn’t be read. If it happens again, close the app and open it again.',
    // Shown while the text of the photo is recognized.
    reading: 'Reading the photo…',
    similarMessage: (existing: string) => `You already have “${existing}”. Use it instead?`,
    startMessage:
      'Write it yourself, or fill it in from a photo of a recipe page: the text is read on your phone and the photo isn’t kept.',
    takePhoto: 'Take a photo',
    useSimilar: (existing: string) => `Use “${existing}”`,
    useSimilarHint: 'Uses your existing ingredient instead of creating a new one',
    write: 'Write it',
  },
  seasons: {
    both: 'Both',
    summer: 'Summer',
    winter: 'Winter',
    // In lists, where "Both" alone would be unclear.
    winterAndSummer: 'Winter & summer',
  },
  settings: {
    appearance: 'Appearance',
    // The two families of settings: what the app proposes, and how it looks and keeps the data.
    appGroup: 'App & data',
    cookingGroup: 'Cooking',
    dark: 'Dark',
    language: 'Language',
    light: 'Light',
    // Settings › Skip recent meals: Off, 7 days…
    recentMeals: 'Skip recent meals',
    recentMealsDays: (days: number) => (days === 0 ? 'Off' : `${days} days`),
    showButtonLabels: 'Show button labels',
    showButtonLabelsHint: 'Adds the text next to icon buttons',
    system: 'System',
    units: 'Units',
    unitsMetric: 'European (g, l)',
    unitsUs: 'US (oz, cups)',
  },
  shoppingList: {
    add: 'Add to list',
    addHint: 'Adds its ingredients to the shopping list, and suggests another recipe',
    addLabel: (title: string) => `Add ${title} to the shopping list`,
    // On a recipe: in the list or not (header button).
    addToList: 'Add to the shopping list',
    addToListHint: 'Adds its ingredients to the shopping list',
    emptyMessage:
      'Add meals from the meal choice or from a recipe: their ingredients are listed here, ready to share.',
    emptyTitle: 'No meals picked yet',
    // On a disabled add button: why nothing can be added.
    fullHint: (max: number) => `The shopping list is full: ${max} meals at most`,
    // Under the meal choice's suggestion: how to make a shopping list, then how far it is.
    helpContinue: (count: number) =>
      plural(
        count,
        '1 meal is in your shopping list. Add more, or open the list with the button below to share its ingredients.',
        `${count} meals are in your shopping list. Add more, or open the list with the button below to share their ingredients.`,
      ),
    helpStart:
      'To make a shopping list, add one or more meals with “Add to list”, then open the list with the button that appears at the bottom to share their ingredients.',
    ingredients: 'Ingredients',
    markCooked: 'Mark as cooked',
    markCookedHint: 'The meal choice then skips them for a while',
    markCookedMessage: (count: number) =>
      plural(
        count,
        'Mark this meal as cooked today? The meal choice then skips it for a while.',
        `Mark these ${count} meals as cooked today? The meal choice then skips them for a while.`,
      ),
    meals: (count: number) => `Meals (${count})`,
    // The line of the shared text that names the meals: "Meals: Leek soup, Omelette".
    mealsLine: (titleList: readonly string[]) => `Meals: ${titleList.join(', ')}`,
    noIngredients: 'These meals list no ingredients.',
    notNow: 'Not now',
    // The button at the bottom of the meal choice: "Shopping list (2)".
    openButton: (count: number) => `Shopping list (${count})`,
    openHint: 'Opens the shopping list',
    openLabel: (count: number) =>
      count === 0
        ? 'Shopping list'
        : plural(count, 'Shopping list, 1 meal', `Shopping list, ${count} meals`),
    // Between the quantities of one ingredient in two units: "Leek: 3 + 300 g".
    quantitySeparator: ' + ',
    removeFromList: 'Remove from the shopping list',
    removeHint: 'Takes it out of the shopping list',
    removeLabel: (title: string) => `Remove ${title} from the list`,
    share: 'Share',
    shareHint: 'Sends the list to another app: notes, messages, email…',
    title: 'Shopping list',
    // More ingredient lines than the list reads: some are left out.
    truncated: (max: number) => `Only the first ${max} lines are listed.`,
  },
  sync: {
    appUpdateAvailable:
      'Your server has a newer version: update the app to get its latest features.',
    chooseStorage: 'Data storage',
    connect: 'Connect',
    connectedAs: (server: string, email: string) => `Synced with ${server} as ${email}.`,
    connecting: 'Connecting…',
    email: 'Email',
    errorAppOutdated:
      'This app is too old for your server: update the app to sync again. Your changes stay on this phone meanwhile.',
    errorFailed: 'The server refused the request. Try again later.',
    errorServerOutdated:
      'Your server is older than this app: update the server to sync again. Your changes stay on this phone meanwhile.',
    errorUnauthorized:
      'The server refused the sign-in. Choose “This device only”, then connect again.',
    errorUnreachable:
      'The server doesn’t answer. The device must be on the home network: it syncs again by itself.',
    insecureAddress: 'Use an https:// address: the password and recipes travel encrypted.',
    invalidAddress: 'Enter the server’s address, like recipes.example.org.',
    lastSynced: (time: number) =>
      `Last sync: ${new Date(time).toLocaleString('en', { day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short' })}.`,
    localOnly: 'This device only',
    localOnlyDescription: 'Your data is kept on this device only.',
    missingAccount: 'Enter the email and password of your server account.',
    notSyncedYet: 'Not synced yet.',
    password: 'Password',
    serverAddress: 'Server address',
    serverAddressHint: 'For example recipes.example.org',
    signInDescription:
      'Sign in with the account created on your server. The device keeps its data and merges it with the server’s.',
    statusFailed: 'Sync failed',
    statusFailedLabel: (pendingCount: number) =>
      pendingCount === 0
        ? 'Sync failed'
        : plural(
            pendingCount,
            'Sync failed, 1 change waits on this device',
            `Sync failed, ${pendingCount} changes wait on this device`,
          ),
    statusHint: 'Opens the sync settings',
    statusWaiting: (pendingCount: number) =>
      plural(pendingCount, '1 change to sync', `${pendingCount} changes to sync`),
    stopSyncing: 'Stop syncing',
    stopSyncingMessage: 'Your data stays on this device and on the server.',
    stopSyncingTitle: 'Stop syncing with the server?',
    syncing: 'Syncing…',
    syncNow: 'Sync now',
    withServer: 'Synced with a server',
    wrongAccount: 'Wrong email or password.',
  },
};

export type Messages = typeof en;
