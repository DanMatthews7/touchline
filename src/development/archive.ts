import { z } from 'zod';
import { MATCH_ENGINE_VERSION } from '../simulation/match';
import { parseSeasonCommand, replaySeason, SEASON_ENGINE_VERSION, type SeasonCommand, type SeasonState } from '../simulation/season';
import { createDemoConfig, parseDemoScenario, type DemoScenario } from './scenario';
import { assertPlainDemoData } from './validation';

export const DEMO_ARCHIVE_FORMAT = 'touchline-season-demo' as const;
export const MAX_DEMO_ARCHIVE_BYTES = 16 * 1024 * 1024;
export const MAX_DEMO_COMMANDS = 5000;
export interface DemoArchive {
  format: typeof DEMO_ARCHIVE_FORMAT;
  schemaVersion: 1;
  engineVersion: typeof SEASON_ENGINE_VERSION;
  matchEngineVersion: typeof MATCH_ENGINE_VERSION;
  id: string;
  updatedAt: string;
  scenario: DemoScenario;
  commands: SeasonCommand[];
}
export interface DemoSession { archive: DemoArchive; state: SeasonState }

const envelopeSchema = z.object({
  format: z.literal(DEMO_ARCHIVE_FORMAT), schemaVersion: z.literal(1),
  engineVersion: z.literal(SEASON_ENGINE_VERSION), matchEngineVersion: z.literal(MATCH_ENGINE_VERSION),
  id: z.string().regex(/^demo-[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/),
  updatedAt: z.string().max(30).datetime(), scenario: z.unknown(), commands: z.array(z.unknown()).max(MAX_DEMO_COMMANDS),
}).strict();

export function parseDemoTimestamp(input: unknown): string {
  return new Date(z.string().max(30).datetime().parse(input)).toISOString();
}
export function parseDemoCommands(input: unknown): SeasonCommand[] {
  assertPlainDemoData(input);
  return z.array(z.unknown()).max(MAX_DEMO_COMMANDS).parse(input).map(parseSeasonCommand);
}
export function assertDemoArchiveSize(archive: DemoArchive): void {
  if (new TextEncoder().encode(JSON.stringify(archive, null, 2)).byteLength > MAX_DEMO_ARCHIVE_BYTES) throw new Error('Demo backup exceeds the 16 MiB limit.');
}
export function parseDemoArchiveEnvelope(input: unknown): DemoArchive {
  assertPlainDemoData(input);
  const fields = envelopeSchema.parse(input);
  const archive: DemoArchive = {
    format: DEMO_ARCHIVE_FORMAT, schemaVersion: 1,
    engineVersion: SEASON_ENGINE_VERSION, matchEngineVersion: MATCH_ENGINE_VERSION,
    id: fields.id, updatedAt: parseDemoTimestamp(fields.updatedAt),
    scenario: parseDemoScenario(fields.scenario), commands: parseDemoCommands(fields.commands),
  };
  assertDemoArchiveSize(archive);
  return archive;
}
export function replayDemoArchive(input: unknown): DemoSession {
  const archive = parseDemoArchiveEnvelope(input);
  return { archive, state: replaySeason(createDemoConfig(archive.scenario, archive.id), archive.commands) };
}
export function createDemoArchive(id: string, scenario: DemoScenario, updatedAt: string): DemoSession {
  return replayDemoArchive({ format: DEMO_ARCHIVE_FORMAT, schemaVersion: 1, engineVersion: SEASON_ENGINE_VERSION, matchEngineVersion: MATCH_ENGINE_VERSION, id, updatedAt, scenario, commands: [] });
}
export function importDemoArchive(serialized: string): DemoSession {
  if (new TextEncoder().encode(serialized).byteLength > MAX_DEMO_ARCHIVE_BYTES) throw new Error('Demo backup exceeds the 16 MiB limit.');
  let parsed: unknown;
  try { parsed = JSON.parse(serialized) as unknown; }
  catch { throw new Error('Choose an exported Touchline development demo backup containing valid JSON.'); }
  return replayDemoArchive(parsed);
}
export function exportDemoArchive(input: DemoArchive): string {
  return JSON.stringify(replayDemoArchive(input).archive, null, 2);
}
