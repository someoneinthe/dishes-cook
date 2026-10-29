import type { UnitSystem } from '@/lib/units';
import { toFileName } from './recipe-file-name';

export { toFileName } from './recipe-file-name';

// Shares a recipe as a PDF in a browser: its print dialog, on the recipe alone (a hidden frame),
// where "Save as PDF" names the file after the recipe (the page's title). Nothing is kept.

// A4 for metric readers, US Letter for US units, like on a phone (share-recipe-pdf.ts).
const PAGE_STYLES = {
  metric: '@page { size: A4; }',
  us: '@page { size: letter; }',
} as const satisfies Record<UnitSystem, string>;

// The phone's leftover PDFs (share-recipe-pdf.ts).
export function deleteSharedPdfs(): void {
  // Nothing to delete: the frame goes once printed.
}

export async function shareRecipePdf(
  options: Readonly<{ dialogTitle: string; html: string; title: string; units: UnitSystem }>,
): Promise<void> {
  const { html, title, units } = options;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.srcdoc = html;
  try {
    await new Promise<void>((resolve, reject) => {
      frame.addEventListener('load', () => resolve(), { once: true });
      frame.addEventListener('error', () => reject(new Error('Recipe print failed')), {
        once: true,
      });
      document.body.append(frame);
    });
    const printWindow = frame.contentWindow;
    const printed = frame.contentDocument;
    if (!printWindow || !printed) {
      throw new Error('Recipe print failed');
    }
    const pageStyle = printed.createElement('style');
    pageStyle.textContent = PAGE_STYLES[units];
    printed.head.append(pageStyle);
    // "Save as PDF" names the file after the page's title.
    printed.title = toFileName(title);
    // print() returns once the dialog closes (printed, saved or cancelled).
    printWindow.focus();
    printWindow.print();
  } finally {
    frame.remove();
  }
}
