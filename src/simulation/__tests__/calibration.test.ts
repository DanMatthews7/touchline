/** SYNTHETIC AUTOMATED TESTS ONLY. No invented fixture records are imported by the UI. */
import { beforeAll, describe, expect, it } from 'vitest';
import { CALIBRATION_SCENARIOS, calibrationSeed, runCalibration, type CalibrationReport } from './calibration-harness';
import { estimateMean, estimateRate, pairedDifference } from './calibration-statistics';
import { createSeededRandom } from '../random';

describe('calibration sample estimates', () => {
  it('reports sample uncertainty separately from individual match variability', () => {
    const estimate = estimateMean([2, 4, 6]);
    expect(estimate.mean).toBe(4);
    expect(estimate.standardDeviation).toBe(2);
    expect(estimate.standardError).toBeCloseTo(2 / Math.sqrt(3));
    expect(estimate.confidence95.lower).toBeCloseTo(1.7368, 3);
    expect(estimate.confidence95.upper).toBeCloseTo(6.2632, 3);
  });

  it('retains uncertainty when an event was never or always observed', () => {
    const never = estimateRate(0, 400);
    const always = estimateRate(400, 400);
    expect(never.confidence95.upper).toBeGreaterThan(0.009);
    expect(never.confidence95.upper).toBeLessThan(0.01);
    expect(always.confidence95.lower).toBeGreaterThan(0.99);
    expect(always.confidence95.lower).toBeLessThan(1);
    expect(estimateRate(200, 400).confidence95.lower).toBeCloseTo(0.4512, 3);
  });

  it('uses paired differences so shared variation does not inflate treatment uncertainty', () => {
    const estimate = pairedDifference([12, 102, -8], [10, 100, -10]);
    expect(estimate).toMatchObject({ count: 3, mean: 2, standardDeviation: 0, confidence95: { lower: 2, upper: 2 } });
    expect(() => pairedDifference([1, 2], [1])).toThrow('same size');
    expect(() => estimateMean([Number.NaN, 1])).toThrow('finite');
    expect(() => estimateRate(3, 2)).toThrow('Invalid');
  });

  it('predeclares reproducible spread seeds rather than biasing every kickoff with adjacent small RNG states', () => {
    const seeds = Array.from({ length: 400 }, (_, index) => calibrationSeed(1729 + index));
    expect(new Set(seeds).size).toBe(400);
    expect(seeds[0]).toBe(Math.imul(1729, 0x9e3779b1) >>> 0);
    const homeKickoffs = seeds.filter(seed => createSeededRandom(seed).next() < 0.5).length;
    expect(homeKickoffs).toBeGreaterThan(160);
    expect(homeKickoffs).toBeLessThan(240);
    expect(() => calibrationSeed(-1)).toThrow('unsigned');
  });
});

describe('seeded synthetic batch design targets (not empirical football calibration)', () => {
  let report: CalibrationReport;
  beforeAll(() => { report = runCalibration({ matchesPerScenario: 400, seedStart: 1729 }); }, 360_000);

  it('records auditable seeds, scenario sizes, histogram tails and uncertainty', () => {
    expect(report.fixtureNotice).toContain('SYNTHETIC AUTOMATED TESTS ONLY');
    expect(report.sample).toMatchObject({ matchesPerScenario: 400, scenarioCount: CALIBRATION_SCENARIOS.length, totalMatches: 400 * CALIBRATION_SCENARIOS.length, sourceIndexRange: { first: 1729, last: 2128 } });
    expect(report.sample.seedSchedule.seeds).toEqual(Array.from({ length: 400 }, (_, index) => calibrationSeed(1729 + index)));
    for (const scenario of report.scenarios) {
      expect(scenario.metrics.matches).toBe(400);
      expect(Object.values(scenario.metrics.totalGoalHistogram).reduce((sum, count) => sum + count, 0)).toBe(400);
      expect(scenario.metrics.home.goals.count).toBe(400);
      expect(scenario.metrics.home.goals.confidence95.lower).toBeLessThan(scenario.metrics.home.goals.mean);
      expect(scenario.metrics.homeWin.rate + scenario.metrics.draw.rate + scenario.metrics.awayWin.rate).toBeCloseTo(1);
    }
  });

  for (const id of [
    'baseline-scoring', 'baseline-results-variety', 'discipline', 'home-advantage', 'relative-strength', 'moderate-strength',
    'condition-affects-performance', 'stamina-retains-condition', 'pressing-tradeoff',
    'formation-4-3-3', 'formation-4-2-3-1', 'formation-4-1-4-1', 'formation-3-5-2', 'substitute-freshness',
  ]) {
    it(`meets ${id}`, () => {
      const outcome = report.acceptance.outcomes.find(item => item.id === id);
      expect(outcome, `Missing design target ${id}`).toBeDefined();
      expect(outcome?.passed, JSON.stringify(outcome, null, 2)).toBe(true);
    });
  }

  it('rejects undersized batches and seed overflow before simulation', () => {
    expect(() => runCalibration({ matchesPerScenario: 399 })).toThrow('400–1000');
    expect(() => runCalibration({ seedStart: 0xffff_ffff })).toThrow('unsigned');
  });
});
