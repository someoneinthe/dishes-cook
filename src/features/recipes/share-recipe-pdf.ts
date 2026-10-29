import { Directory, File, Paths } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import type { UnitSystem } from '@/lib/units';
import { toFileName } from './recipe-file-name';

export { toFileName } from './recipe-file-name';

// Shares a recipe as a PDF (the system share sheet: a messaging app, email, a drive…). The PDF is
// a temporary file, deleted once the share sheet closes: nothing is kept, no history. Leftovers
// (the app closed while sharing) are deleted at the next start (deleteSharedPdfs).

// Where expo-print writes its PDFs (its Android code: cacheDir/Print/<random>.pdf).
const PRINT_FOLDER = 'Print';
// Where the PDF gets the recipe's name, for the apps it's shared with.
const SHARED_FOLDER = 'shared-pdf';

// Page sizes in points (1/72 in): A4 for metric readers, US Letter for US units.
const PAGE_SIZES = {
  metric: { height: 842, width: 595 },
  us: { height: 792, width: 612 },
} as const satisfies Record<UnitSystem, Readonly<{ height: number; width: number }>>;

// Deletes the temporary PDFs. One that can't be deleted stays in the cache, which Android clears
// when it needs room.
export function deleteSharedPdfs(): void {
  for (const name of [PRINT_FOLDER, SHARED_FOLDER]) {
    try {
      const folder = new Directory(Paths.cache, name);
      if (folder.exists) {
        folder.delete();
      }
    } catch {
      // Nothing the user can do about it.
    }
  }
}

export async function shareRecipePdf(
  options: Readonly<{ dialogTitle: string; html: string; title: string; units: UnitSystem }>,
): Promise<void> {
  const { dialogTitle, html, title, units } = options;
  try {
    const { uri } = await printToFileAsync({ html, ...PAGE_SIZES[units] });
    const folder = new Directory(Paths.cache, SHARED_FOLDER);
    folder.create({ idempotent: true, intermediates: true });
    const named = new File(folder, `${toFileName(title)}.pdf`);
    await new File(uri).move(named, { overwrite: true });
    await shareAsync(named.uri, { dialogTitle, mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  } finally {
    deleteSharedPdfs();
  }
}
