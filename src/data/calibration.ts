import { z } from 'zod';
import { ALL_ATTRIBUTE_PATHS, type AttributeAssessment, type AttributePath, type AttributeValue } from '../domain/attributes';
import { attributeAssessmentSchema, idSchema, timestampSchema } from './schema';

const finiteNumber = z.number().finite().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const label = z.string().trim().min(1).max(200);
const anchorSchema = z.object({ evidence: finiteNumber, rating: z.number().int().min(1).max(20) }).strict();

/** There is deliberately no default mapping from a biography or statistic to ability. */
export const calibrationRuleSchema = z.object({
  id: idSchema,
  version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  attribute: z.enum(ALL_ATTRIBUTE_PATHS as [AttributePath, ...AttributePath[]]),
  metric: label,
  units: label,
  description: z.string().trim().min(1).max(600),
  minimumSampleSize: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  anchors: z.array(anchorSchema).min(2).max(20),
}).strict().superRefine((rule, context) => {
  rule.anchors.forEach((anchor, index) => {
    if (index > 0 && anchor.evidence <= rule.anchors[index - 1]!.evidence) {
      context.addIssue({ code: 'custom', path: ['anchors', index, 'evidence'], message: 'Evidence anchors must be in strictly increasing order.' });
    }
  });
});

export type CalibrationRule = z.infer<typeof calibrationRuleSchema>;
export interface CalibrationEvidence {
  metric: string;
  units: string;
  value: number | null;
  sampleSize: number;
  confidence: 'low' | 'medium' | 'high';
  sourceIds: string[];
}
export interface AttributeEstimate {
  value: AttributeValue;
  assessment: AttributeAssessment | null;
  reason: string;
}

const evidenceSchema = z.object({
  metric: label,
  units: label,
  value: finiteNumber.nullable(),
  sampleSize: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  confidence: z.enum(['low', 'medium', 'high']),
  sourceIds: z.array(idSchema).max(100),
}).strict();

export function createEditorialAssessment(input: Omit<AttributeAssessment, 'status'>): AttributeAssessment {
  return attributeAssessmentSchema.parse({ ...input, status: 'editorial-override' });
}

/**
 * Piecewise linear interpolation with endpoint clamping, followed by nearest-integer
 * rounding. A rule describes an original, inspectable modelling choice, not a claim
 * that its target ability can be objectively recovered from that evidence.
 */
export function calibrateAttribute(ruleInput: CalibrationRule, evidenceInput: CalibrationEvidence, assessedAt: string): AttributeEstimate {
  const rule = calibrationRuleSchema.parse(ruleInput);
  const evidence = evidenceSchema.parse(evidenceInput);
  timestampSchema.parse(assessedAt);
  const unknown = (reason: string): AttributeEstimate => ({ value: null, assessment: null, reason });
  if (evidence.metric !== rule.metric || evidence.units !== rule.units) return unknown('Evidence does not match the configured metric and units.');
  if (evidence.value === null) return unknown('Evidence is missing; the attribute remains unassessed.');
  if (evidence.sourceIds.length === 0) return unknown('Evidence has no source attribution; the attribute remains unassessed.');
  if (evidence.sampleSize < rule.minimumSampleSize) return unknown(`At least ${rule.minimumSampleSize} observations are required; the attribute remains unassessed.`);
  if (evidence.confidence === 'low') return unknown('Evidence confidence is low; a documented editorial override is required to assign a value.');

  const first = rule.anchors[0]!;
  const last = rule.anchors[rule.anchors.length - 1]!;
  let rating: number;
  if (evidence.value <= first.evidence) rating = first.rating;
  else if (evidence.value >= last.evidence) rating = last.rating;
  else {
    const upperIndex = rule.anchors.findIndex(anchor => anchor.evidence >= evidence.value!);
    const lower = rule.anchors[upperIndex - 1]!;
    const upper = rule.anchors[upperIndex]!;
    const fraction = (evidence.value - lower.evidence) / (upper.evidence - lower.evidence);
    rating = Math.round(lower.rating + fraction * (upper.rating - lower.rating));
  }
  const assessment = attributeAssessmentSchema.parse({
    status: 'original-estimate',
    confidence: evidence.confidence,
    method: `Rule ${rule.id} v${rule.version}: ${rule.description} Metric: ${rule.metric} (${rule.units}); n=${evidence.sampleSize}, value=${evidence.value}. Piecewise linear anchors ${rule.anchors.map(anchor => `${anchor.evidence}:${anchor.rating}`).join(', ')}; endpoints clamped; nearest integer.`,
    evidenceSourceIds: evidence.sourceIds,
    assessedAt,
  });
  return { value: rating, assessment, reason: 'Original estimate from the explicit calibration rule; this is not a verified biographical fact.' };
}
