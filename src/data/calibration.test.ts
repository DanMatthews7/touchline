import { describe, expect, it } from 'vitest';
import { calibrateAttribute, createEditorialAssessment, type CalibrationEvidence, type CalibrationRule } from './calibration';
import { TEST_TIMESTAMP } from './__tests__/fixtures';

/** These mappings are synthetic tests, not football calibration claims. */
const rule: CalibrationRule = {
  id: 'synthetic-rule', version: 1, attribute: 'technical.passing', metric: 'synthetic metric', units: 'synthetic units', description: 'Synthetic interpolation for tests only.', minimumSampleSize: 10,
  anchors: [{ evidence: 0, rating: 1 }, { evidence: 100, rating: 20 }],
};
const evidence: CalibrationEvidence = { metric: rule.metric, units: rule.units, value: 50, sampleSize: 10, confidence: 'medium', sourceIds: ['synthetic-tests'] };

describe('explicit original attribute calibration', () => {
  it('interpolates with documented method, provenance and uncertainty', () => {
    const result = calibrateAttribute(rule, evidence, TEST_TIMESTAMP);
    expect(result.value).toBe(11);
    expect(result.assessment).toMatchObject({ status: 'original-estimate', confidence: 'medium', evidenceSourceIds: ['synthetic-tests'] });
    expect(result.assessment!.method).toContain('synthetic-rule v1');
    expect(result.assessment!.method).toContain('0:1, 100:20');
  });

  it('clamps configured endpoints and supports an inverse metric explicitly', () => {
    expect(calibrateAttribute(rule, { ...evidence, value: -20 }, TEST_TIMESTAMP).value).toBe(1);
    expect(calibrateAttribute(rule, { ...evidence, value: 200 }, TEST_TIMESTAMP).value).toBe(20);
    expect(calibrateAttribute({ ...rule, anchors: [{ evidence: 0, rating: 20 }, { evidence: 100, rating: 1 }] }, { ...evidence, value: 0 }, TEST_TIMESTAMP).value).toBe(20);
  });

  it('leaves weak, missing, mismatched and undersampled evidence unknown', () => {
    for (const patch of [{ confidence: 'low' as const }, { value: null }, { sampleSize: 9 }, { metric: 'different' }, { sourceIds: [] }]) {
      expect(calibrateAttribute(rule, { ...evidence, ...patch }, TEST_TIMESTAMP)).toMatchObject({ value: null, assessment: null });
    }
  });

  it('validates editor metadata and rejects broken configurations and unsafe numeric evidence', () => {
    expect(createEditorialAssessment({ confidence: 'low', method: 'Explicit synthetic override.', evidenceSourceIds: ['synthetic-tests'], assessedAt: TEST_TIMESTAMP }).status).toBe('editorial-override');
    expect(createEditorialAssessment({ confidence: 'low', method: 'Explicit synthetic override.\nSecond line records uncertainty.', evidenceSourceIds: ['synthetic-tests'], assessedAt: TEST_TIMESTAMP }).method).toContain('\n');
    expect(() => createEditorialAssessment({ confidence: 'low', method: '', evidenceSourceIds: [], assessedAt: TEST_TIMESTAMP })).toThrow();
    expect(() => calibrateAttribute({ ...rule, anchors: [{ evidence: 1, rating: 1 }, { evidence: 1, rating: 20 }] }, evidence, TEST_TIMESTAMP)).toThrow(/increasing/);
    expect(() => calibrateAttribute(rule, { ...evidence, value: Infinity }, TEST_TIMESTAMP)).toThrow();
  });
});
