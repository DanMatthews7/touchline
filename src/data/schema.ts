import { z } from 'zod';
import {
  ALL_ATTRIBUTE_PATHS, ATTRIBUTE_KEYS, getAttributeValue,
  type AttributePath,
} from '../domain/attributes';
import {
  DATABASE_SCHEMA_VERSION, POSITIONS,
  type DatabaseSnapshot,
} from '../domain/models';

/** Explicit compatibility failures are distinct from damaged or incomplete data. */
export class VersionCompatibilityError extends Error {
  constructor(public readonly kind: string, public readonly received: unknown, public readonly supported: number) {
    super(`Unsupported ${kind} version ${String(received)}. This build supports version ${supported}; ${typeof received === 'number' && received < supported ? 'no migration from this older format is available' : 'use a compatible application version'}.`);
    this.name = 'VersionCompatibilityError';
  }
}

export function requireVersion(input: unknown, expected: number, kind: string): void {
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input && input.schemaVersion !== expected) {
    throw new VersionCompatibilityError(kind, input.schemaVersion, expected);
  }
}

export const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/, 'Use a stable identifier of at most 128 letters, digits, dots, colons, underscores or hyphens.');
const text = (max = 240, multiline = false) => z.string().min(1).max(max).regex(/\S/, 'Text cannot be blank.').regex(
  multiline ? /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/ : /^[^\u0000-\u001f\u007f]*$/,
  'Control characters are not allowed.',
);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date.');
export const timestampSchema = z.string().max(30).datetime({ message: 'Use a UTC ISO 8601 timestamp.' });
const urlSchema = z.string().max(2048).url().refine(value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, 'Use an HTTP(S) source URL without embedded credentials.');
const notesSchema = z.array(text(2000, true)).max(100);
const seasonSchema = z.string().regex(/^\d{4}\/\d{2}$/, 'Use a season such as 2026/27.').refine(value => {
  const year = Number(value.slice(0, 4));
  return Number(value.slice(5)) === (year + 1) % 100;
}, 'The season must cover consecutive years.');
const safeInteger = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
export const uint32Schema = z.number().int().min(0).max(0xffff_ffff);
const ratingSchema = z.number().int().min(1).max(20).nullable();

export const provenanceSchema = z.object({
  sourceId: idSchema,
  sourceName: text(),
  url: urlSchema,
  accessedAt: timestampSchema,
  sourceDate: dateSchema.nullable(),
  externalId: text(200).nullable(),
  license: z.object({ name: text(), url: urlSchema.nullable(), usageRestrictions: notesSchema }).strict(),
}).strict();

const dataStatusSchema = z.object({
  validation: z.enum(['verified', 'needs-review']),
  completeness: z.enum(['partial', 'complete']),
  notes: notesSchema,
}).strict();

function attributeGroupSchema<T extends readonly string[]>(keys: T) {
  const shape = Object.fromEntries(keys.map(key => [key, ratingSchema])) as { [K in T[number]]: typeof ratingSchema };
  return z.object(shape).strict();
}

export const attributesSchema = z.object({
  technical: attributeGroupSchema(ATTRIBUTE_KEYS.technical),
  mental: attributeGroupSchema(ATTRIBUTE_KEYS.mental),
  physical: attributeGroupSchema(ATTRIBUTE_KEYS.physical),
  goalkeeping: attributeGroupSchema(ATTRIBUTE_KEYS.goalkeeping),
}).strict();

export const attributeAssessmentSchema = z.object({
  status: z.enum(['original-estimate', 'editorial-override']),
  confidence: z.enum(['low', 'medium', 'high']),
  method: text(2000, true),
  evidenceSourceIds: z.array(idSchema).min(1).max(100),
  assessedAt: timestampSchema,
}).strict();
const assessmentShape = Object.fromEntries(ALL_ATTRIBUTE_PATHS.map(path => [path, attributeAssessmentSchema.optional()])) as Record<AttributePath, z.ZodOptional<typeof attributeAssessmentSchema>>;
const personalityShape = Object.fromEntries(['professionalism', 'ambition', 'loyalty', 'pressure', 'sportsmanship', 'temperament'].map(key => [key, ratingSchema.optional()]));
const moneySchema = z.object({ amountMinor: safeInteger, currency: z.string().regex(/^[A-Z]{3}$/) }).strict();
const budgetSchema = moneySchema.extend({ amountMinor: safeInteger.min(0) });

const financesSchema = z.object({ balance: moneySchema, transferBudget: budgetSchema, weeklyWageBudget: budgetSchema }).strict().refine(
  value => value.balance.currency === value.transferBudget.currency && value.balance.currency === value.weeklyWageBudget.currency,
  'Club accounts must use one currency.',
);

export const playerSchema = z.object({
  id: idSchema,
  name: text(),
  dateOfBirth: dateSchema.nullable(),
  nationality: z.array(text(100)).max(10),
  positions: z.array(z.enum(POSITIONS)).max(POSITIONS.length),
  preferredFoot: z.enum(['left', 'right', 'both', 'unknown']),
  clubId: idSchema.nullable(),
  attributes: attributesSchema,
  attributeAssessments: z.object(assessmentShape).strict(),
  hidden: z.object({
    personality: z.object(personalityShape).strict(),
    currentDevelopmentLevel: ratingSchema,
    potential: ratingSchema,
  }).strict(),
  dataStatus: dataStatusSchema,
  provenance: z.array(provenanceSchema).min(1).max(100),
}).strict();

export const clubSchema = z.object({
  id: idSchema,
  name: text(),
  shortName: text(60),
  country: text(100),
  stadium: text().nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  finances: financesSchema.nullable(),
  dataStatus: dataStatusSchema,
  provenance: z.array(provenanceSchema).min(1).max(100),
}).strict();

const competitionSchema = z.object({
  id: idSchema,
  name: text(),
  country: text(100),
  season: seasonSchema,
  format: z.enum(['league', 'cup']),
  clubIds: z.array(idSchema).max(1000),
  provenance: z.array(provenanceSchema).min(1).max(100),
}).strict();

/** Untrusted imports may contain no playable players, but never invented defaults. */
export const snapshotSchema = z.object({
  schemaVersion: z.literal(DATABASE_SCHEMA_VERSION),
  id: idSchema,
  name: text(),
  season: seasonSchema,
  createdAt: timestampSchema,
  sources: z.array(provenanceSchema).max(10_000),
  players: z.array(playerSchema).max(100_000),
  clubs: z.array(clubSchema).max(10_000),
  competitions: z.array(competitionSchema).max(1000),
  validation: z.object({ status: z.enum(['reference-only', 'validated']), notes: notesSchema }).strict(),
}).strict().superRefine((snapshot, context) => {
  const issue = (path: (string | number)[], message: string) => context.addIssue({ code: 'custom', path, message });
  const unique = (ids: string[], path: (string | number)[]) => {
    const seen = new Set<string>();
    ids.forEach((id, index) => { if (seen.has(id)) issue([...path, index], `Duplicate identifier: ${id}.`); seen.add(id); });
  };
  unique(snapshot.players.map(player => player.id), ['players']);
  unique(snapshot.clubs.map(club => club.id), ['clubs']);
  unique(snapshot.competitions.map(competition => competition.id), ['competitions']);
  unique(snapshot.sources.map(source => source.sourceId), ['sources']);
  const clubIds = new Set(snapshot.clubs.map(club => club.id));
  const sourceIds = new Set(snapshot.sources.map(source => source.sourceId));
  const validateProvenance = (records: z.infer<typeof provenanceSchema>[], path: (string | number)[]) => {
    records.forEach((record, index) => {
      if (!sourceIds.has(record.sourceId)) issue([...path, index, 'sourceId'], 'Source must be registered in snapshot.sources.');
    });
  };
  snapshot.players.forEach((player, index) => {
    if (player.clubId !== null && !clubIds.has(player.clubId)) issue(['players', index, 'clubId'], 'Player is assigned to a club absent from this snapshot.');
    unique(player.positions, ['players', index, 'positions']);
    validateProvenance(player.provenance, ['players', index, 'provenance']);
    for (const path of ALL_ATTRIBUTE_PATHS) {
      const value = getAttributeValue(player.attributes, path);
      const assessment = player.attributeAssessments[path];
      if (value !== null && !assessment) issue(['players', index, 'attributeAssessments', path], 'Every game attribute estimate needs a separate original assessment and uncertainty record.');
      if (value === null && assessment) issue(['players', index, 'attributeAssessments', path], 'An unassessed attribute must not carry a numeric assessment.');
      assessment?.evidenceSourceIds.forEach((sourceId, evidenceIndex) => {
        if (!sourceIds.has(sourceId)) issue(['players', index, 'attributeAssessments', path, 'evidenceSourceIds', evidenceIndex], 'Assessment evidence must reference a registered source.');
      });
    }
  });
  snapshot.clubs.forEach((club, index) => validateProvenance(club.provenance, ['clubs', index, 'provenance']));
  snapshot.competitions.forEach((competition, index) => {
    unique(competition.clubIds, ['competitions', index, 'clubIds']);
    competition.clubIds.forEach((clubId, clubIndex) => {
      if (!clubIds.has(clubId)) issue(['competitions', index, 'clubIds', clubIndex], 'Competition references a club absent from this snapshot.');
    });
    validateProvenance(competition.provenance, ['competitions', index, 'provenance']);
  });
});

export function parseSnapshot(input: unknown): DatabaseSnapshot {
  requireVersion(input, DATABASE_SCHEMA_VERSION, 'database snapshot');
  return snapshotSchema.parse(input);
}
