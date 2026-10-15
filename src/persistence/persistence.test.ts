import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VersionCompatibilityError } from '../data/schema';
import { syntheticCareer, syntheticSnapshot, TEST_TIMESTAMP } from '../data/__tests__/fixtures';
import { createCareer, exportSave, importSave, parseGameState } from './save-format';
import { SnapshotConflictError, TouchlineRepository } from './repository';

let sequence = 0;
let repository: TouchlineRepository;
beforeEach(() => { repository = new TouchlineRepository(`touchline-synthetic-test-${sequence++}`); });
afterEach(async () => { await repository.deleteDatabase(); });

describe('versioned local careers and portable backup', () => {
  it('persists the immutable starting snapshot separately from a career', async () => {
    const snapshot = syntheticSnapshot();
    const career = syntheticCareer();
    await repository.save(snapshot, career);
    expect(await repository.loadSnapshot(snapshot.id)).toEqual(snapshot);
    expect(await repository.loadCareer(career.id)).toEqual(career);
    await repository.saveCareer({ ...career, currentDate: '2026-07-02', updatedAt: '2026-07-02T12:00:00.000Z', simulation: { ...career.simulation, commandCount: 1 } });
    expect((await repository.loadCareer(career.id))!.currentDate).toBe('2026-07-02');
    expect(await repository.loadSnapshot(snapshot.id)).toEqual(snapshot);
  });

  it('exports, validates and restores a full save including hidden simulation data', async () => {
    const snapshot = syntheticSnapshot(true);
    snapshot.players[0]!.hidden = { personality: { professionalism: 12 }, currentDevelopmentLevel: 10, potential: 15 };
    const career = syntheticCareer();
    const exported = exportSave(snapshot, career);
    const parsed = importSave(exported);
    expect(parsed.snapshot).toEqual(snapshot);
    expect(parsed.career).toEqual(career);
    expect(await repository.importSave(exported)).toEqual(career);
    expect(importSave(await repository.exportCareer(career.id)).snapshot.players[0]!.hidden.potential).toBe(15);
    expect(await repository.listCareers()).toEqual([career]);
  });

  it('refuses corrupted, incompatible and cross-linked saves without modifying existing storage', async () => {
    const snapshot = syntheticSnapshot();
    const career = syntheticCareer();
    await repository.save(snapshot, career);
    const envelope = importSave(exportSave(snapshot, career));
    for (const invalid of [
      '{broken',
      { ...envelope, schemaVersion: 999 },
      { ...envelope, snapshot: { ...snapshot, schemaVersion: 999 } },
      { ...envelope, career: { ...career, databaseSnapshotId: 'missing-snapshot' } },
      { ...envelope, career: { ...career, managedClubId: 'missing-club' } },
      { ...envelope, career: { ...career, simulation: { ...career.simulation, randomState: 0 } } },
    ]) {
      await expect(repository.importSave(invalid)).rejects.toThrow();
      expect(await repository.loadCareer(career.id)).toEqual(career);
      expect(await repository.loadSnapshot(snapshot.id)).toEqual(snapshot);
    }
  });

  it('rejects snapshot identifier collisions atomically, while equal snapshots are reusable', async () => {
    const snapshot = syntheticSnapshot();
    const career = syntheticCareer();
    await repository.save(snapshot, career);
    await repository.saveSnapshot(structuredClone(snapshot));
    const conflictingSnapshot = { ...snapshot, name: 'Different content with the same snapshot ID' };
    const changedCareer = { ...career, currentDate: '2026-07-20' };
    await expect(repository.save(conflictingSnapshot, changedCareer)).rejects.toThrow(SnapshotConflictError);
    expect(await repository.loadSnapshot(snapshot.id)).toEqual(snapshot);
    expect(await repository.loadCareer(career.id)).toEqual(career);
  });

  it('does not save a career until its referenced snapshot exists', async () => {
    await expect(repository.saveCareer(syntheticCareer())).rejects.toThrow(/starting database/);
    expect(await repository.listCareers()).toEqual([]);
  });

  it('creates a selected career with a valid normalized zero-seed random state', () => {
    const career = createCareer(syntheticSnapshot(), 'synthetic-club', 0);
    expect(career).toMatchObject({ managedClubId: 'synthetic-club', currentDate: '2026-07-01', simulation: { seed: 0, commandCount: 1 } });
    expect(career.simulation.randomState).not.toBe(0);
    expect(() => createCareer(syntheticSnapshot(), 'missing-club', 1)).toThrow(/Choose/);
    expect(() => createCareer(syntheticSnapshot(), 'synthetic-club', 1.5)).toThrow();
  });

  it('validates dates, finite counters and unsupported old or future versions clearly', () => {
    const career = syntheticCareer();
    expect(() => parseGameState({ ...career, updatedAt: '2026-06-30T00:00:00.000Z' })).toThrow(/before/);
    expect(() => parseGameState({ ...career, currentDate: '2026-02-30' })).toThrow(/calendar/);
    expect(() => parseGameState({ ...career, simulation: { seed: Infinity, randomState: 1, commandCount: 0 } })).toThrow();
    const envelope = { format: 'touchline-save', schemaVersion: 1, exportedAt: TEST_TIMESTAMP, snapshot: syntheticSnapshot(), career };
    expect(() => importSave({ ...envelope, schemaVersion: 0 })).toThrow(VersionCompatibilityError);
    expect(() => importSave({ ...envelope, schemaVersion: 2 })).toThrow(/compatible application version/);
    expect(() => importSave({ ...envelope, schemaVersion: 0 })).toThrow(/no migration/);
  });
});
