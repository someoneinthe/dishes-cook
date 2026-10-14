// Links written by the user (recipe Markdown) may only open web pages and e-mails: no
// `javascript:`, `intent:`, `file:`, app deep links or anything else.
const SAFE_LINK = /^(?:https?:\/\/|mailto:)\S+$/i;

export function isSafeLink(href: string): boolean {
  return SAFE_LINK.test(href);
}
