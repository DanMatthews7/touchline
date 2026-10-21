import Dexie, { type Table } from 'dexie';
import { CAREER_FINANCE_ENGINE_VERSION } from '../simulation/career';
import {
  createCareerDemoArchive, assertDemoArchiveSize, exportDemoArchive, importDemoArchive,
  MAX_DEMO_COMMANDS, parseDemoCommand, parseDemoCommands, parseDemoTimestamp, replayDemoArchive,
  type DemoArchive, type DemoCommand, type DemoSession,
} from './archive';
import { applyDemoDecision, createDemoFinances } from './career-session';
import type { DemoScenario } from './scenario';
import { assertPlainDemoData } from './validation';

export const DEMO_DATABASE_NAME = 'touchline-season-demo';
interface DemoCheckpoint { slot: 'active'; archive: DemoArchive }
class DemoDatabase extends Dexie {
  checkpoints!: Table<DemoCheckpoint, string>;
  constructor(name: string) {
    super(name);
    // The portable archive version changes, not the existing checkpoint table.
    this.version(1).stores({ checkpoints: 'slot' });
  }
}
export class DemoConflictError extends Error {
  constructor(message = 'The development demo changed in another tab. Reload before making another decision.') { super(message); this.name = 'DemoConflictError'; }
}

/** Separate storage and backup format; normal career/source stores are never opened. */
export class DemoRepository {
  private readonly database: DemoDatabase;
  private cache: DemoSession | undefined;
  constructor(databaseName = DEMO_DATABASE_NAME) { this.database = new DemoDatabase(databaseName); }

  private verified(archive: DemoArchive): DemoSession {
    if (this.cache && JSON.stringify(this.cache.archive) === JSON.stringify(archive)) return this.cache;
    const replayed = replayDemoArchive(archive);
    this.cache = structuredClone(replayed);
    return replayed;
  }
  async load(): Promise<DemoSession | undefined> {
    const stored = await this.database.checkpoints.get('active');
    if (!stored) { this.cache = undefined; return undefined; }
    return structuredClone(this.verified(stored.archive));
  }
  /** Only explicit start/import actions replace a checkpoint; startup never resets progress. */
  async start(scenario: DemoScenario, updatedAt: string): Promise<DemoSession> {
    const replayed = createCareerDemoArchive(`demo-${crypto.randomUUID()}`, scenario, updatedAt);
    await this.database.checkpoints.put({ slot: 'active', archive: replayed.archive });
    this.cache = structuredClone(replayed);
    return structuredClone(replayed);
  }
  private async prepareUpdate(updatedAtInput: string, expectedCommandsInput: readonly DemoCommand[]) {
    assertPlainDemoData({ updatedAt: updatedAtInput, expectedCommands: expectedCommandsInput });
    const expected = parseDemoCommands(expectedCommandsInput);
    const updatedAt = parseDemoTimestamp(updatedAtInput);
    const stored = await this.database.checkpoints.get('active');
    if (!stored) throw new Error('Start a development demo before making a decision.');
    // Compare the full checkpoint: another demo can also have an empty command log.
    const base = this.cache;
    if (!base || JSON.stringify(base.archive) !== JSON.stringify(stored.archive) || JSON.stringify(expected) !== JSON.stringify(base.archive.commands)) throw new DemoConflictError();
    if (Date.parse(updatedAt) < Date.parse(base.archive.updatedAt)) throw new Error('Demo update time cannot precede the latest checkpoint.');
    return { base, stored, updatedAt };
  }
  private async writePrepared(stored: DemoCheckpoint, next: DemoSession): Promise<DemoSession> {
    assertDemoArchiveSize(next.archive);
    await this.database.transaction('rw', this.database.checkpoints, async () => {
      const current = await this.database.checkpoints.get('active');
      if (!current || JSON.stringify(current) !== JSON.stringify(stored)) throw new DemoConflictError();
      await this.database.checkpoints.put({ slot: 'active', archive: next.archive });
    });
    this.cache = structuredClone(next);
    return structuredClone(next);
  }
  async commit(commandInput: DemoCommand, updatedAtInput: string, expectedCommandsInput: readonly DemoCommand[]): Promise<DemoSession> {
    const command = parseDemoCommand(commandInput);
    const { base, stored, updatedAt } = await this.prepareUpdate(updatedAtInput, expectedCommandsInput);
    if (base.archive.commands.length >= MAX_DEMO_COMMANDS) throw new Error('Demo command log exceeds the 5,000-command limit.');
    const result = applyDemoDecision(base.state, base.finances, command);
    let archive: DemoArchive;
    if (base.archive.schemaVersion === 1) {
      if (command.type === 'RENEW_CONTRACT') throw new Error('Enable career management before renewing a demo contract.');
      archive = { ...base.archive, updatedAt, commands: [...base.archive.commands, structuredClone(command)] };
    } else archive = { ...base.archive, updatedAt, commands: [...base.archive.commands, structuredClone(command)] };
    return this.writePrepared(stored, { archive, state: result.state, finances: result.finances });
  }
  /** Explicit opt-in: keep all prior football decisions and begin finances today. */
  async enableCareer(updatedAtInput: string, expectedCommandsInput: readonly DemoCommand[]): Promise<DemoSession> {
    const { base, stored, updatedAt } = await this.prepareUpdate(updatedAtInput, expectedCommandsInput);
    if (base.archive.schemaVersion !== 1) throw new Error('Career management is already enabled for this demo.');
    const archive: DemoArchive = {
      format: base.archive.format, schemaVersion: 2,
      engineVersion: base.archive.engineVersion, matchEngineVersion: base.archive.matchEngineVersion,
      careerEngineVersion: CAREER_FINANCE_ENGINE_VERSION, id: base.archive.id,
      updatedAt, scenario: structuredClone(base.archive.scenario),
      careerStartCommandIndex: base.archive.commands.length, commands: structuredClone(base.archive.commands),
    };
    return this.writePrepared(stored, { archive, state: base.state, finances: createDemoFinances(base.state) });
  }
  async import(serialized: string): Promise<DemoSession> {
    const replayed = importDemoArchive(serialized);
    await this.database.transaction('rw', this.database.checkpoints, async () => {
      const current = await this.database.checkpoints.get('active');
      if (current?.archive.id === replayed.archive.id) {
        if (JSON.stringify(current.archive.scenario) !== JSON.stringify(replayed.archive.scenario)) throw new DemoConflictError('A demo backup cannot change the initial scenario of the same demo. Start a new demo to choose different settings.');
        if (current.archive.schemaVersion === 2 && replayed.archive.schemaVersion === 2 && current.archive.careerStartCommandIndex !== replayed.archive.careerStartCommandIndex) throw new DemoConflictError('A career backup cannot change when finances were enabled for the same demo. Restore a matching backup.');
      }
      // Explicit imports may restore an earlier v1 checkpoint. That file has no
      // finances; unlike ordinary loading, import is an intentional rollback.
      await this.database.checkpoints.put({ slot: 'active', archive: replayed.archive });
    });
    this.cache = structuredClone(replayed);
    return structuredClone(replayed);
  }
  async export(): Promise<string> {
    const stored = await this.database.checkpoints.get('active');
    if (!stored) throw new Error('Start a development demo before exporting a backup.');
    // Never refresh a private command cache behind an unchanged UI.
    if (this.cache && JSON.stringify(this.cache.archive) !== JSON.stringify(stored.archive)) throw new DemoConflictError();
    return exportDemoArchive(stored.archive);
  }
  close(): void { this.cache = undefined; this.database.close(); }
}
