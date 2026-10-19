import Dexie, { type Table } from 'dexie';
import { applySeasonCommand, parseSeasonCommand, type SeasonCommand } from '../simulation/season';
import { createDemoArchive, assertDemoArchiveSize, exportDemoArchive, importDemoArchive, MAX_DEMO_COMMANDS, parseDemoCommands, parseDemoTimestamp, replayDemoArchive, type DemoArchive, type DemoSession } from './archive';
import type { DemoScenario } from './scenario';
import { assertPlainDemoData } from './validation';

export const DEMO_DATABASE_NAME = 'touchline-season-demo';
interface DemoCheckpoint { slot: 'active'; archive: DemoArchive }
class DemoDatabase extends Dexie {
  checkpoints!: Table<DemoCheckpoint, string>;
  constructor(name: string) {
    super(name);
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
    const replayed = createDemoArchive(`demo-${crypto.randomUUID()}`, scenario, updatedAt);
    await this.database.checkpoints.put({ slot: 'active', archive: replayed.archive });
    this.cache = structuredClone(replayed);
    return structuredClone(replayed);
  }
  async commit(commandInput: SeasonCommand, updatedAtInput: string, expectedCommandsInput: readonly SeasonCommand[]): Promise<DemoSession> {
    assertPlainDemoData({ command: commandInput, updatedAt: updatedAtInput, expectedCommands: expectedCommandsInput });
    const command = parseSeasonCommand(commandInput);
    const expected = parseDemoCommands(expectedCommandsInput);
    const updatedAt = parseDemoTimestamp(updatedAtInput);
    const stored = await this.database.checkpoints.get('active');
    if (!stored) throw new Error('Start a development demo before making a decision.');
    // Comparing the complete checkpoint also protects empty logs after another tab starts a new demo.
    const base = this.cache;
    if (!base || JSON.stringify(base.archive) !== JSON.stringify(stored.archive) || JSON.stringify(expected) !== JSON.stringify(base.archive.commands)) throw new DemoConflictError();
    if (Date.parse(updatedAt) < Date.parse(base.archive.updatedAt)) throw new Error('Demo update time cannot precede the latest checkpoint.');
    const result = applySeasonCommand(base.state, command);
    if (!result.ok) throw new Error(result.error.message);
    if (result.state.commands.length > MAX_DEMO_COMMANDS) throw new Error('Demo command log exceeds the 5,000-command limit.');
    const archive: DemoArchive = { ...base.archive, updatedAt, commands: structuredClone(result.state.commands) };
    assertDemoArchiveSize(archive);
    await this.database.transaction('rw', this.database.checkpoints, async () => {
      const current = await this.database.checkpoints.get('active');
      if (!current || JSON.stringify(current) !== JSON.stringify(stored)) throw new DemoConflictError();
      await this.database.checkpoints.put({ slot: 'active', archive });
    });
    const committed = { archive, state: result.state };
    this.cache = structuredClone(committed);
    return structuredClone(committed);
  }
  async import(serialized: string): Promise<DemoSession> {
    const replayed = importDemoArchive(serialized);
    await this.database.transaction('rw', this.database.checkpoints, async () => {
      const current = await this.database.checkpoints.get('active');
      if (current?.archive.id === replayed.archive.id && JSON.stringify(current.archive.scenario) !== JSON.stringify(replayed.archive.scenario)) throw new DemoConflictError('A demo backup cannot change the initial scenario of the same demo. Start a new demo to choose different settings.');
      await this.database.checkpoints.put({ slot: 'active', archive: replayed.archive });
    });
    this.cache = structuredClone(replayed);
    return structuredClone(replayed);
  }
  async export(): Promise<string> {
    const stored = await this.database.checkpoints.get('active');
    if (!stored) throw new Error('Start a development demo before exporting a backup.');
    // Export must not refresh the private command cache behind an unchanged UI.
    // A different demo can have the same empty log as the one still on screen.
    if (this.cache && JSON.stringify(this.cache.archive) !== JSON.stringify(stored.archive)) throw new DemoConflictError();
    return exportDemoArchive(stored.archive);
  }
  close(): void { this.cache = undefined; this.database.close(); }
}
