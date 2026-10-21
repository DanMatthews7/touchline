import { z } from 'zod';
import { MATCH_ENGINE_VERSION } from '../simulation/match';
import { parseSeasonCommand, replaySeason, SEASON_ENGINE_VERSION, type SeasonCommand, type SeasonState } from '../simulation/season';
import { CAREER_FINANCE_ENGINE_VERSION, type CareerFinanceState } from '../simulation/career';
import { createDemoConfig, parseDemoScenario, type DemoScenario } from './scenario';
import { assertPlainDemoData } from './validation';
import { applyDemoDecision, createDemoFinances } from './career-session';
import { isDemoFinanceCommand, parseDemoCommand, type DemoCommand } from './commands';
export { parseDemoCommand, isDemoFinanceCommand, type DemoCommand, type DemoContractRenewal, type DemoNegotiatedContract } from './commands';

export const DEMO_ARCHIVE_FORMAT = 'touchline-season-demo' as const;
export const MAX_DEMO_ARCHIVE_BYTES = 16 * 1024 * 1024;
export const MAX_DEMO_COMMANDS = 5000;
interface ArchiveBase {
  format: typeof DEMO_ARCHIVE_FORMAT;
  engineVersion: typeof SEASON_ENGINE_VERSION;
  matchEngineVersion: typeof MATCH_ENGINE_VERSION;
  id: string;
  updatedAt: string;
  scenario: DemoScenario;
}
export interface LegacyDemoArchive extends ArchiveBase { schemaVersion: 1; commands: SeasonCommand[] }
export interface CareerDemoArchive extends ArchiveBase {
  schemaVersion: 2;
  careerEngineVersion: typeof CAREER_FINANCE_ENGINE_VERSION;
  /** Prefix football decisions before the explicit finance activation boundary. */
  careerStartCommandIndex: number;
  commands: DemoCommand[];
}
export type DemoArchive = LegacyDemoArchive | CareerDemoArchive;
export interface DemoSession { archive: DemoArchive; state: SeasonState; finances: CareerFinanceState | null }

const commonFields = {
  format: z.literal(DEMO_ARCHIVE_FORMAT),
  engineVersion: z.literal(SEASON_ENGINE_VERSION), matchEngineVersion: z.literal(MATCH_ENGINE_VERSION),
  id: z.string().regex(/^demo-[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/),
  updatedAt: z.string().max(30).datetime(), scenario: z.unknown(), commands: z.array(z.unknown()).max(MAX_DEMO_COMMANDS),
};
const envelopeSchema = z.discriminatedUnion('schemaVersion', [
  z.object({ ...commonFields, schemaVersion: z.literal(1) }).strict(),
  z.object({ ...commonFields, schemaVersion: z.literal(2), careerEngineVersion: z.literal(CAREER_FINANCE_ENGINE_VERSION), careerStartCommandIndex: z.number().int().min(0).max(MAX_DEMO_COMMANDS) }).strict(),
]);

export function parseDemoTimestamp(input: unknown): string {
  return new Date(z.string().max(30).datetime().parse(input)).toISOString();
}
export function parseDemoCommands(input: unknown): DemoCommand[] {
  assertPlainDemoData(input);
  return z.array(z.unknown()).max(MAX_DEMO_COMMANDS).parse(input).map(parseDemoCommand);
}
export function assertDemoArchiveSize(archive: DemoArchive): void {
  if (new TextEncoder().encode(JSON.stringify(archive, null, 2)).byteLength > MAX_DEMO_ARCHIVE_BYTES) throw new Error('Demo backup exceeds the 16 MiB limit.');
}
export function parseDemoArchiveEnvelope(input: unknown): DemoArchive {
  assertPlainDemoData(input);
  const fields = envelopeSchema.parse(input);
  const base: ArchiveBase = {
    format: DEMO_ARCHIVE_FORMAT, engineVersion: SEASON_ENGINE_VERSION, matchEngineVersion: MATCH_ENGINE_VERSION,
    id: fields.id, updatedAt: parseDemoTimestamp(fields.updatedAt), scenario: parseDemoScenario(fields.scenario),
  };
  let archive: DemoArchive;
  if (fields.schemaVersion === 1) {
    // Keep the original portable field ordering and command interpretation.
    archive = { format: base.format, schemaVersion: 1, engineVersion: base.engineVersion, matchEngineVersion: base.matchEngineVersion, id: base.id, updatedAt: base.updatedAt, scenario: base.scenario, commands: fields.commands.map(parseSeasonCommand) };
  } else {
    const commands = parseDemoCommands(fields.commands);
    if (fields.careerStartCommandIndex > commands.length) throw new Error('Career activation cannot follow the end of the demo command log.');
    if (commands.slice(0, fields.careerStartCommandIndex).some(isDemoFinanceCommand)) throw new Error('A contract decision cannot precede career activation.');
    archive = { format: base.format, schemaVersion: 2, engineVersion: base.engineVersion, matchEngineVersion: base.matchEngineVersion, careerEngineVersion: CAREER_FINANCE_ENGINE_VERSION, id: base.id, updatedAt: base.updatedAt, scenario: base.scenario, careerStartCommandIndex: fields.careerStartCommandIndex, commands };
  }
  assertDemoArchiveSize(archive);
  return archive;
}
export function replayDemoArchive(input: unknown): DemoSession {
  const archive = parseDemoArchiveEnvelope(input);
  const config = createDemoConfig(archive.scenario, archive.id);
  if (archive.schemaVersion === 1) return { archive, state: replaySeason(config, archive.commands), finances: null };
  const prefix = archive.commands.slice(0, archive.careerStartCommandIndex) as SeasonCommand[];
  let state = replaySeason(config, prefix);
  let finances: CareerFinanceState | null = createDemoFinances(state);
  for (const command of archive.commands.slice(archive.careerStartCommandIndex)) {
    const result = applyDemoDecision(state, finances, command);
    state = result.state;
    finances = result.finances;
  }
  return { archive, state, finances };
}
/** Original format retained for existing backups and explicit compatibility tooling. */
export function createDemoArchive(id: string, scenario: DemoScenario, updatedAt: string): DemoSession {
  return replayDemoArchive({ format: DEMO_ARCHIVE_FORMAT, schemaVersion: 1, engineVersion: SEASON_ENGINE_VERSION, matchEngineVersion: MATCH_ENGINE_VERSION, id, updatedAt, scenario, commands: [] });
}
export function createCareerDemoArchive(id: string, scenario: DemoScenario, updatedAt: string): DemoSession {
  return replayDemoArchive({ format: DEMO_ARCHIVE_FORMAT, schemaVersion: 2, engineVersion: SEASON_ENGINE_VERSION, matchEngineVersion: MATCH_ENGINE_VERSION, careerEngineVersion: CAREER_FINANCE_ENGINE_VERSION, id, updatedAt, scenario, careerStartCommandIndex: 0, commands: [] });
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
