import { Share } from 'react-native';

// Shares a text with the app the user picks (Android's share sheet). Resolves with how it went:
// 'shared', or 'copied' in a browser without sharing (share-text.web.ts). Rejects when closed
// without sharing.
export async function shareText(text: string): Promise<'copied' | 'shared'> {
  await Share.share({ message: text });
  return 'shared';
}
