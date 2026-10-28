// Copies the web app's text recognition files into public/ocr/, which Expo serves with the web app
// (and copies into its export): Tesseract.js, its engine and English and French data, and pdf.js.
// The page loads them from there only when a photo or a PDF is read
// (src/features/recipes/read-document.web.ts): no CDN, nothing sent anywhere. public/ocr/ is
// generated (git-ignored); `npm run web` and `npm run web:export` run this first.
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OCR_DIR = path.join(ROOT, 'public/ocr');
const MODULES = path.join(ROOT, 'node_modules');

// Published name -> file in node_modules. Read-document.web.ts names the same files.
const FILES = {
  'eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  'fra.traineddata.gz': '@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz',
  'pdf.min.mjs': 'pdfjs-dist/build/pdf.min.mjs',
  'pdf.worker.min.mjs': 'pdfjs-dist/build/pdf.worker.min.mjs',
  // The engine (LSTM only, the mode used): Tesseract.js picks the build the browser supports.
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js':
    'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract.min.js': 'tesseract.js/dist/tesseract.min.js',
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
};

await rm(OCR_DIR, { force: true, recursive: true });
await mkdir(OCR_DIR, { recursive: true });
await Promise.all(
  Object.entries(FILES).map(([name, source]) =>
    copyFile(path.join(MODULES, source), path.join(OCR_DIR, name)),
  ),
);
