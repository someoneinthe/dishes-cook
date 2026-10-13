import { pickRandomId } from './pick-random-id';

describe('pickRandomId', () => {
  it('returns nothing when there is no candidate', () => {
    expect(pickRandomId([])).toBeUndefined();
  });

  it('spreads the picks over every candidate', () => {
    expect(pickRandomId([1, 2, 3], undefined, () => 0)).toBe(1);
    expect(pickRandomId([1, 2, 3], undefined, () => 0.5)).toBe(2);
    expect(pickRandomId([1, 2, 3], undefined, () => 0.999)).toBe(3);
  });

  it('never repeats the previous pick when another one is possible', () => {
    expect(pickRandomId([1, 2], 1, () => 0)).toBe(2);
    expect(pickRandomId([1, 2, 3], 3, () => 0.999)).toBe(2);
  });

  it('repeats the only candidate', () => {
    expect(pickRandomId([7], 7)).toBe(7);
  });
});
