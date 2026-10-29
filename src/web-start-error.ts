import { MESSAGES, resolveLanguage } from './i18n/languages';

// Why the web app couldn't start (src/entry.web.ts): the page isn't cross-origin isolated (an old
// browser, or a server without the web app's headers), or its database couldn't open.
export type WebStartError = 'failed' | 'unsupported';

// Shows why on the page, in the browser's language (the app's own setting is in its database):
// the app's screens never render then, and a blank page would say nothing.
export function showStartError(error: WebStartError): void {
  const t = MESSAGES[resolveLanguage('system', navigator.language.slice(0, 2))];
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = t.webStart[error];
  Object.assign(message.style, {
    // eslint-disable-next-line no-restricted-syntax -- a CSS value, not text shown to users
    colorScheme: 'light dark',
    fontFamily: 'system-ui',
    fontSize: '16px',
    lineHeight: '1.5',
    marginInline: 'auto',
    marginTop: '48px',
    maxWidth: '480px',
    paddingInline: '16px',
  });
  document.body.replaceChildren(message);
}
