import { addPick, clearPicks, getPicks, MAX_PICKS, removePick } from './meal-picks';

describe('meal picks', () => {
  beforeEach(() => {
    clearPicks();
  });

  it('keeps the meals in the order picked, each once', () => {
    addPick('3');
    addPick('1');
    addPick('3');

    expect(getPicks()).toStrictEqual(['3', '1']);
  });

  it('removes one meal, or all of them', () => {
    addPick('3');
    addPick('1');

    removePick('3');

    expect(getPicks()).toStrictEqual(['1']);

    clearPicks();

    expect(getPicks()).toStrictEqual([]);
  });

  it('holds at most MAX_PICKS meals, and says when one more is refused', () => {
    for (let id = 1; id <= MAX_PICKS; id++) {
      addPick(String(id));
    }

    expect(addPick('extra')).toBe('full');
    expect(addPick('1')).toBe('added');
    expect(getPicks()).toHaveLength(MAX_PICKS);
  });
});
