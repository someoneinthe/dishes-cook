import Storage from 'expo-sqlite/kv-store';
import type * as RecentSuggestionsModule from './recent-suggestions';

describe('recent suggestions', () => {
  const HOUR = 60 * 60 * 1000;
  const now = Date.UTC(2026, 10, 6, 12);

  const loadModule = () => {
    let module: typeof RecentSuggestionsModule | undefined;
    jest.isolateModules(() => {
      module = jest.requireActual<typeof RecentSuggestionsModule>('./recent-suggestions');
    });
    return module!;
  };

  beforeEach(() => {
    Storage.setItemSync('recentSuggestions', '');
  });

  it('lists the recipes suggested since then, the oldest first', () => {
    const { getSuggestedSince, recordSuggestion } = loadModule();
    recordSuggestion('soup', now - 3 * HOUR);
    recordSuggestion('stew', now - 2 * HOUR);
    recordSuggestion('salad', now - HOUR);

    expect(getSuggestedSince(now - 2 * HOUR)).toStrictEqual(['stew', 'salad']);
    expect(getSuggestedSince(now)).toStrictEqual([]);
  });

  it('moves a recipe suggested again to the end', () => {
    const { getSuggestedSince, recordSuggestion } = loadModule();
    recordSuggestion('soup', now - 2 * HOUR);
    recordSuggestion('stew', now - HOUR);
    recordSuggestion('soup', now);

    expect(getSuggestedSince(0)).toStrictEqual(['stew', 'soup']);
  });

  it('still remembers a suggestion it cannot store, until the app closes', () => {
    const { getSuggestedSince, recordSuggestion } = loadModule();
    jest.spyOn(Storage, 'setItemSync').mockImplementationOnce(() => {
      throw new Error('disk full');
    });

    expect(() => recordSuggestion('soup', now)).not.toThrow();
    expect(getSuggestedSince(0)).toStrictEqual(['soup']);
    expect(loadModule().getSuggestedSince(0)).toStrictEqual([]);
  });

  it('keeps them for the next launch', () => {
    loadModule().recordSuggestion('soup', now);

    expect(loadModule().getSuggestedSince(0)).toStrictEqual(['soup']);
  });

  it('forgets the suggestions older than the longest delay', () => {
    const { getSuggestedSince, recordSuggestion } = loadModule();
    recordSuggestion('soup', now - 721 * HOUR);
    recordSuggestion('stew', now);

    expect(getSuggestedSince(0)).toStrictEqual(['stew']);
  });

  it('keeps at most MAX_RECENT_SUGGESTIONS, forgetting the oldest', () => {
    const { getSuggestedSince, MAX_RECENT_SUGGESTIONS, recordSuggestion } = loadModule();
    for (let index = 0; index <= MAX_RECENT_SUGGESTIONS; index += 1) {
      recordSuggestion(`recipe-${String(index)}`, now + index);
    }
    const suggestedList = getSuggestedSince(0);

    expect(suggestedList).toHaveLength(MAX_RECENT_SUGGESTIONS);
    expect(suggestedList[0]).toBe('recipe-1');
  });

  it('starts the delay the given hours ago', () => {
    expect(loadModule().startOfDelay(4, now)).toBe(now - 4 * HOUR);
  });

  it('ignores unreadable stored values', () => {
    Storage.setItemSync('recentSuggestions', '[{"at":1,"syncId":"soup"}');

    expect(loadModule().getSuggestedSince(0)).toStrictEqual([]);

    Storage.setItemSync(
      'recentSuggestions',
      '[{"at":"1","syncId":"soup"},{"at":2,"syncId":"stew"}]',
    );

    expect(loadModule().getSuggestedSince(0)).toStrictEqual(['stew']);
  });
});
