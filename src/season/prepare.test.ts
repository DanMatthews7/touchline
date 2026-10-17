/** SYNTHETIC AUTOMATED TESTS ONLY; no real squad verification is asserted. */
import { describe, expect, it } from 'vitest';
import { createEditorialAssessment } from '../data';
import { syntheticSeasonInputs, SEASON_TEST_TIMESTAMP } from '../persistence/season/__tests__/fixtures';
import { prepareSeason, type PrepareSeasonOptions } from './prepare';
import { importCurrentSquadDataset } from './dataset';

function inputs() {
  const fixture = syntheticSeasonInputs();
  const options: PrepareSeasonOptions = {
    id: 'prepared-season', snapshotId: 'prepared-source', updatedAt: SEASON_TEST_TIMESTAMP,
    name: 'SYNTHETIC AUTOMATED TEST SEASON', firstMatchDate: '2026-10-17', seed: 777,
    clubIds: fixture.snapshot.clubs.map(club => club.id), useUniformEstimates: true,
    initialCondition: 100, initialMorale: 70, homeAdvantage: true,
  };
  return { ...fixture, options };
}

describe('verified squad preparation and dataset boundary', () => {
  it('selects match squads only within reviewed source affiliations and leaves source input unchanged', () => {
    const { snapshot, career, rosterManifest, options } = inputs();
    const original = structuredClone(snapshot);
    const prepared = prepareSeason(snapshot, snapshot, career, rosterManifest, options);
    expect(snapshot).toEqual(original);
    expect(prepared.config.teams).toHaveLength(20);
    for (const team of prepared.config.teams) {
      expect(team.players.length).toBeGreaterThanOrEqual(11);
      expect(team.players.length).toBeLessThanOrEqual(20);
      expect(team.players.every(player => original.players.find(item => item.id === player.id)?.clubId === team.id)).toBe(true);
      expect(team.players.every(player => Object.values(player.attributes).every(group => Object.values(group).every(value => value === 10)))).toBe(true);
    }
    expect(prepared.manifest.sourceSnapshotId).toBe(prepared.snapshot.id);
    expect(prepared.snapshot.players.every(player => Object.values(player.attributes).every(group => Object.values(group).every(value => value === null)))).toBe(true);
  });

  it('retains editorial ability while using the newly reviewed club affiliation and calendar cutoff', () => {
    const { snapshot, career, rosterManifest, options } = inputs();
    const previous = structuredClone(snapshot);
    previous.id = 'previous-source';
    const old = previous.players[1]!;
    const reviewedClubId = snapshot.players[1]!.clubId;
    old.clubId = snapshot.clubs[1]!.id;
    old.attributes.technical.finishing = 18;
    old.attributeAssessments['technical.finishing'] = createEditorialAssessment({
      confidence: 'low', method: 'SYNTHETIC AUTOMATED TEST estimate only.',
      evidenceSourceIds: [previous.sources[0]!.sourceId], assessedAt: SEASON_TEST_TIMESTAMP,
    });
    const prepared = prepareSeason(snapshot, previous, { ...career, databaseSnapshotId: previous.id, currentDate: '2026-07-01' }, rosterManifest, options);
    expect(prepared.snapshot.players.find(player => player.id === old.id)?.clubId).toBe(reviewedClubId);
    expect(prepared.snapshot.players.find(player => player.id === old.id)?.attributes.technical.finishing).toBe(18);
    expect(prepared.config.teams.find(team => team.id === reviewedClubId)?.players.find(player => player.id === old.id)?.attributes.technical.finishing).toBe(18);
    expect(prepared.config.startDate).toBe('2026-10-16');
    expect(prepared.career.currentDate).toBe('2026-10-16');
    expect(old.clubId).toBe(snapshot.clubs[1]!.id);
  });

  it('requires dated roster evidence independently of the opt-in ability baseline', () => {
    const { snapshot, career, rosterManifest, options } = inputs();
    expect(() => prepareSeason(snapshot, snapshot, career, rosterManifest, { ...options, useUniformEstimates: false })).toThrow('unassessed');
    const broken = structuredClone(rosterManifest);
    broken.asOfDate = '2025-10-16';
    expect(() => prepareSeason(snapshot, snapshot, career, broken, options)).toThrow();
    const envelope = { format: 'touchline-squad-dataset', schemaVersion: 1, snapshot, manifest: rosterManifest };
    expect(importCurrentSquadDataset(JSON.stringify(envelope)).snapshot.id).toBe(snapshot.id);
    expect(() => importCurrentSquadDataset('{bad')).toThrow('not valid JSON');
    expect(() => importCurrentSquadDataset(JSON.stringify({ ...envelope, schemaVersion: 2 }))).toThrow();
    expect(() => importCurrentSquadDataset(JSON.stringify({ ...envelope, manifest: broken }))).toThrow();
  });
});
