package expo.modules.pdfpages

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import kotlin.math.min
import kotlin.math.roundToInt

// Renders the first pages of a PDF to JPEG files in the app's cache, for the text recognition to
// read them like photos (src/lib/pdf-pages.ts). Android's own PDF renderer: no library, no network.
class PdfPagesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PdfPages")

    // The PDF at `uri` (file:// or content://): its page count, and its first `maxPages` pages as
    // JPEG files `width` pixels wide (narrower for a very tall page), on white, in a new folder of
    // the cache (`folderUri`) that the caller deletes once read. On failure (a damaged or
    // password-protected PDF), the folder is deleted here, since the caller never gets it.
    AsyncFunction("renderPages") { uri: String, maxPages: Int, width: Int ->
      require(width > 0 && maxPages > 0) { "Nothing to render" }
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val folder = File(context.cacheDir, "pdf-pages/${System.currentTimeMillis()}")
      folder.mkdirs()
      try {
        val descriptor = context.contentResolver.openFileDescriptor(Uri.parse(uri), "r")
        renderToFolder(descriptor, folder, maxPages, width)
      } catch (error: Throwable) {
        folder.deleteRecursively()
        throw error
      }
    }
  }

  private fun renderToFolder(
    descriptor: ParcelFileDescriptor?,
    folder: File,
    maxPages: Int,
    width: Int,
  ): Map<String, Any> {
    requireNotNull(descriptor) { "The PDF can't be opened" }
    return descriptor.use {
      PdfRenderer(it).use { renderer ->
        val pageUriList = (0 until min(renderer.pageCount, maxPages)).map { index ->
          renderer.openPage(index).use { page ->
            renderPage(page, File(folder, "page-${index + 1}.jpg"), width)
          }
        }
        mapOf(
          "folderUri" to Uri.fromFile(folder).toString(),
          "pageCount" to renderer.pageCount,
          "pageUriList" to pageUriList,
        )
      }
    }
  }

  // The page `width` pixels wide, or narrower when that would make it taller than
  // MAX_HEIGHT_RATIO widths (a strip of a page that would take too much memory).
  private fun renderPage(page: PdfRenderer.Page, file: File, width: Int): String {
    require(page.width > 0 && page.height > 0) { "An empty page" }
    val scale = min(width.toFloat() / page.width, width * MAX_HEIGHT_RATIO / page.height)
    val bitmapWidth = (page.width * scale).roundToInt().coerceAtLeast(1)
    val bitmapHeight = (page.height * scale).roundToInt().coerceAtLeast(1)
    val bitmap = Bitmap.createBitmap(bitmapWidth, bitmapHeight, Bitmap.Config.ARGB_8888)
    try {
      // Pages are transparent where nothing is drawn: white, as printed.
      bitmap.eraseColor(Color.WHITE)
      page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
      FileOutputStream(file).use { stream ->
        bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, stream)
      }
    } finally {
      bitmap.recycle()
    }
    return Uri.fromFile(file).toString()
  }

  companion object {
    private const val JPEG_QUALITY = 90
    // A page at most this many times taller than wide is drawn at full width (A4 is 1.41).
    private const val MAX_HEIGHT_RATIO = 4f
  }
}
