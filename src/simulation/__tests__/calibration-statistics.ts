/** SYNTHETIC AUTOMATED TESTS ONLY. Imported by the test/CLI harness, never application UI. */
export interface MeanEstimate {
  count: number;
  mean: number;
  standardDeviation: number;
  standardError: number;
  confidence95: { lower: number; upper: number };
}

export interface RateEstimate {
  count: number;
  occurrences: number;
  rate: number;
  confidence95: { lower: number; upper: number };
}

/** Normal approximation for a batch mean, not a prediction interval for an individual match. */
export function estimateMean(values: readonly number[]): MeanEstimate {
  if (values.length < 2 || values.some(value => !Number.isFinite(value))) throw new Error('A mean requires at least two finite observations.');
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const standardDeviation = Math.sqrt(variance);
  const standardError = standardDeviation / Math.sqrt(values.length);
  return { count: values.length, mean, standardDeviation, standardError, confidence95: { lower: mean - 1.96 * standardError, upper: mean + 1.96 * standardError } };
}

/** Wilson interval avoids the false certainty of a zero-width binomial interval at 0 or 1. */
export function estimateRate(occurrences: number, count: number): RateEstimate {
  if (!Number.isInteger(count) || count < 2 || !Number.isInteger(occurrences) || occurrences < 0 || occurrences > count) throw new Error('Invalid rate sample.');
  const rate = occurrences / count;
  const zSquared = 1.96 ** 2;
  const denominator = 1 + zSquared / count;
  const center = (rate + zSquared / (2 * count)) / denominator;
  const radius = 1.96 * Math.sqrt(rate * (1 - rate) / count + zSquared / (4 * count ** 2)) / denominator;
  return { count, occurrences, rate, confidence95: { lower: Math.max(0, center - radius), upper: Math.min(1, center + radius) } };
}

/** Pair by identical seed and input fixture: positive means the first scenario is higher. */
export function pairedDifference(first: readonly number[], second: readonly number[]): MeanEstimate {
  if (first.length !== second.length) throw new Error('Paired samples must have the same size.');
  return estimateMean(first.map((value, index) => value - second[index]!));
}

export interface AcceptanceOutcome {
  id: string;
  passed: boolean;
  target: string;
  observed: Record<string, number>;
}
