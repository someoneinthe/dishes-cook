// Sync ids: 15 characters of [0-9a-f], the format of the sync server's record ids (see
// docs/sync.md). Recipes get a random one from SQLite; ingredients get one derived from their name.

const SYNC_ID_LENGTH = 15;

export function isSyncId(value: unknown): value is string {
  return typeof value === 'string' && /^[\da-f]{15}$/.test(value);
}

// The same name gives the same id on every phone, so an ingredient added on two phones before they
// sync is one ingredient on the server. The id is kept when the ingredient is renamed.
export function toIngredientSyncId(nameKey: string): string {
  // Two 53-bit hashes with different seeds: 60 bits once cut to 15 hex characters.
  return `${toHex(cyrb53(nameKey, 1))}${toHex(cyrb53(nameKey, 2))}`.slice(0, SYNC_ID_LENGTH);
}

// cyrb53 (public domain, bryc): a fast, well-mixed 53-bit string hash. Not cryptographic: ids
// only need to be stable and unlikely to collide among a household's ingredients.
function cyrb53(text: string, seed: number): number {
  let h1 = 0xde_ad_be_ef ^ seed;
  let h2 = 0x41_c6_ce_57 ^ seed;
  for (let index = 0; index < text.length; index++) {
    const code = text.codePointAt(index) ?? 0;
    h1 = Math.imul(h1 ^ code, 2_654_435_761);
    h2 = Math.imul(h2 ^ code, 1_597_334_677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2_246_822_507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3_266_489_909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2_246_822_507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3_266_489_909);
  return 4_294_967_296 * (2_097_151 & h2) + (h1 >>> 0);
}

function toHex(hash: number): string {
  return hash.toString(16).padStart(14, '0');
}
