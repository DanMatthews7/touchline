import { z } from 'zod';
import { ALL_ATTRIBUTE_PATHS, getAttributeValue } from '../../domain/attributes';
import { DATABASE_SCHEMA_VERSION, SAVE_SCHEMA_VERSION, type DatabaseSnapshot, type GameState } from '../../domain/models';
import { dateSchema, idSchema, snapshotSchema, timestampSchema, uint32Schema, VersionCompatibilityError } from '../../data/schema';
import { MATCH_ENGINE_VERSION } from '../../simulation/match';
import {
  SEASON_ENGINE_VERSION, parseSeasonCommand, parseSeasonConfig, replaySeason,
  type SeasonCommand, type SeasonConfig, type SeasonState,
} from '../../simulation/season';
import { matchCommandSchema, matchConfigSchema } from '../match/archive';
import { gameStateSchema, validateCareerSnapshot } from '../save-format';
import { currentSquadManifestSchema, evaluateSeasonRosterReadiness, type CurrentSquadManifest } from '../../season/rosters';

export const SEASON_ARCHIVE_FORMAT = 'touchline-season' as const;
export const SEASON_ARCHIVE_SCHEMA_VERSION = 1 as const;
export const MAX_SEASON_ARCHIVE_BYTES = 16 * 1024 * 1024;
export const MAX_SEASON_COMMANDS = 5000;

export const seasonConfigSchema = z.object({
  engineVersion: z.literal(SEASON_ENGINE_VERSION),
  matchEngineVersion: z.literal(MATCH_ENGINE_VERSION),
  id: idSchema.max(96),
  careerId: idSchema,
  name: z.string().min(1).max(240).regex(/\S/).regex(/^[^\u0000-\u001f\u007f]*$/),
  startDate: dateSchema,
  firstMatchDate: dateSchema,
  seed: uint32Schema,
  managedClubId: idSchema,
  teams: z.array(matchConfigSchema.shape.home).length(20),
  assessmentMode: z.enum(['recorded-attributes', 'uniform-missing-10']),
  homeAdvantage: z.number().finite().min(0).max(0.2),
}).strict();

export const seasonCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADVANCE_CALENDAR') }).strict(),
  z.object({ type: z.literal('START_MATCH') }).strict(),
  z.object({ type: z.literal('MATCH_COMMAND'), command: matchCommandSchema }).strict(),
  z.object({ type: z.literal('COMPLETE_ROUND') }).strict(),
  z.object({ type: z.literal('REPLAY_ABANDONED') }).strict(),
]);
export const seasonCommandsSchema = z.array(seasonCommandSchema).max(MAX_SEASON_COMMANDS);

export interface SeasonArchive {
  format: typeof SEASON_ARCHIVE_FORMAT;
  schemaVersion: typeof SEASON_ARCHIVE_SCHEMA_VERSION;
  engineVersion: typeof SEASON_ENGINE_VERSION;
  matchEngineVersion: typeof MATCH_ENGINE_VERSION;
  id: string;
  careerId: string;
  updatedAt: string;
  snapshot: DatabaseSnapshot;
  career: GameState;
  initialConfig: SeasonConfig;
  commands: SeasonCommand[];
  rosterManifest: CurrentSquadManifest;
}
export interface ReplayedSeasonArchive { archive: SeasonArchive; state: SeasonState }

const envelopeSchema = z.object({
  format: z.literal(SEASON_ARCHIVE_FORMAT),
  schemaVersion: z.literal(SEASON_ARCHIVE_SCHEMA_VERSION),
  engineVersion: z.literal(SEASON_ENGINE_VERSION),
  matchEngineVersion: z.literal(MATCH_ENGINE_VERSION),
  id: idSchema.max(96),
  careerId: idSchema,
  updatedAt: timestampSchema.transform(value => new Date(value).toISOString()),
  snapshot: snapshotSchema,
  career: gameStateSchema,
  initialConfig: seasonConfigSchema,
  commands: seasonCommandsSchema,
  rosterManifest: currentSquadManifestSchema,
}).strict();

/** Imports are plain JSON; typed callers cannot smuggle getters or executable objects. */
export function assertPlainSeasonData(input: unknown): void {
  let visited = 0;
  const ancestors = new WeakSet<object>();
  const visit = (value: unknown, depth: number): void => {
    if (++visited > 500_000 || depth > 32) throw new Error('Season archive exceeds the supported data complexity.');
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint' || value === undefined) throw new Error('Season archives must contain plain JSON data.');
    if (typeof value !== 'object' || value === null) return;
    const isArray = Array.isArray(value);
    const prototype: unknown = Object.getPrototypeOf(value);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error('Custom object prototypes are not supported in season archives.');
    if (ancestors.has(value)) throw new Error('Circular season archive data is not supported.');
    ancestors.add(value);
    for (const key of Reflect.ownKeys(value)) {
      if (isArray && key === 'length') continue;
      if (typeof key !== 'string' || (isArray && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) throw new Error('Season archives contain unsupported field names or array properties.');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('Season archives cannot contain accessors or hidden object fields.');
      visit(descriptor.value as unknown, depth + 1);
    }
    ancestors.delete(value);
  };
  visit(input, 0);
}

function version(input: unknown, field: 'schemaVersion' | 'engineVersion' | 'matchEngineVersion', supported: number, kind: string): void {
  if (typeof input === 'object' && input !== null && field in input) {
    const received = (input as Record<string, unknown>)[field];
    if (received !== supported) throw new VersionCompatibilityError(kind, received, supported);
  }
}

/** A season requires verified club affiliations; temporary exhibition selections do not qualify. */
export function validateSeasonSources(snapshot: DatabaseSnapshot, config: SeasonConfig, rosterManifest: CurrentSquadManifest): void {
  const readiness = evaluateSeasonRosterReadiness(snapshot, rosterManifest);
  if (readiness.status !== 'ready') throw new Error(`Current club rosters are not ready for season play. ${readiness.notes.join(' ')}`);
  if (config.startDate < rosterManifest.asOfDate) throw new Error('A season cannot begin before the reviewed current-roster cutoff date.');
  const reviewedClubIds = new Set(readiness.clubs.map(club => club.clubId));
  if (config.teams.length !== reviewedClubIds.size || config.teams.some(team => !reviewedClubIds.has(team.id))) throw new Error('The season teams must exactly match the twenty reviewed current competition memberships.');
  if (snapshot.validation.status !== 'validated') throw new Error('A season requires a validated source snapshot with verified current club rosters.');
  const clubs = new Map(snapshot.clubs.map(club => [club.id, club]));
  const players = new Map(snapshot.players.map(player => [player.id, player]));
  for (const team of config.teams) {
    const club = clubs.get(team.id);
    if (!club || club.name !== team.name || club.dataStatus.validation !== 'verified') throw new Error(`Season club ${team.id} must match a verified club identity in its source snapshot.`);
    for (const participant of team.players) {
      const player = players.get(participant.id);
      if (!player || player.name !== participant.name) throw new Error(`Season player ${participant.id} must match its sourced identity.`);
      if (player.clubId !== team.id || player.dataStatus.validation !== 'verified') throw new Error(`Season player ${participant.id} needs a verified current affiliation with ${team.name}. Exhibition selections cannot establish a club roster.`);
      if ([...player.positions].sort().join(',') !== [...participant.positions].sort().join(',')) throw new Error(`Season player ${participant.id} must preserve sourced positional familiarity.`);
      for (const path of ALL_ATTRIBUTE_PATHS) {
        const source = getAttributeValue(player.attributes, path);
        const expected = source === null && config.assessmentMode === 'uniform-missing-10' ? 10 : source;
        if (expected === null || getAttributeValue(participant.attributes, path) !== expected) throw new Error(`Season player ${participant.id} must preserve recorded attributes or use the explicitly selected missing-value baseline.`);
      }
    }
  }
}

/** Shape/source checks are reusable when comparing an already stored immutable input. */
export function parseSeasonArchiveEnvelope(input: unknown): SeasonArchive {
  assertPlainSeasonData(input);
  version(input, 'schemaVersion', SEASON_ARCHIVE_SCHEMA_VERSION, 'season archive');
  version(input, 'engineVersion', SEASON_ENGINE_VERSION, 'season engine');
  version(input, 'matchEngineVersion', MATCH_ENGINE_VERSION, 'match engine');
  if (typeof input === 'object' && input !== null) {
    if ('initialConfig' in input) {
      version(input.initialConfig, 'engineVersion', SEASON_ENGINE_VERSION, 'season engine');
      version(input.initialConfig, 'matchEngineVersion', MATCH_ENGINE_VERSION, 'match engine');
    }
    if ('snapshot' in input) version(input.snapshot, 'schemaVersion', DATABASE_SCHEMA_VERSION, 'database snapshot');
    if ('career' in input) version(input.career, 'schemaVersion', SAVE_SCHEMA_VERSION, 'career');
    if ('rosterManifest' in input) version(input.rosterManifest, 'schemaVersion', 1, 'current-squad manifest');
  }
  const archive: SeasonArchive = envelopeSchema.parse(input);
  archive.initialConfig = parseSeasonConfig(archive.initialConfig);
  archive.commands = archive.commands.map(command => parseSeasonCommand(command));
  if (archive.id !== archive.initialConfig.id || archive.careerId !== archive.career.id || archive.careerId !== archive.initialConfig.careerId) throw new Error('Season, configuration and career identifiers must agree.');
  if (archive.career.managedClubId !== archive.initialConfig.managedClubId) throw new Error('Season and career must manage the same club.');
  validateCareerSnapshot(archive.career, archive.snapshot);
  validateSeasonSources(archive.snapshot, archive.initialConfig, archive.rosterManifest);
  if (Date.parse(archive.updatedAt) !== Date.parse(archive.career.updatedAt)) throw new Error('Season and career update timestamps must agree.');
  // A merged source must remain exportable, even when both input databases were
  // individually within their import limits.
  assertSeasonArchiveSize(archive);
  return archive;
}

export function replaySeasonArchive(input: unknown): ReplayedSeasonArchive {
  const archive = parseSeasonArchiveEnvelope(input);
  const state = replaySeason(archive.initialConfig, archive.commands);
  if (archive.career.currentDate !== state.currentDate) throw new Error('Career date does not match the replayed season calendar.');
  return { archive, state };
}

/** Creation projects the calendar; imports instead reject inconsistent saved dates. */
export function createSeasonArchive(id: string, snapshot: DatabaseSnapshot, career: GameState, initialConfig: SeasonConfig, commands: SeasonCommand[], updatedAt: string, rosterManifest: CurrentSquadManifest): SeasonArchive {
  assertPlainSeasonData({ id, snapshot, career, initialConfig, commands, updatedAt, rosterManifest });
  const config = parseSeasonConfig(seasonConfigSchema.parse(initialConfig));
  const accepted = seasonCommandsSchema.parse(commands).map(command => parseSeasonCommand(command));
  const state = replaySeason(config, accepted);
  return parseSeasonArchiveEnvelope({
    format: SEASON_ARCHIVE_FORMAT, schemaVersion: SEASON_ARCHIVE_SCHEMA_VERSION,
    engineVersion: SEASON_ENGINE_VERSION, matchEngineVersion: MATCH_ENGINE_VERSION,
    id, careerId: career.id, updatedAt, snapshot,
    career: { ...career, currentDate: state.currentDate, updatedAt }, initialConfig: config, commands: accepted, rosterManifest,
  });
}

function enforceSize(serialized: string): void {
  if (new TextEncoder().encode(serialized).byteLength > MAX_SEASON_ARCHIVE_BYTES) throw new Error('Season archive exceeds the 16 MiB limit.');
}
/** For trusted incremental state: enforce portability without replaying previous fixtures. */
export function assertSeasonArchiveSize(archive: SeasonArchive): void {
  enforceSize(JSON.stringify(archive, null, 2));
}
export function importSeasonArchive(serialized: string): ReplayedSeasonArchive {
  enforceSize(serialized);
  let input: unknown;
  try { input = JSON.parse(serialized) as unknown; }
  catch { throw new Error('Season archive is not valid JSON. Choose an exported Touchline season backup.'); }
  return replaySeasonArchive(input);
}
export function exportSeasonArchive(input: SeasonArchive): string {
  const { archive } = replaySeasonArchive(input);
  const serialized = JSON.stringify(archive, null, 2);
  enforceSize(serialized);
  return serialized;
}
