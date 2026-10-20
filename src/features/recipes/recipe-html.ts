import type { Tokens } from 'marked';
import { Marked } from 'marked';
import type { Messages } from '@/i18n/en';
import type { UnitSystem } from '@/lib/units';
import type { Recipe } from './db/recipe-queries';
import { formatTimes } from './minutes';
import { formatQuantity } from './quantity';

// A recipe as an HTML page, printed to a PDF to share it (src/features/recipes/share-recipe-pdf.ts).
// Everything from the recipe is escaped: its text is shown, never run. Images and links are written
// as their text: printing loads nothing (no network), and a PDF can't follow the app's links.
// Its text comes from the dictionaries (t) and the recipe; markup and style are raw templates.

// Past this length, the instructions are shown as typed, like on the recipe screen
// (src/components/markdown.tsx).
const MAX_FORMATTED_LENGTH = 10_000;

// Markup and style, not text for people: written raw (tagged templates aren't UI text to translate).
const markup = String.raw;

const STYLE = markup`
@page { margin: 16mm; }
body { color: #1c1917; font-family: sans-serif; font-size: 12pt; line-height: 1.45; margin: 0; }
h1 { font-size: 20pt; line-height: 1.2; margin: 0 0 4pt; }
h2 { font-size: 14pt; margin: 16pt 0 6pt; }
.labels, .muted { color: #57534e; }
.labels { margin: 0; }
ul, ol { margin: 0; padding-left: 18pt; }
li { margin: 2pt 0; }
.instructions h1, .instructions h2, .instructions h3 { font-size: 13pt; margin: 12pt 0 4pt; }
.as-typed { white-space: pre-wrap; }
.photo { border-radius: 6pt; display: block; margin: 0 0 10pt; max-height: 80mm; max-width: 100%; object-fit: cover; }
table { border-collapse: collapse; }
th, td { border: 1px solid #a8a29e; padding: 2pt 6pt; }
`;

type LinkRenderer = Readonly<{
  parser: { parseInline: (tokens: Tokens.Link['tokens']) => string };
}>;

const markdown = new Marked({
  breaks: true,
  gfm: true,
  renderer: {
    // HTML typed in the recipe: shown as text.
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    image({ text }: Tokens.Image) {
      return escapeHtml(text);
    },
    link(this: LinkRenderer, { tokens }: Tokens.Link) {
      return this.parser.parseInline(tokens);
    },
  },
});

// "&", "<", ">", quotes: as text in HTML.
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// The recipe's page: title, season and course, ingredients with their quantities (in the reader's
// units), then the instructions (Markdown).
export function toRecipeHtml(
  t: Messages,
  recipe: Recipe,
  options: Readonly<{
    language: string;
    // The recipe's photo, as JPEG data (base64): in the PDF itself, nothing to load.
    photoBase64?: string;
    units: UnitSystem;
  }>,
): string {
  const { language, photoBase64, units } = options;
  const season = recipe.season === 'both' ? t.seasons.winterAndSummer : t.seasons[recipe.season];
  const ingredientList = recipe.ingredientList.map(({ name, quantity }) =>
    quantity ? t.quantities.line(name, formatQuantity(t, quantity, units)) : name,
  );
  const ingredients =
    ingredientList.length === 0
      ? element('p', escapeHtml(t.recipes.noIngredients), 'muted')
      : element('ul', ingredientList.map((line) => element('li', escapeHtml(line))).join(''));
  return [
    markup`<!doctype html>`,
    markup`<html lang="${escapeHtml(language)}">`,
    '<head>',
    markup`<meta charset="utf-8">`,
    element('title', escapeHtml(recipe.title)),
    element('style', STYLE),
    '</head>',
    '<body>',
    photoHtml(photoBase64),
    element('h1', escapeHtml(recipe.title)),
    element(
      'p',
      escapeHtml(
        (recipe.kind === 'drink' ? [season] : [season, t.courses[recipe.course]]).join(' · '),
      ),
      'labels',
    ),
    timesHtml(t, recipe),
    element('h2', escapeHtml(t.recipes.ingredients)),
    ingredients,
    element('h2', escapeHtml(t.recipes.recipe)),
    instructionsHtml(t, recipe.instructions),
    '</body>',
    '</html>',
  ].join('\n');
}

// <name class="…">content</name>; `content` is HTML already.
function element(name: string, content: string, className?: string): string {
  const classAttribute = className === undefined ? '' : [' class="', className, '"'].join('');
  return ['<', name, classAttribute, '>', content, '</', name, '>'].join('');
}

function instructionsHtml(t: Messages, instructions: string): string {
  if (!instructions) {
    return element('p', escapeHtml(t.recipes.noInstructions), 'muted');
  }
  return instructions.length > MAX_FORMATTED_LENGTH
    ? element('p', escapeHtml(instructions), 'as-typed')
    : element('div', markdown.parse(instructions, { async: false }), 'instructions');
}

// The photo, at most a third of the page high; nothing without one. Only base64 characters get in.
function photoHtml(photoBase64: string | undefined): string {
  return photoBase64 === undefined || !/^[\d+/A-Za-z]+=*$/.test(photoBase64)
    ? ''
    : markup`<img alt="" class="photo" src="data:image/jpeg;base64,${photoBase64}">`;
}

// The times the recipe gives, or nothing.
function timesHtml(t: Messages, recipe: Recipe): string {
  const times = formatTimes(t, recipe);
  return times === undefined ? '' : element('p', escapeHtml(times), 'labels');
}
