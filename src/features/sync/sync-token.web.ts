// The sync server's sign-in token in a browser: the site's local storage, readable by the app's
// page only (a browser has no Keystore; the About page says so). Never the password.

const TOKEN_KEY = 'sync-token';

export function deleteSyncToken(): Promise<void> {
  localStorage.removeItem(TOKEN_KEY);
  return Promise.resolve();
}

export function getSyncToken(): null | string {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSyncToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
