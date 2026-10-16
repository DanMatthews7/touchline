import Dexie, { type Table } from 'dexie';
import {
  exportMatchArchive, importMatchArchive, replayMatchArchive,
  type MatchArchive, type ReplayedMatchArchive,
} from './archive';

/** This database never upgrades or modifies the existing v1 career database. */
class MatchSessionDatabase extends Dexie {
  sessions!: Table<MatchArchive, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ sessions: 'id,updatedAt' });
  }
}

export class MatchSessionConflictError extends Error {
  constructor(id: string) {
    super(`Match session ${id} already exists with a different initial configuration. Start the new match with a new session identifier.`);
    this.name = 'MatchSessionConflictError';
  }
}

/** Match progress consists of an immutable scenario plus accepted replayable commands. */
export class MatchSessionRepository {
  private readonly database: MatchSessionDatabase;

  constructor(databaseName = 'touchline-match-sessions') { this.database = new MatchSessionDatabase(databaseName); }

  async save(input: MatchArchive): Promise<void> {
    // Replay everything before starting a transaction: malformed input cannot alter
    // either the current session or any existing career data.
    const { archive } = replayMatchArchive(input);
    await this.database.transaction('rw', this.database.sessions, async () => {
      const existing = await this.database.sessions.get(archive.id);
      if (existing) {
        const validated = replayMatchArchive(existing).archive;
        if (JSON.stringify(validated.config) !== JSON.stringify(archive.config)) throw new MatchSessionConflictError(archive.id);
      }
      await this.database.sessions.put(archive);
    });
  }

  async load(id: string): Promise<ReplayedMatchArchive | undefined> {
    const archive = await this.database.sessions.get(id);
    return archive === undefined ? undefined : replayMatchArchive(archive);
  }

  async loadLatest(): Promise<ReplayedMatchArchive | undefined> {
    const archive = await this.database.sessions.orderBy('updatedAt').reverse().first();
    return archive === undefined ? undefined : replayMatchArchive(archive);
  }

  async list(): Promise<MatchArchive[]> {
    const archives = await this.database.sessions.orderBy('updatedAt').reverse().toArray();
    return archives.map(archive => replayMatchArchive(archive).archive);
  }

  async import(serialized: string): Promise<ReplayedMatchArchive> {
    const replayed = importMatchArchive(serialized);
    await this.save(replayed.archive);
    return replayed;
  }

  async export(id: string): Promise<string> {
    const replayed = await this.load(id);
    if (!replayed) throw new Error('Match session was not found.');
    return exportMatchArchive(replayed.archive);
  }

  close(): void { this.database.close(); }
  /** Explicit match-only local reset; career data belongs to another database. */
  async deleteDatabase(): Promise<void> { await this.database.delete(); }
}
