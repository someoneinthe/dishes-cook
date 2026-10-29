// A shared recipe's file name (share-recipe-pdf.ts, and .web.ts in a browser).

// Characters a file name can't hold (Android, and the apps receiving it), and control characters.

const UNSAFE_NAME_CHARACTERS = /[\u{0}-\u{1F}\u{7F}"*/:<>?\\|]/gu;
const MAX_NAME_LENGTH = 80;

// "Soupe / potiron : maison?" -> "Soupe potiron maison": a file name from a recipe title.
export function toFileName(title: string): string {
  const name = title
    .replaceAll(UNSAFE_NAME_CHARACTERS, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .trim();
  // Only dots or nothing left ("..", "?"): not a usable name.
  return /^[.\s]*$/.test(name) ? 'recipe' : name;
}
