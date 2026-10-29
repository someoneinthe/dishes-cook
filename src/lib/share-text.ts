import { Share } from 'react-native';

// Android's share sheet closed without sharing resolves instead (Share.dismissedAction): a
// rejection is a failure.
export function isCancelled(_error: unknown): boolean {
  return false;
}

// Shares a text with the app the user picks (Android's share sheet). Resolves with how it went:
// 'shared', or 'copied' in a browser without sharing (share-text.web.ts). Rejects when sharing
// fails (isCancelled tells a browser's share sheet closed without sharing).
export async function shareText(text: string): Promise<'copied' | 'shared'> {
  await Share.share({ message: text });
  return 'shared';
}
