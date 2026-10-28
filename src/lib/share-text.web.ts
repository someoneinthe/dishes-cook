// Shares a text in a browser: its share sheet where it has one (Safari, Chrome on Windows, macOS,
// ChromeOS), otherwise the text is copied to the clipboard, for the user to paste it (Firefox).
// Rejects when the share sheet is closed without sharing.
export async function shareText(text: string): Promise<'copied' | 'shared'> {
  if (typeof navigator.share === 'function') {
    await navigator.share({ text });
    return 'shared';
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}
