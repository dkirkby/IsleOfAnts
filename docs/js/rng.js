/* js/rng.js — Seeded PRNG (Milestone 3)
 *
 * Algorithm: Mulberry32 — a fast, high-quality 32-bit PRNG.
 * Identical output guaranteed across all JS engines because it uses
 * only 32-bit integer arithmetic (Math.imul) and unsigned right-shift.
 *
 * Verification (seed 0):
 *   nextFloat() × 5 → see SEED0_EXPECTED below
 */

class SeededRNG {
  /**
   * @param {number} seed  Any 32-bit integer (non-integer values are truncated).
   */
  constructor(seed) {
    this._state = seed >>> 0; // coerce to uint32
  }

  /** Advance state and return a float in [0, 1). */
  nextFloat() {
    this._state = (this._state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(this._state ^ (this._state >>> 15), 1 | this._state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Return a random integer in [0, n).
   * @param {number} n  Exclusive upper bound (must be a positive integer).
   */
  nextInt(n) {
    return Math.floor(this.nextFloat() * n);
  }

  /**
   * Fisher-Yates shuffle — mutates the array in place and returns it.
   * @param {Array} arr
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}

// ---------------------------------------------------------------------------
// Module-level global instance — shared by engine.js and skulpt-bridge.js.
// Call setGlobalSeed(n) once at simulation start; both subsystems then draw
// from the same deterministic stream.
// ---------------------------------------------------------------------------
let globalRNG = new SeededRNG(0);

function setGlobalSeed(seed) {
  globalRNG = new SeededRNG(seed);
}

// ---------------------------------------------------------------------------
// Self-test — runs once at load time and logs results for manual verification.
// ---------------------------------------------------------------------------
(function selfTest() {
  // Known-good sequence for seed 0 (verified against reference implementation)
  const SEED0_EXPECTED = [
    0.7277207633014768,
    0.682494497159496,
    0.8007101747207344,
    0.8113794096279889,
    0.5993479175958782,
  ];

  const rng = new SeededRNG(0);
  const got = Array.from({ length: 5 }, () => rng.nextFloat());

  const ok = SEED0_EXPECTED.every((v, i) => Math.abs(v - got[i]) < 1e-12);
  if (ok) {
    console.log('[rng] SeededRNG self-test passed ✓');
  } else {
    console.error('[rng] SeededRNG self-test FAILED');
    console.error('  expected:', SEED0_EXPECTED);
    console.error('  got:     ', got);
  }

  // Verify two instances with the same seed produce identical sequences
  const a = new SeededRNG(12345);
  const b = new SeededRNG(12345);
  const seqOk = [0,1,2,3,4].every(() => a.nextFloat() === b.nextFloat());
  if (!seqOk) console.error('[rng] SeededRNG determinism test FAILED');

  // Verify shuffle uses seeded RNG (not Math.random) — same seed → same result
  const r1 = new SeededRNG(99);
  const r2 = new SeededRNG(99);
  const arr1 = r1.shuffle([0,1,2,3,4,5,6,7]);
  const arr2 = r2.shuffle([0,1,2,3,4,5,6,7]);
  const shuffleOk = arr1.every((v, i) => v === arr2[i]);
  if (!shuffleOk) console.error('[rng] SeededRNG shuffle determinism test FAILED');
})();
