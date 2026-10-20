import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import type { Recipe } from './db/recipe-queries';
import { escapeHtml, toRecipeHtml } from './recipe-html';

const soup: Recipe = {
  course: 'main',
  id: 1,
  ingredientList: [
    { id: 1, name: 'Leek', quantity: { amount: 3 } },
    { id: 2, name: 'Potato', quantity: { amount: 1500, unit: 'g' } },
    { id: 3, name: 'Salt' },
  ],
  instructions: '# Steps\n\n1. Cut the **leeks**.\n2. Simmer.',
  kind: 'dish',
  season: 'winter',
  title: 'Leek & potato soup',
};

describe('recipe html', () => {
  describe('toRecipeHtml', () => {
    const html = (recipe: Recipe, units: 'metric' | 'us' = 'metric') =>
      toRecipeHtml(en, recipe, { language: 'en', units });

    it('shows the recipe: title, labels, ingredients in the reader’s units, instructions', () => {
      const page = html(soup);

      expect(page).toContain('<html lang="en">');
      expect(page).toContain('<h1>Leek &amp; potato soup</h1>');
      expect(page).toContain('Winter · Main course');
      expect(page).toContain('<li>Leek: 3</li><li>Potato: 1.5 kg</li><li>Salt</li>');
      expect(page).toContain('<li>Cut the <strong>leeks</strong>.</li>');
    });

    it('shows the quantities in US units for a US reader', () => {
      expect(html(soup, 'us')).toContain('<li>Potato: 3.25 lb</li>');
    });

    it('is written in the reader’s language', () => {
      const page = toRecipeHtml(
        fr,
        { ...soup, season: 'both' },
        { language: 'fr', units: 'metric' },
      );

      expect(page).toContain('<html lang="fr">');
      expect(page).toContain('Hiver et été · Plat principal');
      expect(page).toContain('<h2>Ingrédients</h2>');
    });

    it('shows what the recipe holds as text, never as markup or links', () => {
      const page = html({
        ...soup,
        ingredientList: [{ id: 1, name: '<b>Leek</b>' }],
        instructions:
          '<script>alert(1)</script> <SCRIPT>alert(2)</SCRIPT>\n\n![a photo](https://example.org/x.png) [a link](https://example.org)',
        title: '<img src=x onerror=alert(1)>',
      });

      // Escaped: no tag of the recipe's own, no image to load, no link.
      expect(page).not.toMatch(/<(script|img|b|a)[\s>]/i);
      expect(page).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(page).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(page).toContain('a photo a link');
    });

    it('shows a drink without a season nor a course', () => {
      const page = html({ ...soup, kind: 'drink', title: 'Mojito' });

      expect(page).not.toContain('Winter');
      expect(page).not.toContain('Main course');
    });

    it('shows the times, and embeds the photo in the page', () => {
      const page = toRecipeHtml(
        en,
        { ...soup, cookMinutes: 30, prepMinutes: 15 },
        { language: 'en', photoBase64: 'cGhvdG8=', units: 'metric' },
      );

      expect(page).toContain('Preparation 15 min · Cooking 30 min · 45 min in all');
      expect(page).toContain('<img alt="" class="photo" src="data:image/jpeg;base64,cGhvdG8=">');
    });

    it('leaves out a photo that isn’t base64 data', () => {
      const page = toRecipeHtml(en, soup, {
        language: 'en',
        photoBase64: '"><script>alert(1)</script>',
        units: 'metric',
      });

      expect(page).not.toContain('<img');
      expect(page).not.toMatch(/<script/i);
    });

    it('says when there are no ingredients or instructions', () => {
      const page = html({ ...soup, ingredientList: [], instructions: '' });

      expect(page).toContain('No ingredients listed.');
      expect(page).toContain('No instructions written yet.');
    });

    it('shows very long instructions as typed', () => {
      const page = html({ ...soup, instructions: '**a**\n'.repeat(3000) });

      expect(page).toContain('<p class="as-typed">**a**');
      expect(page).not.toContain('<strong>');
    });
  });

  describe('escapeHtml', () => {
    it('escapes the characters HTML reads', () => {
      expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
        '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
      );
    });
  });
});
