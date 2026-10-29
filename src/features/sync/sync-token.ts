import { deleteItemAsync, getItem, setItem } from 'expo-secure-store';

// The sync server's sign-in token (never the password), encrypted by Android's Keystore. A
// browser keeps it in the site's storage (sync-token.web.ts).

const TOKEN_KEY = 'sync-token';

export function deleteSyncToken(): Promise<void> {
  return deleteItemAsync(TOKEN_KEY);
}

export function getSyncToken(): null | string {
  return getItem(TOKEN_KEY);
}

export function setSyncToken(token: string): void {
  setItem(TOKEN_KEY, token);
}
