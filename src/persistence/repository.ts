import Dexie, { type Table } from 'dexie';
import type { DatabaseSnapshot, GameState } from '../domain/models';
import { parseSnapshot } from '../data/schema';
import { exportSave, importSave, parseGameState, validateCareerSnapshot } from './save-format';

class TouchlineDatabase extends Dexie {
  snapshots!: Table<DatabaseSnapshot, string>;
  careers!: Table<GameState, string>;

  constructor(name: string) {
    super(name);
    // Database structure and JSON format versions are separate contracts.
    this.version(1).stores({ snapshots: 'id,createdAt', careers: 'id,databaseSnapshotId,updatedAt' });
  }
}

export class SnapshotConflictError extends Error {
  constructor(id: string) {
    super(`Starting database ${id} already exists with different contents. Give the new snapshot a new identifier.`);
    this.name = 'SnapshotConflictError';
  }
}

/** Starting snapshots are immutable; career records can change independently. */
export class TouchlineRepository {
  private readonly database: TouchlineDatabase;

  constructor(databaseName = 'touchline-local') { this.database = new TouchlineDatabase(databaseName); }

  private async writeSnapshot(snapshot: DatabaseSnapshot): Promise<void> {
    const existing = await this.database.snapshots.get(snapshot.id);
    if (existing) {
      // Parse canonical field order before comparing imported versus persisted JSON.
      if (JSON.stringify(parseSnapshot(existing)) !== JSON.stringify(snapshot)) throw new SnapshotConflictError(snapshot.id);
      return;
    }
    await this.database.snapshots.add(snapshot);
  }

  async saveSnapshot(input: DatabaseSnapshot): Promise<void> {
    const snapshot = parseSnapshot(input);
    await this.database.transaction('rw', this.database.snapshots, () => this.writeSnapshot(snapshot));
  }

  async saveCareer(input: GameState): Promise<void> {
    const career = parseGameState(input);
    await this.database.transaction('rw', this.database.snapshots, this.database.careers, async () => {
      const snapshot = await this.database.snapshots.get(career.databaseSnapshotId);
      if (!snapshot) throw new Error('Save the starting database snapshot before saving its career.');
      validateCareerSnapshot(career, parseSnapshot(snapshot));
      await this.database.careers.put(career);
    });
  }

  async save(snapshotInput: DatabaseSnapshot, careerInput: GameState): Promise<void> {
    // Validate the entire pair before starting a write transaction.
    const snapshot = parseSnapshot(snapshotInput);
    const career = parseGameState(careerInput);
    validateCareerSnapshot(career, snapshot);
    await this.database.transaction('rw', this.database.snapshots, this.database.careers, async () => {
      await this.writeSnapshot(snapshot);
      await this.database.careers.put(career);
    });
  }

  async loadSnapshot(id: string): Promise<DatabaseSnapshot | undefined> {
    const snapshot = await this.database.snapshots.get(id);
    return snapshot === undefined ? undefined : parseSnapshot(snapshot);
  }

  async loadCareer(id: string): Promise<GameState | undefined> {
    const career = await this.database.careers.get(id);
    if (career === undefined) return undefined;
    const parsed = parseGameState(career);
    const snapshot = await this.loadSnapshot(parsed.databaseSnapshotId);
    if (!snapshot) throw new Error('Career has lost its starting database snapshot. Restore a complete backup.');
    validateCareerSnapshot(parsed, snapshot);
    return parsed;
  }

  async listCareers(): Promise<GameState[]> {
    const careers = await this.database.careers.orderBy('updatedAt').reverse().toArray();
    return careers.map(parseGameState);
  }

  async exportCareer(id: string): Promise<string> {
    const career = await this.loadCareer(id);
    if (!career) throw new Error('Career was not found.');
    const snapshot = await this.loadSnapshot(career.databaseSnapshotId);
    if (!snapshot) throw new Error('Starting database was not found.');
    return exportSave(snapshot, career);
  }

  async importSave(serialized: string | unknown): Promise<GameState> {
    const envelope = importSave(serialized);
    await this.save(envelope.snapshot, envelope.career);
    return envelope.career;
  }

  close(): void { this.database.close(); }

  /** Intended for explicit local-data reset and isolated automated test cleanup. */
  async deleteDatabase(): Promise<void> { await this.database.delete(); }
}
