// Deterministic, seedable PRNG utilities.
//
// The whole anti-detection model depends on a fingerprint being *stable across
// relaunches* but *unique across profiles*. So every "random" choice (canvas
// noise, WebGL params, device pick) is derived from a single per-profile seed
// through these helpers — never from Math.random().

/** xmur3: string -> 32-bit seed generator. */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32: 32-bit seed -> PRNG in [0, 1). */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a PRNG bundle from any string seed. */
export function rngFromSeed(seed) {
  const next = xmur3(String(seed));
  const rand = mulberry32(next());
  return {
    /** float in [0,1) */
    float: rand,
    /** int in [min, max] inclusive */
    int: (min, max) => min + Math.floor(rand() * (max - min + 1)),
    /** pick one element */
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    /** true with probability p */
    chance: (p) => rand() < p,
  };
}
