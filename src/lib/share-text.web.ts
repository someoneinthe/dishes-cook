// Closed by the user (the browser's own error name for it), not refused.
export function isCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

// Shares a text in a browser: its share sheet where it has one (Safari, Chrome on Windows, macOS,
// ChromeOS), otherwise, or when the sheet refuses it, the text is copied to the clipboard, for the
// user to paste it (Firefox). Rejects with an AbortError when the share sheet is closed without
// sharing, and when the clipboard refuses the text.
export async function shareText(text: string): Promise<'copied' | 'shared'> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (error) {
      if (isCancelled(error)) {
        throw error;
      }
    }
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}
