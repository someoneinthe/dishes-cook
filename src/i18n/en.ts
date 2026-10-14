// The app's UI text in English: the reference language. Every other language defines the same
// entries (type `Messages`, checked by TypeScript). Functions build the texts with a name or a
// count in them. User content (recipe titles, ingredients) is never translated.

function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}

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
    any: 'Any',
    emptyMessage: 'Add a few recipes, then come back to let chance decide what to eat.',
    matchCount: (count: number) =>
      count === 0
        ? 'No recipe matches these filters.'
        : plural(count, '1 recipe matches.', `${count} recipes match.`),
    noUsedIngredient: 'No ingredient is used by a recipe yet.',
    suggest: 'Suggest',
    suggestAnother: 'Suggest another one',
    suggestHint: 'Picks a random recipe among the matching ones',
    suggestRecipe: 'Suggest a recipe',
    withIngredients: 'With ingredients',
  },
  menu: {
    close: 'Close the menu',
    ingredients: 'Ingredients',
    mealChoice: 'Meal choice',
    open: 'Show navigation menu',
    recipes: 'Recipes',
    settings: 'Settings',
  },
  recipes: {
    course: 'Course',
    deleteMessage: 'Its ingredients stay in your list.',
    editRecipe: 'Edit recipe',
    emptyMessage: 'Save the dishes you like to cook, then let the meal choice pick one for you.',
    emptyTitle: 'No recipes yet',
    // No-break spaces keep each example on one line ("-" never ends a line alone).
    formatHint:
      'Format it with Markdown: #\u{A0}Heading, **bold**, *italic*, -\u{A0}list item, ' +
      '1.\u{A0}numbered step. Line breaks are kept.',
    ingredientCount: (count: number) => plural(count, '1 ingredient', `${count} ingredients`),
    ingredients: 'Ingredients',
    ingredientsEmpty: 'Type an ingredient to add it.',
    instructionsPlaceholder: 'Steps, quantities, cooking time…',
    // Label of the add-recipe buttons, shown with Settings › Show button labels.
    new: 'New',
    newHint: 'Opens an empty recipe form',
    newRecipe: 'New recipe',
    noCourse: 'None',
    noIngredients: 'No ingredients listed.',
    noInstructions: 'No instructions written yet.',
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
  },
};

export type Messages = typeof en;
