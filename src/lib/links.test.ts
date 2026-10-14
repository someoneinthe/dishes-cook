import { isSafeLink } from './links';

describe('isSafeLink', () => {
  it.each([
    'https://example.com/soup',
    'https://example.com',
    'HTTPS://EXAMPLE.COM',
    'mailto:chef@example.com',
  ])('accepts %s', (href) => {
    expect(isSafeLink(href)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' https://example.com',
    'https://example.com evil',
    'intent://scan#Intent;end',
    'file:///sdcard/secret',
    'dishescook://recipe/1',
    'tel:123',
    'data:text/html,hi',
    '//example.com',
    'https://',
    '',
  ])('rejects %j', (href) => {
    expect(isSafeLink(href)).toBe(false);
  });
});
