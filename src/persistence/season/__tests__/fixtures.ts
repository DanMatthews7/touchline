/** SYNTHETIC AUTOMATED TESTS ONLY. These identities and affiliations never ship. */
import { createUnknownAttributes } from '../../../domain/attributes';
import type { DatabaseSnapshot, GameState } from '../../../domain/models';
import type { SeasonConfig } from '../../../simulation/season';
import { syntheticMatchTeam } from '../../../simulation/__tests__/match-fixtures';
import { syntheticSource, TEST_TIMESTAMP } from '../../../data/__tests__/fixtures';
import type { CurrentSquadManifest } from '../../../season/rosters';

export const SEASON_TEST_TIMESTAMP = '2026-10-16T12:00:00.000Z';

/** Adds invented evidence to an invented test snapshot only; never use on real data. */
export function syntheticCurrentSquadManifest(snapshot: DatabaseSnapshot): CurrentSquadManifest {
  const provenance = {
    ...structuredClone(syntheticSource), accessedAt: SEASON_TEST_TIMESTAMP, sourceDate: '2026-10-16',
    externalId: 'synthetic-externally-reviewed-test-record',
  };
  snapshot.sources = [{ ...structuredClone(provenance), externalId: null }];
  for (const club of snapshot.clubs) { club.country = 'England'; club.provenance = [{ ...structuredClone(provenance), externalId: `synthetic-club-record:${club.id}` }]; }
  for (const player of snapshot.players) player.provenance = [{ ...structuredClone(provenance), externalId: `synthetic-player-record:${player.id}` }];
  const competitionId = 'synthetic-reviewed-current-league';
  const clubIds = snapshot.clubs.map(club => club.id);
  const playerIds = snapshot.players.map(player => player.id);
  snapshot.competitions = [{ id: competitionId, name: 'Premier League', country: 'England', season: '2026/27', format: 'league', clubIds, provenance: [{ ...structuredClone(provenance), externalId: `synthetic-competition-record:${competitionId}` }] }];
  const capture = { contentSha256: 'a'.repeat(64), locator: 'SYNTHETIC AUTOMATED TEST fixture only', excerpt: 'SYNTHETIC AUTOMATED TEST EVIDENCE ONLY. No real football claims or actual publication.' };
  return {
    format: 'touchline-current-squads', schemaVersion: 1, sourceSnapshotId: snapshot.id, competitionId,
    season: '2026/27', asOfDate: '2026-10-16', membershipEvidenceIds: ['synthetic-current-evidence'],
    evidence: [{
      evidenceId: 'synthetic-current-evidence', sourceId: provenance.sourceId, authority: 'licensed-provider', url: provenance.url,
      publishedDate: '2026-10-16', effectiveFrom: '2026-07-01', effectiveThrough: '2027-06-30', capturedAt: SEASON_TEST_TIMESTAMP, capture,
      claims: ['competition-membership', 'club-roster', 'player-identity', 'goalkeeper-position', 'under21-coverage', 'roster-exclusions'], clubIds, playerIds,
      review: { status: 'reviewed', reviewedBy: 'SYNTHETIC AUTOMATED TEST ONLY', reviewedAt: SEASON_TEST_TIMESTAMP, checkedAgainstCapturedSource: true, effectiveDatesConfirmed: true, notes: ['Synthetic test evidence, not reviewed real facts.'] },
      rightsReview: { status: 'permitted', basis: 'written-permission', termsUrl: 'https://example.com/synthetic-test-terms', permittedUses: ['local-storage', 'in-app-display', 'save-export', 'redistribution'], reviewedBy: 'SYNTHETIC AUTOMATED TEST ONLY', reviewedAt: SEASON_TEST_TIMESTAMP, capture, notes: ['Synthetic permission fixture only.'] },
    }],
    clubs: snapshot.clubs.map(club => ({
      clubId: club.id, coverage: 'complete', rosterEvidenceIds: ['synthetic-current-evidence'], under21Handling: 'reviewed-no-additional-eligible-players', under21EvidenceIds: ['synthetic-current-evidence'], exclusionsEvidenceIds: ['synthetic-current-evidence'],
      notes: ['Synthetic complete roster and exclusions fixture, not real affiliations.'],
      players: snapshot.players.filter(player => player.clubId === club.id).map(player => ({ playerId: player.id, name: player.name, dateOfBirth: player.dateOfBirth, sourceId: provenance.sourceId, externalId: `synthetic-player-record:${player.id}`, evidenceIds: ['synthetic-current-evidence'], registrationStatus: 'senior-registered', isGoalkeeper: player.positions.includes('GK') })),
    })),
  };
}

export function syntheticSeasonInputs() {
  const teams = Array.from({ length: 20 }, (_, index) => {
    const team = syntheticMatchTeam(`synthetic-season-club-${index}`, { skill: 10, stamina: 10 });
    team.players = team.players.slice(0, 14);
    team.benchIds = team.players.slice(11).map(player => player.id);
    for (const player of team.players) for (const group of Object.values(player.attributes)) for (const key of Object.keys(group)) (group as Record<string, number | null>)[key] = 10;
    return team;
  });
  const snapshot: DatabaseSnapshot = {
    schemaVersion: 1, id: 'synthetic-season-source', name: 'SYNTHETIC AUTOMATED TEST SEASON SOURCE', season: '2026/27', createdAt: TEST_TIMESTAMP,
    sources: [structuredClone(syntheticSource)], competitions: [],
    clubs: teams.map(team => ({
      id: team.id, name: team.name, shortName: team.id, country: 'Synthetic test only', stadium: null, primaryColor: null, finances: null,
      dataStatus: { validation: 'verified', completeness: 'partial', notes: ['Synthetic test affiliation only.'] }, provenance: [structuredClone(syntheticSource)],
    })),
    players: teams.flatMap(team => team.players.map(player => ({
      id: player.id, name: player.name, dateOfBirth: null, nationality: [], positions: [...player.positions], preferredFoot: 'unknown' as const, clubId: team.id,
      attributes: createUnknownAttributes(), attributeAssessments: {}, hidden: { personality: {}, currentDevelopmentLevel: null, potential: null },
      dataStatus: { validation: 'verified' as const, completeness: 'partial' as const, notes: ['Synthetic automated test roster only.'] }, provenance: [structuredClone(syntheticSource)],
    }))),
    validation: { status: 'validated', notes: ['SYNTHETIC AUTOMATED TESTS ONLY; no real roster facts.'] },
  };
  const career: GameState = {
    schemaVersion: 1, id: 'synthetic-season-career', databaseSnapshotId: snapshot.id, managedClubId: teams[0]!.id,
    currentDate: '2026-10-16', createdAt: SEASON_TEST_TIMESTAMP, updatedAt: SEASON_TEST_TIMESTAMP, simulation: { seed: 12345, randomState: 12345, commandCount: 1 },
  };
  const config: SeasonConfig = {
    engineVersion: 1, matchEngineVersion: 1, id: 'synthetic-season-v1', careerId: career.id, name: 'SYNTHETIC AUTOMATED TEST SEASON',
    startDate: career.currentDate, firstMatchDate: '2026-10-17', seed: 12345, managedClubId: career.managedClubId!, teams,
    assessmentMode: 'uniform-missing-10', homeAdvantage: 0.04,
  };
  const rosterManifest = syntheticCurrentSquadManifest(snapshot);
  return { snapshot, career, config, rosterManifest };
}
