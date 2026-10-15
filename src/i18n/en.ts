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
  pinch: ['pinch', 'pinches'],
  tbsp: ['tbsp', 'tbsp'],
  tsp: ['tsp', 'tsp'],
};

export const en = {
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
  },
  courses: {
    dessert: 'Dessert',
    main: 'Main course',
    starter: 'Starter',
  },
  database: {
    openFailed: (reason: string) => `The recipes database could not be opened: ${reason}`,
  },
  filters: {
    any: 'Any',
    hideHint: 'Hides the filters; they stay applied',
    noUsedIngredient: 'No ingredient is used by a recipe yet.',
    showHint: 'Shows the season, course and ingredient filters',
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
  loading: {
    hint: 'The app opens automatically once it has loaded',
    label: 'Loading Dishes Cook',
  },
  markdown: {
    image: (description: string) => (description ? `Image: ${description}` : 'Image'),
  },
  mealChoice: {
    addRecipe: 'Add a recipe',
    another: 'Another one',
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
  menu: {
    close: 'Close the menu',
    ingredients: 'Ingredients',
    mealChoice: 'Meal choice',
    open: 'Show navigation menu',
    openScreenHint: 'Opens this screen',
    recipes: 'Recipes',
    settings: 'Settings',
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
    course: 'Course',
    deleteMessage: 'Its ingredients stay in your list.',
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
    matchCount: (count: number) =>
      count === 0
        ? 'No recipe matches these filters.'
        : plural(count, '1 recipe matches.', `${count} recipes match.`),
    // Label of the add-recipe buttons, shown with Settings › Show button labels.
    new: 'New',
    newHint: 'Opens an empty recipe form',
    newRecipe: 'New recipe',
    noIngredients: 'No ingredients listed.',
    noInstructions: 'No instructions written yet.',
    noMatch: (search: string) => `No recipe matches “${search}”.`,
    notFoundMessage: 'It may have been deleted.',
    notFoundTitle: 'Recipe not found',
    nothingToPreview: 'Nothing to preview yet.',
    openHint: 'Opens the recipe',
    preview: 'Preview',
    recipe: 'Recipe',
    recipeText: 'Recipe text',
    // What screen readers say for a row of the recipe list: "Pumpkin soup, Winter, Starter".
    rowLabel: (title: string, season: string, course?: string) =>
      [title, season, course].filter(Boolean).join(', '),
    saveHint: 'Saves the recipe and shows it',
    saveRecipe: 'Save recipe',
    search: 'Search recipes',
    searchPlaceholder: 'Search by title',
    season: 'Season',
    title: 'Title',
    titlePlaceholder: 'e.g. Pumpkin soup',
    titleRequired: 'Give the recipe a title.',
    write: 'Write',
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
    dark: 'Dark',
    language: 'Language',
    light: 'Light',
    showButtonLabels: 'Show button labels',
    showButtonLabelsHint: 'Adds the text next to icon buttons',
    system: 'System',
    units: 'Units',
    unitsMetric: 'European (g, l)',
    unitsUs: 'US (oz, cups)',
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
