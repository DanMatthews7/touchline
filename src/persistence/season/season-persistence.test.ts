import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VersionCompatibilityError } from '../../data/schema';
import { TouchlineRepository, SeasonBoundCareerError, SeasonConflictError } from '../repository';
import { exportSave, importSave } from '../save-format';
import { createSeasonArchive, exportSeasonArchive, importSeasonArchive, replaySeasonArchive, MAX_SEASON_ARCHIVE_BYTES, MAX_SEASON_COMMANDS } from './archive';
import { syntheticSeasonInputs, SEASON_TEST_TIMESTAMP } from './__tests__/fixtures';
import * as seasonEngine from '../../simulation/season';
import type { SeasonCommand } from '../../simulation/season';

let sequence = 0;
let databaseName: string;
let repository: TouchlineRepository;
beforeEach(() => { databaseName = `touchline-season-synthetic-${sequence++}`; repository = new TouchlineRepository(databaseName); });
afterEach(async () => { vi.restoreAllMocks(); await repository.deleteDatabase(); });

function initial() {
  const { snapshot, career, config, rosterManifest } = syntheticSeasonInputs();
  return { snapshot, career, config, archive: createSeasonArchive(config.id, snapshot, career, config, [], SEASON_TEST_TIMESTAMP, rosterManifest) };
}
async function seed() {
  const input = initial();
  await repository.save(input.snapshot, input.career);
  await repository.saveSeason(input.archive);
  return input;
}

describe('career-bound season archives and additive persistence', () => {
  it('atomically advances the career and restores an in-progress managed match by replay', async () => {
    const { archive } = await seed();
    let saved = await repository.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:01:00.000Z', []);
    expect(saved.archive.career.currentDate).toBe('2026-10-17');
    expect((await repository.loadCareer(archive.careerId))!.currentDate).toBe(saved.state.currentDate);
    saved = await repository.commitSeasonCommand(archive.id, { type: 'START_MATCH' }, '2026-10-16T12:02:00.000Z', saved.archive.commands);
    saved = await repository.commitSeasonCommand(archive.id, { type: 'MATCH_COMMAND', command: { type: 'ADVANCE' } }, '2026-10-16T12:03:00.000Z', saved.archive.commands);
    expect(saved.state.activeMatch!.state.minute).toBe(15);
    const exported = await repository.exportSeasonByCareer(archive.careerId);
    expect(importSeasonArchive(exported)).toEqual(saved);
    repository.close();
    repository = new TouchlineRepository(databaseName);
    expect(await repository.loadSeasonByCareer(archive.careerId)).toEqual(saved);
    const restoredRepository = new TouchlineRepository(`${databaseName}-restore`);
    try {
      expect(await restoredRepository.importSeason(exported)).toEqual(saved);
      expect(await restoredRepository.loadCareer(archive.careerId)).toEqual(saved.archive.career);
      expect(await restoredRepository.loadSnapshot(archive.snapshot.id)).toEqual(archive.snapshot);
    } finally { await restoredRepository.deleteDatabase(); }
  });

  it('rejects stale decisions from another tab and cannot advance a round twice', async () => {
    const { archive } = await seed();
    const other = new TouchlineRepository(databaseName);
    try {
      const outcomes = await Promise.allSettled([
        repository.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:01:00.000Z', []),
        other.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:01:00.000Z', []),
      ]);
      expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);
      expect((await repository.loadSeason(archive.id))!.archive.commands).toEqual([{ type: 'ADVANCE_CALENDAR' }]);
      await expect(repository.commitSeasonCommand(archive.id, { type: 'START_MATCH' }, '2026-10-16T12:02:00.000Z', [])).rejects.toThrow(SeasonConflictError);
    } finally { other.close(); }
  });

  it('keeps its verified cache private from mutated caller state', async () => {
    const { archive } = await seed();
    const loaded = (await repository.loadSeason(archive.id))!;
    loaded.state.config.teams[0]!.name = 'Caller forgery';
    loaded.state.results.push({ fixtureId: 'forged', round: 1, status: 'finished', summary: { score: { home: 99, away: 0 }, stats: {} as never } });
    const next = await repository.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:01:00.000Z', []);
    expect(next.state.config.teams[0]!.name).toBe(archive.initialConfig.teams[0]!.name);
    expect(next.state.results).toEqual([]);
  });

  it('applies normal decisions incrementally without replaying previous fixtures', async () => {
    const { archive } = await seed();
    const replay = vi.spyOn(seasonEngine, 'replaySeason');
    const first = await repository.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:01:00.000Z', []);
    await repository.commitSeasonCommand(archive.id, { type: 'START_MATCH' }, '2026-10-16T12:02:00.000Z', first.archive.commands);
    expect(replay).not.toHaveBeenCalled();
  });

  it('commits exactly ten authoritative results and rejects completing the same round again', async () => {
    const { archive } = await seed();
    let saved = (await repository.loadSeason(archive.id))!;
    let minute = 0;
    const issue = async (command: SeasonCommand) => {
      saved = await repository.commitSeasonCommand(archive.id, command, `2026-10-16T12:${String(++minute).padStart(2, '0')}:00.000Z`, saved.archive.commands);
    };
    await issue({ type: 'ADVANCE_CALENDAR' });
    await issue({ type: 'START_MATCH' });
    for (let count = 0; saved.state.roundIndex === 0 && count < 45; count++) {
      if (saved.state.status === 'playing') await issue({ type: 'MATCH_COMMAND', command: { type: 'ADVANCE' } });
      else if (saved.state.status === 'round-ready') await issue({ type: 'COMPLETE_ROUND' });
      else if (saved.state.status === 'blocked') await issue({ type: 'REPLAY_ABANDONED' });
      else throw new Error(`Unexpected synthetic round state ${saved.state.status}.`);
    }
    expect(saved.state.roundIndex).toBe(1);
    expect(saved.state.results).toHaveLength(10);
    expect(new Set(saved.state.results.map(result => result.fixtureId)).size).toBe(10);
    const previous = structuredClone(saved);
    await expect(issue({ type: 'COMPLETE_ROUND' })).rejects.toThrow();
    expect(await repository.loadSeason(archive.id)).toEqual(previous);
    expect((await repository.loadCareer(archive.careerId))!.currentDate).toBe(saved.state.currentDate);
  });

  it('rolls back career and season together if the final IndexedDB write fails', async () => {
    const { archive } = await seed();
    const internal = repository as unknown as { database: { seasons: { put: (...args: unknown[]) => Promise<unknown> } } };
    const failure = vi.spyOn(internal.database.seasons, 'put').mockRejectedValueOnce(new Error('Synthetic storage failure'));
    await expect(repository.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:01:00.000Z', [])).rejects.toThrow(/storage failure/);
    failure.mockRestore();
    expect((await repository.loadCareer(archive.careerId))!.currentDate).toBe(archive.career.currentDate);
    expect((await repository.loadSeason(archive.id))!.archive.commands).toEqual([]);
    const retried = await repository.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:01:00.000Z', []);
    expect(retried.state.currentDate).toBe('2026-10-17');
  });

  it('blocks legacy date/source/club changes under a season while allowing metadata updates', async () => {
    const { archive } = await seed();
    const progressed = await repository.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:01:00.000Z', []);
    await expect(repository.importSave(exportSave(archive.snapshot, archive.career))).rejects.toThrow(SeasonBoundCareerError);
    await expect(repository.saveCareer({ ...progressed.archive.career, managedClubId: archive.snapshot.clubs[1]!.id })).rejects.toThrow(SeasonBoundCareerError);
    const revisedSnapshot = { ...archive.snapshot, id: 'synthetic-unapproved-source-change' };
    await expect(repository.save(revisedSnapshot, { ...progressed.archive.career, databaseSnapshotId: revisedSnapshot.id })).rejects.toThrow(SeasonBoundCareerError);
    expect(await repository.loadSnapshot(revisedSnapshot.id)).toBeUndefined();
    await repository.saveCareer({ ...progressed.archive.career, updatedAt: '2026-10-16T12:02:00.000Z' });
    const next = await repository.commitSeasonCommand(archive.id, { type: 'START_MATCH' }, '2026-10-16T12:03:00.000Z', progressed.archive.commands);
    expect(next.archive.career.createdAt).toBe(archive.career.createdAt);
    expect(importSave(await repository.exportCareer(archive.careerId)).format).toBe('touchline-save');
  });

  it('exports and restores live career metadata changed between season commands', async () => {
    const { archive } = await seed();
    const metadata = { ...archive.career, updatedAt: '2026-10-16T12:02:00.000Z', simulation: { ...archive.career.simulation, commandCount: 7 } };
    await repository.saveCareer(metadata);
    const loaded = (await repository.loadSeason(archive.id))!;
    expect(loaded.archive.career).toEqual(metadata);
    expect(loaded.archive.updatedAt).toBe(metadata.updatedAt);
    expect(loaded.archive.initialConfig).toEqual(archive.initialConfig);
    expect(loaded.archive.commands).toEqual([]);
    const exported = await repository.exportSeason(archive.id);
    expect(importSeasonArchive(exported).archive.career).toEqual(metadata);
    const restored = new TouchlineRepository(`${databaseName}-metadata-restore`);
    try {
      await restored.importSeason(exported);
      expect(await restored.loadCareer(metadata.id)).toEqual(metadata);
    } finally { await restored.deleteDatabase(); }
    const replay = vi.spyOn(seasonEngine, 'replaySeason');
    const next = await repository.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:03:00.000Z', []);
    expect(next.archive.career.simulation.commandCount).toBe(7);
    expect(replay).not.toHaveBeenCalled();
  });

  it('only permits rollback through an explicit fully validated season restore', async () => {
    const { archive } = await seed();
    await repository.commitSeasonCommand(archive.id, { type: 'ADVANCE_CALENDAR' }, '2026-10-16T12:01:00.000Z', []);
    await expect(repository.saveSeason(archive)).rejects.toThrow(SeasonConflictError);
    const restored = await repository.importSeason(exportSeasonArchive(archive));
    expect(restored.archive.career.currentDate).toBe(archive.career.currentDate);
    expect((await repository.loadCareer(archive.careerId))!.currentDate).toBe(archive.career.currentDate);
    expect((await repository.loadSeason(archive.id))!.archive.commands).toEqual([]);
  });

  it('rejects future versions, forged results and inconsistent dates without changing valid storage', async () => {
    const { archive } = await seed();
    const badDate = structuredClone(archive); badDate.career.currentDate = '2026-10-18';
    for (const invalid of [
      { ...archive, schemaVersion: 2 }, { ...archive, engineVersion: 2 }, { ...archive, matchEngineVersion: 2 },
      { ...archive, initialConfig: { ...archive.initialConfig, engineVersion: 2 } },
      { ...archive, results: [{ score: { home: 99, away: 0 } }] }, badDate,
      { ...archive, commands: [{ type: 'COMPLETE_ROUND' }] },
      { ...archive, careerId: 'unrelated-career' },
      { ...archive, rosterManifest: { ...archive.rosterManifest, schemaVersion: 2 } },
    ]) {
      await expect(repository.importSeason(JSON.stringify(invalid))).rejects.toThrow();
      expect((await repository.loadSeason(archive.id))!.archive).toEqual(archive);
      expect(await repository.loadCareer(archive.careerId)).toEqual(archive.career);
    }
    expect(() => replaySeasonArchive({ ...archive, engineVersion: 0 })).toThrow(VersionCompatibilityError);
  });

  it('requires sourced verified affiliations and preserves source identities and assessment inputs', () => {
    const { archive } = initial();
    for (const patch of ['snapshot-status', 'player-status', 'affiliation', 'identity', 'position', 'rating'] as const) {
      const invalid = structuredClone(archive);
      if (patch === 'snapshot-status') invalid.snapshot.validation.status = 'reference-only';
      if (patch === 'player-status') invalid.snapshot.players[0]!.dataStatus.validation = 'needs-review';
      if (patch === 'affiliation') invalid.snapshot.players[0]!.clubId = invalid.snapshot.clubs[1]!.id;
      if (patch === 'identity') invalid.initialConfig.teams[0]!.players[0]!.name = 'A different identity';
      if (patch === 'position') invalid.initialConfig.teams[0]!.players[0]!.positions = [];
      if (patch === 'rating') invalid.initialConfig.teams[0]!.players[0]!.attributes.technical.passing = 11;
      expect(() => replaySeasonArchive(invalid)).toThrow();
    }
  });

  it('requires the complete dated roster and reuse-rights review on import, beyond verification flags', () => {
    const { archive } = initial();
    for (const patch of ['missing', 'rights', 'capture', 'under21', 'review', 'cutoff'] as const) {
      const invalid = structuredClone(archive);
      if (patch === 'missing') delete (invalid as unknown as Record<string, unknown>).rosterManifest;
      if (patch === 'rights') invalid.rosterManifest.evidence[0]!.rightsReview.status = 'unreviewed';
      if (patch === 'capture') invalid.rosterManifest.evidence[0]!.capture.contentSha256 = 'not-a-valid-capture-hash';
      if (patch === 'under21') invalid.rosterManifest.clubs[0]!.under21Handling = 'unreviewed';
      if (patch === 'review') invalid.rosterManifest.evidence[0]!.review.checkedAgainstCapturedSource = false;
      if (patch === 'cutoff') invalid.initialConfig.startDate = '2026-10-15';
      expect(() => replaySeasonArchive(invalid)).toThrow();
    }
  });

  it('rejects non-JSON executable data and bounded malformed imports without running getters', () => {
    const { archive } = initial();
    let executed = false;
    Object.defineProperty(archive, 'engineVersion', { enumerable: true, get() { executed = true; return 1; } });
    expect(() => replaySeasonArchive(archive)).toThrow(/accessors/);
    expect(executed).toBe(false);
    expect(() => importSeasonArchive('{broken')).toThrow(/valid JSON/);
    expect(() => importSeasonArchive(' '.repeat(MAX_SEASON_ARCHIVE_BYTES + 1))).toThrow(/16 MiB/);
    const clean = initial().archive;
    expect(() => replaySeasonArchive({ ...clean, commands: Array.from({ length: MAX_SEASON_COMMANDS + 1 }, () => ({ type: 'START_MATCH' })) })).toThrow();
  });

  it('upgrades an existing Dexie v1 database additively without changing its career export', async () => {
    repository.close();
    const legacy = new Dexie(databaseName);
    legacy.version(1).stores({ snapshots: 'id,createdAt', careers: 'id,databaseSnapshotId,updatedAt' });
    const { snapshot, career } = syntheticSeasonInputs();
    await legacy.table('snapshots').add(snapshot);
    await legacy.table('careers').add(career);
    legacy.close();
    repository = new TouchlineRepository(databaseName);
    const exported = importSave(await repository.exportCareer(career.id));
    expect(exported.snapshot).toEqual(snapshot);
    expect(exported.career).toEqual(career);
    expect(exported.schemaVersion).toBe(1);
    expect(await repository.loadSeasonByCareer(career.id)).toBeUndefined();
    await repository.importSave(exportSave(snapshot, career));
    expect(await repository.loadCareer(career.id)).toEqual(career);
  });

  it('binds an older career to a new reviewed source and cutoff in one initial transaction', async () => {
    const { snapshot, config, rosterManifest, career } = syntheticSeasonInputs();
    const previousSnapshot = { ...snapshot, id: 'synthetic-pre-season-source' };
    const previousCareer = { ...career, databaseSnapshotId: previousSnapshot.id, currentDate: '2026-07-01', createdAt: '2026-07-01T12:00:00.000Z', updatedAt: '2026-07-01T12:00:00.000Z' };
    await repository.save(previousSnapshot, previousCareer);
    const archive = createSeasonArchive(config.id, snapshot, { ...previousCareer, databaseSnapshotId: snapshot.id }, config, [], SEASON_TEST_TIMESTAMP, rosterManifest);
    const internal = repository as unknown as { database: { seasons: { put: (...args: unknown[]) => Promise<unknown> } } };
    const failure = vi.spyOn(internal.database.seasons, 'put').mockRejectedValueOnce(new Error('Synthetic first-bind failure'));
    await expect(repository.saveSeason(archive)).rejects.toThrow(/first-bind/);
    failure.mockRestore();
    expect(await repository.loadCareer(career.id)).toEqual(previousCareer);
    expect(await repository.loadSnapshot(snapshot.id)).toBeUndefined();
    expect(await repository.loadSeasonByCareer(career.id)).toBeUndefined();
    await repository.saveSeason(archive);
    expect((await repository.loadCareer(career.id))!.currentDate).toBe(rosterManifest.asOfDate);
    expect((await repository.loadCareer(career.id))!.databaseSnapshotId).toBe(snapshot.id);
    expect(await repository.loadSnapshot(previousSnapshot.id)).toEqual(previousSnapshot);
  });
});
