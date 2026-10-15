/** Synthetic data is confined to automated tests; none of these identities ship. */
import { ALL_ATTRIBUTE_PATHS, createUnknownAttributes } from '../../domain/attributes';
import type { DatabaseSnapshot, GameState, ProvenanceRecord } from '../../domain/models';

export const TEST_TIMESTAMP = '2026-07-01T12:00:00.000Z';
export const syntheticSource: ProvenanceRecord = {
  sourceId: 'synthetic-tests',
  sourceName: 'Synthetic automated test fixture',
  url: 'https://example.com/synthetic-tests',
  accessedAt: TEST_TIMESTAMP,
  sourceDate: '2026-07-01',
  externalId: 'synthetic-only',
  license: { name: 'Synthetic tests only', url: null, usageRestrictions: ['Never ship as real football data.'] },
};

export function syntheticSnapshot(assessed = false): DatabaseSnapshot {
  const attributes = createUnknownAttributes();
  const attributeAssessments: DatabaseSnapshot['players'][number]['attributeAssessments'] = {};
  if (assessed) {
    for (const group of Object.values(attributes)) for (const key of Object.keys(group)) (group as Record<string, number | null>)[key] = 10;
    for (const path of ALL_ATTRIBUTE_PATHS) attributeAssessments[path] = {
      status: 'original-estimate', confidence: 'medium', method: 'Synthetic test estimate only.', evidenceSourceIds: ['synthetic-tests'], assessedAt: TEST_TIMESTAMP,
    };
  }
  return {
    schemaVersion: 1, id: 'synthetic-snapshot-v1', name: 'Synthetic automated test snapshot', season: '2026/27', createdAt: TEST_TIMESTAMP,
    sources: [structuredClone(syntheticSource)],
    clubs: [{
      id: 'synthetic-club', name: 'Synthetic Test Club', shortName: 'STC', country: 'Synthetic test country', stadium: null, primaryColor: null,
      finances: { balance: { amountMinor: -100, currency: 'GBP' }, transferBudget: { amountMinor: 100, currency: 'GBP' }, weeklyWageBudget: { amountMinor: 100, currency: 'GBP' } },
      dataStatus: { validation: 'verified', completeness: 'partial', notes: ['Synthetic test club.'] }, provenance: [structuredClone(syntheticSource)],
    }],
    players: [{
      id: 'synthetic-player', name: 'Synthetic Test Player', dateOfBirth: '2000-02-29', nationality: ['Synthetic test country'], positions: ['ST'], preferredFoot: 'unknown', clubId: 'synthetic-club',
      attributes, attributeAssessments,
      hidden: { personality: { professionalism: null }, currentDevelopmentLevel: null, potential: null },
      dataStatus: { validation: 'verified', completeness: 'partial', notes: ['Synthetic test player.'] }, provenance: [structuredClone(syntheticSource)],
    }],
    competitions: [{ id: 'synthetic-competition', name: 'Synthetic test league', country: 'Synthetic test country', season: '2026/27', format: 'league', clubIds: ['synthetic-club'], provenance: [structuredClone(syntheticSource)] }],
    validation: { status: 'reference-only', notes: ['Synthetic automated test fixture only.'] },
  };
}

export function syntheticCareer(snapshotId = 'synthetic-snapshot-v1'): GameState {
  return {
    schemaVersion: 1, id: 'synthetic-career', databaseSnapshotId: snapshotId, createdAt: TEST_TIMESTAMP, updatedAt: TEST_TIMESTAMP,
    currentDate: '2026-07-01', managedClubId: 'synthetic-club', simulation: { seed: 123, randomState: 123, commandCount: 0 },
  };
}
