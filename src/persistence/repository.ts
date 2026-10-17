import Dexie, { type Table } from 'dexie';
import type { DatabaseSnapshot, GameState } from '../domain/models';
import { parseSnapshot } from '../data/schema';
import { exportSave, importSave, parseGameState, validateCareerSnapshot } from './save-format';
import { timestampSchema } from '../data/schema';
import { applySeasonCommand, parseSeasonCommand, type SeasonCommand } from '../simulation/season';
import {
  assertPlainSeasonData, assertSeasonArchiveSize, exportSeasonArchive, importSeasonArchive, parseSeasonArchiveEnvelope,
  replaySeasonArchive, seasonCommandsSchema,
  MAX_SEASON_COMMANDS,
  type SeasonArchive, type ReplayedSeasonArchive,
} from './season/archive';

class TouchlineDatabase extends Dexie {
  snapshots!: Table<DatabaseSnapshot, string>;
  careers!: Table<GameState, string>;
  seasons!: Table<SeasonArchive, string>;

  constructor(name: string) {
    super(name);
    // Database structure and JSON format versions are separate contracts.
    this.version(1).stores({ snapshots: 'id,createdAt', careers: 'id,databaseSnapshotId,updatedAt' });
    // Additive migration: existing v1 rows and portable formats remain unchanged.
    this.version(2).stores({ seasons: 'id,careerId,updatedAt' });
  }
}

export class SeasonConflictError extends Error {
  constructor(message = 'The season changed in another session. Reload it before making another decision.') { super(message); this.name = 'SeasonConflictError'; }
}
export class SeasonBoundCareerError extends Error {
  constructor() { super('This career has a season. Change its calendar through season actions, and restore its source or club using a complete season backup.'); this.name = 'SeasonBoundCareerError'; }
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
  private readonly seasonCache = new Map<string, ReplayedSeasonArchive>();

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

  private sameCareerBinding(left: GameState, right: GameState): boolean {
    return left.id === right.id && left.databaseSnapshotId === right.databaseSnapshotId && left.managedClubId === right.managedClubId && left.currentDate === right.currentDate;
  }

  private async guardBoundCareer(career: GameState): Promise<void> {
    const season = await this.database.seasons.where('careerId').equals(career.id).first();
    if (season && !this.sameCareerBinding(career, parseSeasonArchiveEnvelope(season).career)) throw new SeasonBoundCareerError();
  }

  private verifiedSeason(input: SeasonArchive): ReplayedSeasonArchive {
    const cached = this.seasonCache.get(input.id);
    if (cached && JSON.stringify(cached.archive) === JSON.stringify(input)) return cached;
    const replayed = replaySeasonArchive(input);
    // Neither archive nor state references are ever shared with callers.
    this.seasonCache.set(input.id, structuredClone(replayed));
    return this.seasonCache.get(input.id)!;
  }

  async saveSnapshot(input: DatabaseSnapshot): Promise<void> {
    const snapshot = parseSnapshot(input);
    await this.database.transaction('rw', this.database.snapshots, () => this.writeSnapshot(snapshot));
  }

  async saveCareer(input: GameState): Promise<void> {
    const career = parseGameState(input);
    await this.database.transaction('rw', this.database.snapshots, this.database.careers, this.database.seasons, async () => {
      const snapshot = await this.database.snapshots.get(career.databaseSnapshotId);
      if (!snapshot) throw new Error('Save the starting database snapshot before saving its career.');
      validateCareerSnapshot(career, parseSnapshot(snapshot));
      await this.guardBoundCareer(career);
      await this.database.careers.put(career);
    });
  }

  async save(snapshotInput: DatabaseSnapshot, careerInput: GameState): Promise<void> {
    // Validate the entire pair before starting a write transaction.
    const snapshot = parseSnapshot(snapshotInput);
    const career = parseGameState(careerInput);
    validateCareerSnapshot(career, snapshot);
    await this.database.transaction('rw', this.database.snapshots, this.database.careers, this.database.seasons, async () => {
      await this.guardBoundCareer(career);
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
    await this.guardBoundCareer(parsed);
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

  private async writeSeason(replayed: ReplayedSeasonArchive, restoring: boolean): Promise<void> {
    const { archive } = replayed;
    await this.database.transaction('rw', this.database.snapshots, this.database.careers, this.database.seasons, async () => {
      const attached = await this.database.seasons.where('careerId').equals(archive.careerId).first();
      if (attached && attached.id !== archive.id) throw new SeasonConflictError('This career already has a different season. Restore its matching season backup.');
      const existing = await this.database.seasons.get(archive.id);
      const liveCareer = await this.database.careers.get(archive.careerId);
      if (existing) {
        const previous = parseSeasonArchiveEnvelope(existing);
        if (previous.careerId !== archive.careerId || previous.snapshot.id !== archive.snapshot.id || JSON.stringify(previous.initialConfig) !== JSON.stringify(archive.initialConfig) || JSON.stringify(previous.rosterManifest) !== JSON.stringify(archive.rosterManifest)) throw new SeasonConflictError('A stored season cannot acquire a different career, source snapshot, roster review or initial configuration.');
        if (!restoring && (archive.commands.length < previous.commands.length || JSON.stringify(archive.commands.slice(0, previous.commands.length)) !== JSON.stringify(previous.commands))) throw new SeasonConflictError('Season saves must append to the accepted command log. Use an explicit season import to restore an earlier backup.');
        if (!restoring && (!liveCareer || !this.sameCareerBinding(parseGameState(liveCareer), previous.career))) throw new SeasonBoundCareerError();
      } else if (!restoring) {
        if (!liveCareer) throw new Error('Create and save the career before starting its season.');
        const current = parseGameState(liveCareer);
        const startDate = current.currentDate > archive.rosterManifest.asOfDate ? current.currentDate : archive.rosterManifest.asOfDate;
        if (current.managedClubId !== archive.career.managedClubId || startDate !== archive.initialConfig.startDate) throw new SeasonConflictError('A new season must begin on the later of the career date and reviewed roster cutoff, with the same managed club.');
      }
      await this.writeSnapshot(archive.snapshot);
      await this.database.careers.put(archive.career);
      await this.database.seasons.put(archive);
    });
    this.seasonCache.set(archive.id, structuredClone(replayed));
  }

  /** Untrusted initial or bulk saves are fully replayed before entering a transaction. */
  async saveSeason(input: SeasonArchive): Promise<void> {
    const replayed = replaySeasonArchive(input);
    await this.writeSeason(replayed, false);
  }

  async loadSeason(id: string): Promise<ReplayedSeasonArchive | undefined> {
    // Read a coherent pair while keeping any cold replay outside the transaction.
    const { stored, liveCareer } = await this.database.transaction('r', this.database.seasons, this.database.careers, async () => {
      const stored = await this.database.seasons.get(id);
      return { stored, liveCareer: stored ? await this.database.careers.get(stored.careerId) : undefined };
    });
    if (!stored) return undefined;
    const replayed = this.verifiedSeason(stored);
    if (!liveCareer) throw new SeasonBoundCareerError();
    const career = parseGameState(liveCareer);
    if (!this.sameCareerBinding(career, replayed.archive.career)) throw new SeasonBoundCareerError();
    // Legacy metadata-only writes are allowed. Backups must carry that exact live
    // career without replacing the verified command/state cache or replay config.
    return structuredClone({ ...replayed, archive: { ...replayed.archive, career, updatedAt: new Date(career.updatedAt).toISOString() } });
  }

  async loadSeasonByCareer(careerId: string): Promise<ReplayedSeasonArchive | undefined> {
    const stored = await this.database.seasons.where('careerId').equals(careerId).first();
    return stored ? this.loadSeason(stored.id) : undefined;
  }

  /** Apply once to verified state, then reject a stale UI decision or concurrent disk write. */
  async commitSeasonCommand(id: string, commandInput: SeasonCommand, updatedAtInput: string, expectedCommands: readonly SeasonCommand[]): Promise<ReplayedSeasonArchive> {
    assertPlainSeasonData({ command: commandInput, expectedCommands, updatedAt: updatedAtInput });
    const expected = seasonCommandsSchema.parse(expectedCommands).map(command => parseSeasonCommand(command));
    const command = parseSeasonCommand(commandInput);
    const updatedAt = new Date(timestampSchema.parse(updatedAtInput)).toISOString();
    const stored = await this.database.seasons.get(id);
    if (!stored) throw new Error('Season was not found.');
    if (JSON.stringify(stored.commands) !== JSON.stringify(expected)) throw new SeasonConflictError();
    const base = this.verifiedSeason(stored);
    const result = applySeasonCommand(base.state, command);
    if (!result.ok) throw new Error(result.error.message);
    if (result.state.commands.length > MAX_SEASON_COMMANDS) throw new Error('Season command log exceeds the 5,000-command limit.');
    let committed!: ReplayedSeasonArchive;
    await this.database.transaction('rw', this.database.careers, this.database.seasons, async () => {
      const current = await this.database.seasons.get(id);
      if (!current || JSON.stringify(current) !== JSON.stringify(stored)) throw new SeasonConflictError();
      const live = await this.database.careers.get(base.archive.careerId);
      if (!live || !this.sameCareerBinding(parseGameState(live), base.archive.career)) throw new SeasonBoundCareerError();
      if (Date.parse(updatedAt) < Date.parse(live.updatedAt)) throw new Error('Season update time cannot precede the latest career update.');
      const career = parseGameState({ ...live, currentDate: result.state.currentDate, updatedAt });
      const archive: SeasonArchive = { ...base.archive, updatedAt, career, commands: structuredClone(result.state.commands) };
      assertSeasonArchiveSize(archive);
      await this.database.careers.put(career);
      await this.database.seasons.put(archive);
      committed = { archive, state: result.state };
    });
    this.seasonCache.set(id, structuredClone(committed));
    return structuredClone(committed);
  }

  async importSeason(serialized: string): Promise<ReplayedSeasonArchive> {
    const replayed = importSeasonArchive(serialized);
    await this.writeSeason(replayed, true);
    return structuredClone(replayed);
  }

  async exportSeason(id: string): Promise<string> {
    const replayed = await this.loadSeason(id);
    if (!replayed) throw new Error('Season was not found.');
    return exportSeasonArchive(replayed.archive);
  }

  async exportSeasonByCareer(careerId: string): Promise<string> {
    const replayed = await this.loadSeasonByCareer(careerId);
    if (!replayed) throw new Error('This career does not have a season.');
    return exportSeasonArchive(replayed.archive);
  }

  close(): void { this.seasonCache.clear(); this.database.close(); }

  /** Intended for explicit local-data reset and isolated automated test cleanup. */
  async deleteDatabase(): Promise<void> { this.seasonCache.clear(); await this.database.delete(); }
}
