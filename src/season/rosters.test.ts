/** SYNTHETIC AUTOMATED TESTS ONLY: fabricated evidence never establishes real squads. */
import { describe, expect, it } from 'vitest';
import { syntheticSnapshot } from '../data/__tests__/fixtures';
import { syntheticSeasonInputs } from '../persistence/season/__tests__/fixtures';
import { evaluateSeasonRosterReadiness, parseCurrentSquadManifest, type CurrentSquadManifest } from './rosters';
import type { DatabaseSnapshot } from '../domain/models';

function scenario() {
  const { snapshot, rosterManifest } = syntheticSeasonInputs();
  return { snapshot, manifest: rosterManifest };
}

describe('current squad readiness evidence boundary', () => {
  it('blocks archival identities and verification flags without an explicit reviewed manifest', () => {
    const archival = syntheticSnapshot();
    const checked = evaluateSeasonRosterReadiness(archival);
    expect(checked.status).toBe('blocked');
    expect(checked.asOfDate).toBeNull();
    expect(checked.clubs[0]).toMatchObject({ status: 'missing', verifiedPlayers: 0, goalkeepers: 0, sourceDate: null });
    const { snapshot } = scenario();
    expect(snapshot.validation.status).toBe('validated');
    expect(snapshot.clubs.every(club => club.dataStatus.validation === 'verified')).toBe(true);
    expect(evaluateSeasonRosterReadiness(snapshot).status).toBe('blocked');
  });

  it('accepts the complete synthetic review contract and preserves the input objects', () => {
    const { snapshot, manifest } = scenario();
    const before = JSON.stringify({ snapshot, manifest });
    const result = evaluateSeasonRosterReadiness(snapshot, parseCurrentSquadManifest(manifest));
    expect(result).toMatchObject({ status: 'ready', season: '2026/27', asOfDate: '2026-10-16' });
    expect(result.clubs).toHaveLength(20);
    expect(result.clubs.every(club => club.status === 'verified' && club.verifiedPlayers === 14 && club.goalkeepers >= 1 && club.sourceDate === '2026-10-16')).toBe(true);
    expect(JSON.stringify({ snapshot, manifest })).toBe(before);
    expect(result.notes.join(' ')).toContain('external review');
  });

  it('accepts reviewed private storage, display and backup rights without public redistribution rights', () => {
    const { snapshot, manifest } = scenario();
    for (const evidence of manifest.evidence) {
      evidence.rightsReview.basis = 'provider-contract';
      evidence.rightsReview.permittedUses = ['local-storage', 'in-app-display', 'save-export'];
      evidence.rightsReview.notes = ['SYNTHETIC TEST CONTRACT ONLY: personal local storage, display and private backup are permitted; public redistribution is not authorised.'];
    }
    expect(evaluateSeasonRosterReadiness(snapshot, manifest).status).toBe('ready');
  });

  const blockedCases: [string, (snapshot: DatabaseSnapshot, manifest: CurrentSquadManifest) => void][] = [
    ['a different source snapshot', (_snapshot, manifest) => { manifest.sourceSnapshotId = 'another-source'; }],
    ['an older effective cutoff', (_snapshot, manifest) => { manifest.asOfDate = '2026-10-15'; }],
    ['a different season', (_snapshot, manifest) => { manifest.season = '2025/26'; }],
    ['reference-only source flags', (snapshot) => { snapshot.validation.status = 'reference-only'; }],
    ['a different competition', (snapshot) => { snapshot.competitions[0]!.name = 'Another English league'; }],
    ['nineteen memberships', (snapshot) => { snapshot.competitions[0]!.clubIds.pop(); }],
    ['club-only membership evidence', (_snapshot, manifest) => { manifest.evidence[0]!.authority = 'official-club'; }],
    ['unreviewed source captures', (_snapshot, manifest) => { manifest.evidence[0]!.review.status = 'needs-review'; }],
    ['an unchecked captured source', (_snapshot, manifest) => { manifest.evidence[0]!.review.checkedAgainstCapturedSource = false; }],
    ['unconfirmed effective dates', (_snapshot, manifest) => { manifest.evidence[0]!.review.effectiveDatesConfirmed = false; }],
    ['retrieval before the requested cutoff', (_snapshot, manifest) => { manifest.evidence[0]!.publishedDate = '2026-09-01'; manifest.evidence[0]!.capturedAt = '2026-10-15T23:59:59.000Z'; }],
    ['future publication claims', (_snapshot, manifest) => { manifest.evidence[0]!.publishedDate = '2026-10-17'; }],
    ['expired effective coverage', (_snapshot, manifest) => { manifest.evidence[0]!.effectiveThrough = '2026-10-15'; }],
    ['coverage starting after the cutoff', (_snapshot, manifest) => { manifest.evidence[0]!.effectiveFrom = '2026-10-17'; }],
    ['a review predating the captured evidence', (_snapshot, manifest) => { manifest.evidence[0]!.review.reviewedAt = '2026-10-16T11:59:59.000Z'; }],
    ['a source URL outside the registered publisher origin', (_snapshot, manifest) => { manifest.evidence[0]!.url = 'https://different.example.com/source'; }],
    ['unknown private-use rights', (_snapshot, manifest) => {
      manifest.evidence[0]!.rightsReview.permittedUses = ['local-storage', 'in-app-display', 'save-export'];
      manifest.evidence[0]!.rightsReview.status = 'unreviewed';
    }],
    ['denied private-use rights', (_snapshot, manifest) => {
      manifest.evidence[0]!.rightsReview.permittedUses = ['local-storage', 'in-app-display', 'save-export'];
      manifest.evidence[0]!.rightsReview.status = 'not-permitted';
    }],
    ['rights without terms evidence', (_snapshot, manifest) => { manifest.evidence[0]!.rightsReview.capture = null; }],
    ['rights missing save-export permission', (_snapshot, manifest) => { manifest.evidence[0]!.rightsReview.permittedUses = ['local-storage', 'in-app-display', 'redistribution']; }],
    ['a partial club roster', (_snapshot, manifest) => { manifest.clubs[0]!.coverage = 'partial'; }],
    ['unreviewed under-21 handling', (_snapshot, manifest) => { manifest.clubs[0]!.under21Handling = 'unreviewed'; }],
    ['missing eligibility and loan exclusion evidence', (_snapshot, manifest) => { manifest.clubs[0]!.exclusionsEvidenceIds = []; }],
    ['unverified source club facts', (snapshot) => { snapshot.clubs[0]!.dataStatus.validation = 'needs-review'; }],
    ['unverified source player facts', (snapshot) => { snapshot.players[0]!.dataStatus.validation = 'needs-review'; }],
    ['missing dated entity provenance', (snapshot) => { snapshot.players[0]!.provenance[0]!.sourceDate = null; }],
    ['a mismatched player identity', (_snapshot, manifest) => { manifest.clubs[0]!.players[0]!.name = 'Different synthetic identity'; }],
    ['an unassigned player', (snapshot) => { snapshot.players[0]!.clubId = null; }],
    ['a source player moved to another club', (snapshot) => { snapshot.players[0]!.clubId = snapshot.clubs[1]!.id; }],
    ['an omitted source roster member', (_snapshot, manifest) => { manifest.clubs[0]!.players.pop(); }],
    ['an undocumented goalkeeper claim', (_snapshot, manifest) => { manifest.evidence[0]!.claims = manifest.evidence[0]!.claims.filter(claim => claim !== 'goalkeeper-position'); }],
    ['a contradictory under-21 exclusion', (_snapshot, manifest) => { manifest.clubs[0]!.players[0]!.registrationStatus = 'under21-eligible'; }],
  ];
  it.each(blockedCases)('blocks %s', (_label, mutate) => {
    const { snapshot, manifest } = scenario();
    mutate(snapshot, manifest);
    expect(evaluateSeasonRosterReadiness(snapshot, manifest).status).toBe('blocked');
  });

  it('permits a Welsh club when reviewed membership places it in the English competition', () => {
    const { snapshot, manifest } = scenario();
    snapshot.clubs[0]!.country = 'Wales';
    expect(evaluateSeasonRosterReadiness(snapshot, manifest).status).toBe('ready');
  });

  it('accepts explicitly included under-21 records with scoped evidence', () => {
    const { snapshot, manifest } = scenario();
    manifest.clubs[0]!.under21Handling = 'included';
    manifest.clubs[0]!.players[0]!.registrationStatus = 'under21-eligible';
    expect(evaluateSeasonRosterReadiness(snapshot, manifest).status).toBe('ready');
    manifest.evidence[0]!.claims = manifest.evidence[0]!.claims.filter(claim => claim !== 'under21-coverage');
    expect(evaluateSeasonRosterReadiness(snapshot, manifest).status).toBe('blocked');
  });

  it('requires eleven reviewed players including a goalkeeper and ten outfield players', () => {
    const { snapshot, manifest } = scenario();
    const clubId = manifest.clubs[0]!.clubId;
    const keeperIds = new Set(manifest.clubs[0]!.players.filter(player => player.isGoalkeeper).map(player => player.playerId));
    snapshot.players = snapshot.players.filter(player => !keeperIds.has(player.id));
    manifest.clubs[0]!.players = manifest.clubs[0]!.players.filter(player => !keeperIds.has(player.playerId));
    const result = evaluateSeasonRosterReadiness(snapshot, manifest);
    expect(result.status).toBe('blocked');
    expect(result.clubs.find(club => club.clubId === clubId)).toMatchObject({ goalkeepers: 0, status: 'needs-review' });
  });

  it('does not bind identity proof from a different source to an unrelated external identifier', () => {
    const { snapshot, manifest } = scenario();
    const alternate = { ...structuredClone(snapshot.sources[0]!), sourceId: 'synthetic-other-source' };
    snapshot.sources.push(alternate);
    const player = snapshot.players[0]!;
    player.provenance.push({ ...alternate, externalId: 'synthetic-other-identity' });
    manifest.clubs[0]!.players[0]!.sourceId = alternate.sourceId;
    manifest.clubs[0]!.players[0]!.externalId = 'synthetic-other-identity';
    expect(evaluateSeasonRosterReadiness(snapshot, manifest).status).toBe('blocked');
  });

  it('rejects duplicate player IDs, duplicate external identities and dangling evidence', () => {
    const { manifest } = scenario();
    const duplicatePlayer = structuredClone(manifest);
    duplicatePlayer.clubs[1]!.players.push(structuredClone(duplicatePlayer.clubs[0]!.players[0]!));
    expect(() => parseCurrentSquadManifest(duplicatePlayer)).toThrow(/Duplicate reference/);
    const duplicateExternal = structuredClone(manifest);
    duplicateExternal.clubs[1]!.players[0]!.externalId = duplicateExternal.clubs[0]!.players[0]!.externalId;
    expect(() => parseCurrentSquadManifest(duplicateExternal)).toThrow(/Duplicate reference/);
    const dangling = structuredClone(manifest);
    dangling.clubs[0]!.rosterEvidenceIds = ['not-present'];
    expect(() => parseCurrentSquadManifest(dangling)).toThrow(/absent/);
  });

  it('rejects unknown fields, unsupported versions and malformed proof captures', () => {
    const { snapshot, manifest } = scenario();
    expect(() => parseCurrentSquadManifest({ ...manifest, assumedCurrent: true })).toThrow();
    expect(() => parseCurrentSquadManifest({ ...manifest, schemaVersion: 999 })).toThrow();
    const missingCapture = structuredClone(manifest);
    missingCapture.evidence[0]!.capture.contentSha256 = 'retrieved-today';
    expect(() => parseCurrentSquadManifest(missingCapture)).toThrow();
    expect(evaluateSeasonRosterReadiness(snapshot, missingCapture).status).toBe('blocked');
    expect(evaluateSeasonRosterReadiness({ ...snapshot, schemaVersion: 999 } as unknown as DatabaseSnapshot, manifest).status).toBe('blocked');
  });
});
