const UINT32_MAX = 0xffff_ffff;
const ZERO_SEED_STATE = 0x6d2b79f5;

export function isRandomState(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= UINT32_MAX;
}

export function initialRandomState(seed: number): number {
  if (!isRandomState(seed)) throw new RangeError('Seed must be an unsigned 32-bit integer.');
  return seed === 0 ? ZERO_SEED_STATE : seed;
}

export interface RandomStep { value: number; state: number }

/** Pure xorshift32 step. Persist returned state to resume the exact same sequence. */
export function nextRandom(state: number): RandomStep {
  if (!isRandomState(state) || state === 0) throw new RangeError('Random state must be a nonzero unsigned 32-bit integer.');
  let next = state | 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  const unsigned = next >>> 0;
  return { value: unsigned / 0x1_0000_0000, state: unsigned };
}

/** Convenience wrapper for bounded, deterministic consumers. Does not use ambient randomness. */
export function createSeededRandom(seed: number) {
  let state = initialRandomState(seed);
  return {
    next(): number {
      const step = nextRandom(state);
      state = step.state;
      return step.value;
    },
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_MAX) throw new RangeError('Bound must be an integer from 1 to 2^32 − 1.');
      // Xorshift32 visits the 2^32 − 1 nonzero states. Subtract one to obtain
      // samples starting at zero, then reject the incomplete final bucket.
      const limit = Math.floor(UINT32_MAX / maxExclusive) * maxExclusive;
      let sample: number;
      do {
        const step = nextRandom(state);
        state = step.state;
        sample = state - 1;
      } while (sample >= limit);
      return sample % maxExclusive;
    },
    getState(): number { return state; },
  };
}
