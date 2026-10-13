// Picks one id at random. The previous suggestion is avoided whenever there's another choice, so
// asking again always changes the suggestion. `random` returns a number in [0, 1).
export function pickRandomId(
  idList: readonly number[],
  previousId?: number,
  random: () => number = Math.random,
): number | undefined {
  const candidateList = idList.length > 1 ? idList.filter((id) => id !== previousId) : idList;
  return candidateList[Math.floor(random() * candidateList.length)];
}
