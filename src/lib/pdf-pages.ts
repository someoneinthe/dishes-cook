import { requireOptionalNativeModule } from 'expo';

// A PDF's first pages as images (modules/pdf-pages: Android's PDF renderer, in the app).
type PdfPages = Readonly<{
  // The cache folder holding the images: delete it once they're read.
  folderUri: string;
  pageCount: number;
  pageUriList: string[];
}>;

type PdfPagesModule = Readonly<{
  renderPages: (uri: string, maxPages: number, width: number) => Promise<PdfPages>;
}>;

// Android only for now (the app is Android-first): undefined elsewhere.
const pdfPagesModule = requireOptionalNativeModule<PdfPagesModule>('PdfPages');

// Renders the first `maxPages` pages of the PDF at `uri`, `width` pixels wide. Fails on a PDF
// that can't be opened (damaged, protected by a password) or where the module is missing.
export async function renderPdfPages(uri: string, maxPages: number, width: number) {
  if (!pdfPagesModule) {
    throw new Error('PDF pages can’t be rendered on this platform');
  }
  return pdfPagesModule.renderPages(uri, maxPages, width);
}
