import { z } from 'zod';
import { dateSchema, idSchema, parseSnapshot, timestampSchema } from '../data/schema';
import type { DatabaseSnapshot, Player, ProvenanceRecord } from '../domain/models';

export interface SeasonRosterReadinessDTO {
  status: 'checking' | 'blocked' | 'ready';
  season: string;
  asOfDate: string | null;
  notes: string[];
  clubs: {
    clubId: string;
    name: string;
    verifiedPlayers: number;
    goalkeepers: number;
    status: 'verified' | 'missing' | 'needs-review';
    sourceDate: string | null;
    notes: string[];
  }[];
}

export const CURRENT_SQUAD_REQUIREMENTS = { season: '2026/27', asOfDate: '2026-10-16', clubs: 20 } as const;
const text = z.string().trim().min(1).max(2000).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/);
const url = z.string().max(2048).url().refine(value => {
  const parsed = new URL(value);
  return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
}, 'Use an HTTP(S) evidence URL without credentials.');
const ids = z.array(idSchema).max(20_000);
const notes = z.array(text).max(100);
const season = z.string().regex(/^\d{4}\/\d{2}$/).refine(value => Number(value.slice(5)) === (Number(value.slice(0, 4)) + 1) % 100);
const capturedEvidence = z.object({
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  locator: text,
  excerpt: text.min(20),
}).strict();

const evidenceSchema = z.object({
  evidenceId: idSchema,
  sourceId: idSchema,
  authority: z.enum(['official-league', 'official-club', 'licensed-provider']),
  url,
  publishedDate: dateSchema,
  effectiveFrom: dateSchema,
  effectiveThrough: dateSchema,
  capturedAt: timestampSchema,
  capture: capturedEvidence,
  claims: z.array(z.enum(['competition-membership', 'club-roster', 'player-identity', 'goalkeeper-position', 'under21-coverage', 'roster-exclusions'])).min(1).max(6),
  clubIds: ids,
  playerIds: ids,
  review: z.object({
    status: z.enum(['reviewed', 'needs-review', 'rejected']),
    reviewedBy: text.nullable(),
    reviewedAt: timestampSchema.nullable(),
    checkedAgainstCapturedSource: z.boolean(),
    effectiveDatesConfirmed: z.boolean(),
    notes,
  }).strict(),
  rightsReview: z.object({
    status: z.enum(['permitted', 'unreviewed', 'not-permitted']),
    basis: z.enum(['open-licence', 'written-permission', 'provider-contract', 'unreviewed']),
    termsUrl: url.nullable(),
    // Save export means the owner's private backup/restore. Redistribution is
    // recorded separately and is not required for a private local import.
    permittedUses: z.array(z.enum(['local-storage', 'in-app-display', 'save-export', 'redistribution'])).max(4),
    reviewedBy: text.nullable(),
    reviewedAt: timestampSchema.nullable(),
    capture: capturedEvidence.nullable(),
    notes,
  }).strict(),
}).strict();

const rosterPlayerSchema = z.object({
  playerId: idSchema,
  name: text.max(240),
  dateOfBirth: dateSchema.nullable(),
  sourceId: idSchema,
  externalId: text.max(200),
  evidenceIds: ids.min(1),
  registrationStatus: z.enum(['senior-registered', 'under21-eligible']),
  isGoalkeeper: z.boolean(),
}).strict();

const clubReviewSchema = z.object({
  clubId: idSchema,
  coverage: z.enum(['complete', 'partial', 'unknown']),
  rosterEvidenceIds: ids.min(1),
  under21Handling: z.enum(['included', 'separate-list-included', 'reviewed-no-additional-eligible-players', 'unreviewed']),
  under21EvidenceIds: ids,
  exclusionsEvidenceIds: ids,
  players: z.array(rosterPlayerSchema).max(200),
  notes,
}).strict();

export const currentSquadManifestSchema = z.object({
  format: z.literal('touchline-current-squads'),
  schemaVersion: z.literal(1),
  sourceSnapshotId: idSchema,
  competitionId: idSchema,
  season,
  asOfDate: dateSchema,
  membershipEvidenceIds: ids.min(1),
  evidence: z.array(evidenceSchema).min(1).max(10_000),
  clubs: z.array(clubReviewSchema).max(100),
}).strict().superRefine((manifest, context) => {
  const unique = (values: string[], path: (string | number)[]) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value)) context.addIssue({ code: 'custom', path: [...path, index], message: `Duplicate reference: ${value}.` });
      seen.add(value);
    });
  };
  unique(manifest.evidence.map(item => item.evidenceId), ['evidence']);
  unique(manifest.clubs.map(item => item.clubId), ['clubs']);
  unique(manifest.membershipEvidenceIds, ['membershipEvidenceIds']);
  unique(manifest.clubs.flatMap(club => club.players.map(player => player.playerId)), ['clubs']);
  unique(manifest.clubs.flatMap(club => club.players.map(player => `${player.sourceId}:${player.externalId}`)), ['clubs']);
  const evidenceIds = new Set(manifest.evidence.map(item => item.evidenceId));
  const requireReferences = (references: string[], path: (string | number)[]) => references.forEach((reference, index) => {
    if (!evidenceIds.has(reference)) context.addIssue({ code: 'custom', path: [...path, index], message: 'Evidence reference is absent from this manifest.' });
  });
  requireReferences(manifest.membershipEvidenceIds, ['membershipEvidenceIds']);
  for (const [index, item] of manifest.evidence.entries()) {
    unique(item.claims, ['evidence', index, 'claims']);
    unique(item.clubIds, ['evidence', index, 'clubIds']);
    unique(item.playerIds, ['evidence', index, 'playerIds']);
    unique(item.rightsReview.permittedUses, ['evidence', index, 'rightsReview', 'permittedUses']);
  }
  for (const [index, club] of manifest.clubs.entries()) {
    for (const key of ['rosterEvidenceIds', 'under21EvidenceIds', 'exclusionsEvidenceIds'] as const) {
      unique(club[key], ['clubs', index, key]);
      requireReferences(club[key], ['clubs', index, key]);
    }
    for (const [playerIndex, player] of club.players.entries()) {
      unique(player.evidenceIds, ['clubs', index, 'players', playerIndex, 'evidenceIds']);
      requireReferences(player.evidenceIds, ['clubs', index, 'players', playerIndex, 'evidenceIds']);
    }
  }
});

export type CurrentSquadEvidence = z.infer<typeof evidenceSchema>;
export type CurrentClubSquadReview = z.infer<typeof clubReviewSchema>;
export type CurrentSquadManifest = z.infer<typeof currentSquadManifestSchema>;

/** Structural validation does not independently authenticate a publisher or grant data rights. */
export function parseCurrentSquadManifest(input: unknown): CurrentSquadManifest {
  return currentSquadManifestSchema.parse(input);
}

type Claim = CurrentSquadEvidence['claims'][number];
function hasDatedProvenance(records: ProvenanceRecord[], evidence: CurrentSquadEvidence): boolean {
  return records.some(record => record.sourceId === evidence.sourceId && record.url === evidence.url && record.sourceDate === evidence.publishedDate);
}

/**
 * Validates an explicit external review record; it never promotes snapshot flags,
 * retrieval timestamps or self-declared licence metadata into verified football facts.
 * The captured material and rights must actually be reviewed outside this pure module.
 * This gate covers private local imports, display and owner backups; it does not
 * authorise bundling data for distribution or publishing it to other people.
 */
export function evaluateSeasonRosterReadiness(
  sourceInput: DatabaseSnapshot,
  manifestInput?: CurrentSquadManifest | null,
): SeasonRosterReadinessDTO {
  let snapshot: DatabaseSnapshot;
  try { snapshot = parseSnapshot(sourceInput); }
  catch {
    return { status: 'blocked', season: CURRENT_SQUAD_REQUIREMENTS.season, asOfDate: null, notes: ['The source database is invalid; current roster evidence cannot be evaluated.'], clubs: [] };
  }
  const fallbackRows = (): SeasonRosterReadinessDTO['clubs'] => snapshot.clubs.map(club => ({
    clubId: club.id, name: club.name, verifiedPlayers: 0, goalkeepers: 0, status: 'missing', sourceDate: null,
    notes: ['No applicable, externally reviewed current-squad evidence is available.'],
  }));
  if (!manifestInput) return {
    status: 'blocked', season: snapshot.season, asOfDate: null,
    notes: [`Verified current ${CURRENT_SQUAD_REQUIREMENTS.season} competition membership and dated squads as of ${CURRENT_SQUAD_REQUIREMENTS.asOfDate} are required.`, 'No reviewed current-squad manifest is available. Archival identities, comparison allocations, verification flags and retrieval dates do not establish current squads.'],
    clubs: fallbackRows(),
  };
  const parsed = currentSquadManifestSchema.safeParse(manifestInput);
  if (!parsed.success) return {
    status: 'blocked', season: snapshot.season, asOfDate: null,
    notes: ['The current-squad manifest is malformed, contains duplicate identities/references or uses an unsupported format.'], clubs: fallbackRows(),
  };
  const manifest = parsed.data;
  const globalNotes: string[] = [];
  if (manifest.sourceSnapshotId !== snapshot.id) globalNotes.push('The review refers to a different source snapshot.');
  if (snapshot.validation.status !== 'validated') globalNotes.push('The current source database is still marked as reference-only.');
  if (manifest.season !== snapshot.season || manifest.season !== CURRENT_SQUAD_REQUIREMENTS.season) globalNotes.push('Current roster evidence must cover the requested 2026/27 season.');
  if (manifest.asOfDate !== CURRENT_SQUAD_REQUIREMENTS.asOfDate) globalNotes.push('The review must explicitly cover the requested 2026-10-16 cutoff.');
  const competition = snapshot.competitions.find(item => item.id === manifest.competitionId);
  const clubIds = competition?.clubIds ?? [];
  if (!competition || competition.name !== 'Premier League' || competition.format !== 'league' || competition.season !== manifest.season || competition.country !== 'England') globalNotes.push('A sourced English Premier League competition for this season is required.');
  if (clubIds.length !== 20 || new Set(clubIds).size !== 20 || manifest.clubs.length !== 20 || manifest.clubs.some(club => !clubIds.includes(club.clubId))) globalNotes.push('Exactly twenty reviewed current competition memberships are required.');
  const sources = new Map(snapshot.sources.map(item => [item.sourceId, item]));
  const evidenceById = new Map(manifest.evidence.map(item => [item.evidenceId, item]));
  const seasonStart = `${manifest.season.slice(0, 4)}-07-01`;
  const seasonEnd = `${Number(manifest.season.slice(0, 4)) + 1}-06-30`;
  const validEvidence = new Map<string, boolean>();
  const requiredUses = ['local-storage', 'in-app-display', 'save-export'] as const;
  for (const evidence of manifest.evidence) {
    const source = sources.get(evidence.sourceId);
    const review = evidence.review;
    const rights = evidence.rightsReview;
    const valid = Boolean(source)
      && new URL(source!.url).origin === new URL(evidence.url).origin
      && evidence.publishedDate <= manifest.asOfDate
      && evidence.effectiveFrom >= seasonStart && evidence.effectiveThrough <= seasonEnd
      && evidence.effectiveFrom <= manifest.asOfDate && evidence.effectiveThrough >= manifest.asOfDate
      && evidence.effectiveFrom <= evidence.effectiveThrough
      && evidence.capturedAt.slice(0, 10) >= evidence.publishedDate
      && evidence.capturedAt.slice(0, 10) >= manifest.asOfDate
      && review.status === 'reviewed' && Boolean(review.reviewedBy) && Boolean(review.reviewedAt)
      && Date.parse(review.reviewedAt!) >= Date.parse(evidence.capturedAt)
      && review.checkedAgainstCapturedSource && review.effectiveDatesConfirmed && review.notes.length > 0
      && rights.status === 'permitted' && rights.basis !== 'unreviewed' && Boolean(rights.termsUrl)
      && Boolean(rights.reviewedBy) && Boolean(rights.reviewedAt) && Boolean(rights.capture) && rights.notes.length > 0
      && requiredUses.every(use => rights.permittedUses.includes(use));
    validEvidence.set(evidence.evidenceId, valid);
  }
  const supports = (references: string[], claim: Claim, clubId?: string, playerId?: string, provenance?: ProvenanceRecord[]): boolean => references.some(id => {
    const evidence = evidenceById.get(id);
    return Boolean(evidence && validEvidence.get(id) && evidence.claims.includes(claim)
      && (!clubId || evidence.clubIds.includes(clubId)) && (!playerId || evidence.playerIds.includes(playerId))
      && (!provenance || hasDatedProvenance(provenance, evidence))
      && (claim !== 'competition-membership' || evidence.authority === 'official-league' || evidence.authority === 'licensed-provider'));
  });
  if (!competition || !supports(manifest.membershipEvidenceIds, 'competition-membership', undefined, undefined, competition.provenance)) globalNotes.push('Competition membership lacks applicable reviewed, dated primary/licensed evidence and reuse rights.');
  const selectedClubs = clubIds.length ? snapshot.clubs.filter(club => clubIds.includes(club.id)) : snapshot.clubs;
  const rows: SeasonRosterReadinessDTO['clubs'] = selectedClubs.map(club => {
    const review = manifest.clubs.find(item => item.clubId === club.id);
    const clubNotes: string[] = [];
    if (!review) return { clubId: club.id, name: club.name, verifiedPlayers: 0, goalkeepers: 0, status: 'missing', sourceDate: null, notes: ['This club has no reviewed current-squad coverage.'] };
    if (club.dataStatus.validation !== 'verified') clubNotes.push('The source club record still requires factual review.');
    if (!supports(manifest.membershipEvidenceIds, 'competition-membership', club.id, undefined, club.provenance)) clubNotes.push('Current competition membership is not supported by dated, reviewed league/provider evidence.');
    if (review.coverage !== 'complete') clubNotes.push('Roster coverage is partial or unknown.');
    if (!supports(review.rosterEvidenceIds, 'club-roster', club.id)) clubNotes.push('Current roster coverage lacks reviewed source evidence and reuse rights.');
    if (review.under21Handling === 'unreviewed' || !supports(review.under21EvidenceIds, 'under21-coverage', club.id)) clubNotes.push('Under-21 eligible-player coverage has not been reviewed.');
    if (!supports(review.exclusionsEvidenceIds, 'roster-exclusions', club.id)) clubNotes.push('Loan, eligibility and registration exclusions have not been reviewed.');
    if (review.notes.length === 0) clubNotes.push('The roster review must describe its scope and exclusions.');
    const assignedPlayers = snapshot.players.filter(player => player.clubId === club.id);
    if (assignedPlayers.length !== review.players.length || assignedPlayers.some(player => !review.players.some(item => item.playerId === player.id))) clubNotes.push('The reviewed roster and source club assignments do not match exactly.');
    const verified: { player: Player; isGoalkeeper: boolean }[] = [];
    for (const reviewed of review.players) {
      const player = snapshot.players.find(item => item.id === reviewed.playerId);
      const identityEvidenceIds = reviewed.evidenceIds.filter(id => evidenceById.get(id)?.sourceId === reviewed.sourceId);
      const matchingIdentity = player && player.clubId === club.id && player.name === reviewed.name && player.dateOfBirth === reviewed.dateOfBirth
        && player.dataStatus.validation === 'verified'
        && player.provenance.some(record => record.sourceId === reviewed.sourceId && record.externalId === reviewed.externalId)
        && supports(identityEvidenceIds, 'player-identity', club.id, player.id, player.provenance)
        && supports(reviewed.evidenceIds, 'club-roster', club.id, player.id)
        && player.positions.includes('GK') === reviewed.isGoalkeeper
        && (!reviewed.isGoalkeeper || supports(identityEvidenceIds, 'goalkeeper-position', club.id, player.id, player.provenance))
        && (reviewed.registrationStatus !== 'under21-eligible' || supports(reviewed.evidenceIds, 'under21-coverage', club.id, player.id));
      if (matchingIdentity) verified.push({ player, isGoalkeeper: reviewed.isGoalkeeper });
      else clubNotes.push(`Player ${reviewed.playerId} lacks matching current identity, assignment or goalkeeper evidence.`);
      if (reviewed.registrationStatus === 'under21-eligible' && review.under21Handling === 'reviewed-no-additional-eligible-players') clubNotes.push('Under-21 eligible records contradict the stated coverage exclusion.');
    }
    const goalkeepers = verified.filter(item => item.isGoalkeeper).length;
    if (verified.length < 11 || verified.length - goalkeepers < 10 || goalkeepers < 1) clubNotes.push('At least eleven reviewed players, ten outfield players and a sourced goalkeeper are required.');
    const sourceDates = review.rosterEvidenceIds.flatMap(id => {
      const evidence = evidenceById.get(id);
      return evidence && validEvidence.get(id) ? [evidence.publishedDate] : [];
    }).sort();
    if (globalNotes.length) clubNotes.push('The competition-wide review is not ready; see the season readiness notes.');
    return {
      clubId: club.id, name: club.name, verifiedPlayers: verified.length, goalkeepers,
      status: clubNotes.length === 0 ? 'verified' : 'needs-review', sourceDate: sourceDates.at(-1) ?? null, notes: [...new Set(clubNotes)],
    };
  });
  const ready = globalNotes.length === 0 && rows.length === 20 && rows.every(club => club.status === 'verified');
  return {
    status: ready ? 'ready' : 'blocked', season: manifest.season, asOfDate: manifest.asOfDate,
    notes: ready ? ['All twenty clubs pass the supplied externally reviewed current-membership, roster, identity, under-21 and reuse-rights evidence contract. Source authentication remains the responsibility of the external review.']
      : [...new Set([...globalNotes, 'Every club must have complete dated current-squad evidence, reviewed reuse rights and explicit under-21/exclusion handling before season creation.'])],
    clubs: rows,
  };
}
