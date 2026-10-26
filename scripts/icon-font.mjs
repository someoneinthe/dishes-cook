// Generates the app's icon font, assets/fonts/app-icons.ttf: Material Design Icons
// (https://pictogrammers.com/library/mdi/) cut down to the icons listed in
// src/components/icon-glyphs.json (name -> code point). The whole font weighs 1.3 MB for ~7,400
// icons; the app uses a few dozen. The list is also the type of the icon names (IconName): an icon
// not in it fails the typecheck.
//
//   npm run icons -- add <name…>       adds icons (names without the "mdi-" prefix)
//   npm run icons -- remove <name…>    removes icons
//   npm run icons                      rewrites the font from the list
//   npm run icons -- --check           fails if the font doesn't match the list (CI)
import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import subsetFont from 'subset-font';

const ROOT = path.resolve(import.meta.dirname, '..');
const GLYPHS_PATH = path.join(ROOT, 'src/components/icon-glyphs.json');
const FONT_PATH = path.join(ROOT, 'assets/fonts/app-icons.ttf');
const MDI_DIR = path.join(
  ROOT,
  'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons',
);
const MDI_FONT_PATH = path.join(MDI_DIR, 'Fonts/MaterialCommunityIcons.ttf');
const MDI_GLYPHS_PATH = path.join(MDI_DIR, 'glyphmaps/MaterialCommunityIcons.json');

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

async function main() {
  const [command, ...nameList] = process.argv.slice(2);
  const mdiGlyphMap = await readJson(MDI_GLYPHS_PATH);
  const glyphMap = await readJson(GLYPHS_PATH);
  if (command === 'add' || command === 'remove') {
    const unknownList = nameList.filter((name) => mdiGlyphMap[name] === undefined);
    if (unknownList.length > 0) {
      throw new Error(`Not Material Design Icons: ${unknownList.join(', ')}`);
    }
    for (const name of nameList) {
      if (command === 'add') {
        glyphMap[name] = mdiGlyphMap[name];
      } else {
        delete glyphMap[name];
      }
    }
  } else if (command !== undefined && command !== '--check') {
    throw new Error(`Unknown command: ${command} (add, remove or --check)`);
  }
  // In name order, with the code points of the installed Material Design Icons.
  const sortedMap = Object.fromEntries(
    Object.keys(glyphMap)
      .sort((name, other) => name.localeCompare(other))
      .map((name) => [name, mdiGlyphMap[name]]),
  );
  const font = await subsetOf(sortedMap);
  if (command === '--check') {
    const isFontUpToDate = Buffer.compare(font, await readFile(FONT_PATH)) === 0;
    const isListUpToDate = JSON.stringify(sortedMap) === JSON.stringify(glyphMap);
    if (!isFontUpToDate || !isListUpToDate) {
      throw new Error('assets/fonts/app-icons.ttf is out of date: run `npm run icons`');
    }
    console.warn('assets/fonts/app-icons.ttf is up to date.');
    return;
  }
  await writeFile(GLYPHS_PATH, `${JSON.stringify(sortedMap, null, 2)}\n`);
  await writeFile(FONT_PATH, font);
  console.warn(`${Object.keys(sortedMap).length} icons, ${font.length} bytes: ${FONT_PATH}`);
}

// The subset of the full font holding these code points.
async function subsetOf(glyphMap) {
  const text = String.fromCodePoint(...Object.values(glyphMap));
  return subsetFont(await readFile(MDI_FONT_PATH), text, { targetFormat: 'truetype' });
}

await main();
