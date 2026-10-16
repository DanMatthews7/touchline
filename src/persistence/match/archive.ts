import { z } from 'zod';
import { attributesSchema, idSchema, timestampSchema, uint32Schema, VersionCompatibilityError } from '../../data/schema';
import { FORMATIONS, POSITIONS } from '../../domain/models';
import {
  MATCH_ENGINE_VERSION, parseMatchConfig, replayMatch,
  type MatchCommand, type MatchConfig, type MatchState,
} from '../../simulation/match';

export const MATCH_ARCHIVE_SCHEMA_VERSION = 1 as const;
export const MATCH_ARCHIVE_FORMAT = 'touchline-match' as const;
export const MAX_MATCH_ARCHIVE_BYTES = 16 * 1024 * 1024;
export const MAX_MATCH_ARCHIVE_COMMANDS = 1000;

const nameSchema = z.string().min(1).max(240).regex(/\S/).regex(/^[^\u0000-\u001f\u007f]*$/);
const roleSchema = z.enum(['goalkeeper', 'centreBack', 'fullBack', 'defensiveMidfielder', 'centralMidfielder', 'wideMidfielder', 'attackingMidfielder', 'winger', 'striker']);
const sideSchema = z.enum(['home', 'away']);

const instructionsSchema = z.object({
  mentality: z.enum(['defensive', 'balanced', 'attacking']),
  tempo: z.enum(['slow', 'standard', 'fast']),
  width: z.enum(['narrow', 'standard', 'wide']),
  pressingIntensity: z.enum(['low', 'standard', 'high']),
  defensiveLine: z.enum(['deep', 'standard', 'high']),
}).strict();

const lineupSlotSchema = z.object({ playerId: idSchema, position: z.enum(POSITIONS), role: roleSchema }).strict();
const matchPlayerSchema = z.object({
  id: idSchema,
  name: nameSchema,
  attributes: attributesSchema.refine(
    attributes => Object.values(attributes).every(group => Object.values(group).every(value => value !== null)),
    'Match scenarios need explicit values for every visible attribute; choose recorded assessments or an explicit exhibition baseline.',
  ),
  positions: z.array(z.enum(POSITIONS)).max(POSITIONS.length),
  initialCondition: z.number().finite().min(0).max(100),
  initialMorale: z.number().finite().min(0).max(100),
}).strict();

const matchTeamSchema = z.object({
  id: idSchema,
  name: nameSchema,
  players: z.array(matchPlayerSchema).min(11).max(20),
  lineup: z.array(lineupSlotSchema).length(11),
  benchIds: z.array(idSchema).max(9),
  formation: z.enum(FORMATIONS),
  instructions: instructionsSchema,
}).strict();

export const matchConfigSchema = z.object({
  engineVersion: z.literal(MATCH_ENGINE_VERSION),
  id: idSchema,
  seed: uint32Schema,
  assessmentMode: z.enum(['recorded-attributes', 'uniform-missing-10']),
  home: matchTeamSchema,
  away: matchTeamSchema,
  homeAdvantage: z.number().finite().min(0).max(0.2),
}).strict();

export const matchCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADVANCE') }).strict(),
  z.object({ type: z.literal('SUBSTITUTE'), team: sideSchema, playerOutId: idSchema, playerInId: idSchema }).strict(),
  z.object({
    type: z.literal('CHANGE_TACTICS'), team: sideSchema,
    formation: z.enum(FORMATIONS), instructions: instructionsSchema,
    lineup: z.array(lineupSlotSchema).min(7).max(11),
  }).strict(),
]);

export interface MatchArchive {
  format: typeof MATCH_ARCHIVE_FORMAT;
  schemaVersion: typeof MATCH_ARCHIVE_SCHEMA_VERSION;
  engineVersion: typeof MATCH_ENGINE_VERSION;
  id: string;
  updatedAt: string;
  config: MatchConfig;
  commands: MatchCommand[];
}

export interface ReplayedMatchArchive { archive: MatchArchive; state: MatchState }

export const matchArchiveSchema = z.object({
  format: z.literal(MATCH_ARCHIVE_FORMAT),
  schemaVersion: z.literal(MATCH_ARCHIVE_SCHEMA_VERSION),
  engineVersion: z.literal(MATCH_ENGINE_VERSION),
  id: idSchema,
  // Canonical milliseconds keep the IndexedDB timestamp index chronological even
  // when an imported UTC timestamp omits fractional seconds.
  updatedAt: timestampSchema.transform(value => new Date(value).toISOString()),
  config: matchConfigSchema,
  commands: z.array(matchCommandSchema).max(MAX_MATCH_ARCHIVE_COMMANDS),
}).strict();

function assertSupportedVersion(input: unknown, field: 'schemaVersion' | 'engineVersion', version: number, kind: string): void {
  if (typeof input === 'object' && input !== null && field in input) {
    const received = (input as Record<string, unknown>)[field];
    if (received !== version) throw new VersionCompatibilityError(kind, received, version);
  }
}

/** File imports are JSON; reject executable/accessor-bearing objects at this API too. */
function assertPlainData(input: unknown): void {
  let visited = 0;
  const ancestors = new WeakSet<object>();
  const visit = (value: unknown, depth: number): void => {
    visited++;
    if (visited > 100_000 || depth > 32) throw new Error('Match archive exceeds the supported data complexity.');
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint' || value === undefined) {
      throw new Error('Match archives must contain plain JSON data.');
    }
    if (typeof value !== 'object' || value === null) return;
    const prototype: unknown = Object.getPrototypeOf(value);
    const isArray = Array.isArray(value);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      throw new Error('Custom object prototypes are not supported in match archives.');
    }
    if (ancestors.has(value)) throw new Error('Circular match archive data is not supported.');
    ancestors.add(value);
    for (const key of Reflect.ownKeys(value)) {
      if (isArray && key === 'length') continue;
      if (typeof key !== 'string') throw new Error('Match archives must contain plain JSON field names.');
      if (isArray && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) {
        throw new Error('Match archives cannot contain extra array properties.');
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        throw new Error('Match archives cannot contain accessors or hidden object fields.');
      }
      visit(descriptor.value as unknown, depth + 1);
    }
    ancestors.delete(value);
  };
  visit(input, 0);
}

/** Always derive events, score, statistics and RNG state by replaying trusted engine code. */
export function replayMatchArchive(input: unknown): ReplayedMatchArchive {
  assertPlainData(input);
  assertSupportedVersion(input, 'schemaVersion', MATCH_ARCHIVE_SCHEMA_VERSION, 'match archive');
  assertSupportedVersion(input, 'engineVersion', MATCH_ENGINE_VERSION, 'match engine');
  if (typeof input === 'object' && input !== null && 'config' in input) {
    assertSupportedVersion(input.config, 'engineVersion', MATCH_ENGINE_VERSION, 'match engine');
  }
  // Zod clones the initial configuration and commands so later caller edits cannot
  // silently mutate a validated archive. The engine then checks football relations.
  const archive: MatchArchive = matchArchiveSchema.parse(input);
  const config = parseMatchConfig(archive.config);
  const state = replayMatch(config, archive.commands);
  return { archive, state };
}

export function createMatchArchive(id: string, config: MatchConfig, commands: MatchCommand[], updatedAt: string): MatchArchive {
  return replayMatchArchive({
    format: MATCH_ARCHIVE_FORMAT,
    schemaVersion: MATCH_ARCHIVE_SCHEMA_VERSION,
    engineVersion: MATCH_ENGINE_VERSION,
    id, updatedAt, config, commands,
  }).archive;
}

function enforceSize(serialized: string): void {
  if (new TextEncoder().encode(serialized).byteLength > MAX_MATCH_ARCHIVE_BYTES) {
    throw new Error('Match archive exceeds the 16 MiB limit.');
  }
}

/** This pure parser performs no storage writes and never trusts saved derived results. */
export function importMatchArchive(serialized: string): ReplayedMatchArchive {
  enforceSize(serialized);
  let input: unknown;
  try { input = JSON.parse(serialized) as unknown; }
  catch { throw new Error('Match archive is not valid JSON. Choose an exported Touchline match file.'); }
  return replayMatchArchive(input);
}

export function exportMatchArchive(input: MatchArchive): string {
  const { archive } = replayMatchArchive(input);
  const serialized = JSON.stringify(archive, null, 2);
  enforceSize(serialized);
  return serialized;
}
