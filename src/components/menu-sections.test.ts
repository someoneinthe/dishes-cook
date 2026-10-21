import { toMenuSections } from './menu-sections';

describe('toMenuSections', () => {
  it('puts Settings and About at the bottom, each group in the menu order', () => {
    const routeList = ['index', 'recipes', 'settings', 'ingredients', 'about', 'drinks'].map(
      (name) => ({ name }),
    );

    expect(toMenuSections(routeList)).toStrictEqual({
      bottomList: [{ name: 'settings' }, { name: 'about' }],
      topList: [
        { name: 'index' },
        { name: 'recipes' },
        { name: 'ingredients' },
        { name: 'drinks' },
      ],
    });
  });
});
