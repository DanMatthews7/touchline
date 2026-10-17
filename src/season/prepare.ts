import { parseSnapshot } from '../data';
import { ATTRIBUTE_GROUPS, getAttributeValue, type PlayerAttributes } from '../domain/attributes';
import type { DatabaseSnapshot, GameState, Player } from '../domain/models';
import { DEFAULT_INSTRUCTIONS, FORMATION_SLOTS } from '../match/prepare';
import type { MatchPlayer, MatchTeam } from '../simulation/match';
import { parseSeasonConfig, type SeasonConfig } from '../simulation/season';
import { evaluateSeasonRosterReadiness, parseCurrentSquadManifest, type CurrentSquadManifest } from './rosters';

export interface SeasonSetupOptions {
  name: string;
  firstMatchDate: string;
  seed: number;
  clubIds: string[];
  useUniformEstimates: boolean;
  initialCondition: number;
  initialMorale: number;
  homeAdvantage: boolean;
}

export interface PrepareSeasonOptions extends SeasonSetupOptions {
  id: string;
  snapshotId: string;
  updatedAt: string;
}

function preparePlayer(player: Player, options: SeasonSetupOptions): MatchPlayer {
  const attributes: PlayerAttributes = structuredClone(player.attributes);
  for (const group of ATTRIBUTE_GROUPS) {
    for (const attribute of group.attributes) {
      const value = getAttributeValue(attributes, attribute.path);
      if (value === null && !options.useUniformEstimates) {
        throw new Error(`${player.name}: ${attribute.label} is unassessed. Supply complete game assessments or explicitly enable uniform 10/20 season estimates.`);
      }
      (attributes[group.id] as Record<string, number | null>)[attribute.key] = value ?? 10;
    }
  }
  return {
    id: player.id, name: player.name, positions: [...player.positions], attributes,
    initialCondition: options.initialCondition, initialMorale: options.initialMorale,
  };
}

/** Verified source affiliations supply squads; only game assessments carry over from older records. */
export function prepareSeason(
  sourceInput: DatabaseSnapshot,
  previousInput: DatabaseSnapshot,
  career: GameState,
  manifestInput: CurrentSquadManifest,
  options: PrepareSeasonOptions,
): { snapshot: DatabaseSnapshot; career: GameState; config: SeasonConfig; manifest: CurrentSquadManifest } {
  const source = parseSnapshot(sourceInput);
  const previous = parseSnapshot(previousInput);
  const manifest = parseCurrentSquadManifest(manifestInput);
  const readiness = evaluateSeasonRosterReadiness(source, manifest);
  if (readiness.status !== 'ready' || !readiness.asOfDate) throw new Error(`Verified current club squads are required. ${readiness.notes.join(' ')}`);
  if (career.databaseSnapshotId !== previous.id) throw new Error('Career and current source database do not match.');
  if (!career.managedClubId || !options.clubIds.includes(career.managedClubId)) throw new Error('The season must include your managed club.');
  if (new Set(options.clubIds).size !== 20 || options.clubIds.length !== 20) throw new Error('Choose twenty distinct sourced clubs.');
  const verifiedClubIds = new Set(readiness.clubs.filter(club => club.status === 'verified').map(club => club.clubId));
  if (options.clubIds.some(id => !verifiedClubIds.has(id))) throw new Error('Every season club must belong to the verified current competition.');
  const sourceClubs = new Map(source.clubs.map(club => [club.id, club]));
  const selectedClubs = [...options.clubIds].sort().map(id => {
    const club = sourceClubs.get(id);
    if (!club) throw new Error('A selected club is absent from the season identity pool.');
    return club;
  });
  const oldPlayers = new Map(previous.players.map(player => [player.id, player]));
  const currentPlayerIds = new Set(source.players.map(player => player.id));
  const players = new Map(previous.players.map(player => [player.id, !currentPlayerIds.has(player.id) && player.clubId !== null && verifiedClubIds.has(player.clubId)
    ? { ...player, clubId: null, dataStatus: { ...player.dataStatus, validation: 'needs-review' as const, notes: [...player.dataStatus.notes, 'Earlier club assignment is not established by the current squad source.'] } }
    : player]));
  for (const player of source.players) {
    const old = oldPlayers.get(player.id);
    if (!old) { players.set(player.id, player); continue; }
    const attributes = structuredClone(player.attributes);
    const attributeAssessments = { ...player.attributeAssessments };
    for (const group of ATTRIBUTE_GROUPS) for (const attribute of group.attributes) {
      const oldValue = getAttributeValue(old.attributes, attribute.path);
      const assessment = old.attributeAssessments[attribute.path];
      if (oldValue !== null && assessment) {
        (attributes[group.id] as Record<string, number | null>)[attribute.key] = oldValue;
        attributeAssessments[attribute.path] = assessment;
      }
    }
    const provenance = new Map([...player.provenance, ...old.provenance].map(item => [JSON.stringify(item), item]));
    players.set(player.id, { ...player, attributes, attributeAssessments, hidden: structuredClone(old.hidden), provenance: [...provenance.values()] });
  }
  const clubs = new Map([...previous.clubs, ...source.clubs].map(club => [club.id, club]));
  const sources = new Map([...previous.sources, ...source.sources].map(item => [item.sourceId, item]));
  const competitions = new Map([...previous.competitions, ...source.competitions].map(item => [item.id, item]));
  const snapshot = parseSnapshot({
    ...source,
    id: options.snapshotId,
    name: 'Verified season squads · retained career assessments',
    createdAt: options.updatedAt,
    players: [...players.values()], clubs: [...clubs.values()], sources: [...sources.values()],
    competitions: [...competitions.values()],
  });
  const slots = FORMATION_SLOTS['4-3-3'];
  const teams: MatchTeam[] = selectedClubs.map(club => {
    const squad = source.players.filter(player => player.clubId === club.id).map(player => players.get(player.id)!).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const keepers = squad.filter(player => player.positions.includes('GK'));
    const outfield = squad.filter(player => !player.positions.includes('GK'));
    if (!keepers.length || outfield.length < 10) throw new Error(`${club.name} needs a sourced goalkeeper and ten other eligible squad members.`);
    // Match selection is a coach decision inside a verified squad, never an invented affiliation.
    const roster = [keepers[0]!, ...outfield.slice(0, 10), ...keepers.slice(1, 2), ...outfield.slice(10, keepers.length > 1 ? 18 : 19)];
    return {
      id: club.id, name: clubs.get(club.id)!.name, formation: '4-3-3', instructions: { ...DEFAULT_INSTRUCTIONS },
      players: roster.map(player => preparePlayer(player, options)),
      lineup: slots.map((slot, slotIndex) => ({ ...slot, playerId: roster[slotIndex]!.id })),
      benchIds: roster.slice(11).map(player => player.id),
    };
  });
  const config = parseSeasonConfig({
    engineVersion: 1, matchEngineVersion: 1, id: options.id, careerId: career.id,
    name: options.name, startDate: career.currentDate > readiness.asOfDate ? career.currentDate : readiness.asOfDate, firstMatchDate: options.firstMatchDate,
    seed: options.seed, managedClubId: career.managedClubId, teams,
    assessmentMode: options.useUniformEstimates ? 'uniform-missing-10' : 'recorded-attributes',
    homeAdvantage: options.homeAdvantage ? 0.04 : 0,
  });
  return {
    snapshot, config, manifest: parseCurrentSquadManifest({ ...manifest, sourceSnapshotId: snapshot.id }),
    career: { ...career, databaseSnapshotId: snapshot.id, currentDate: config.startDate, updatedAt: options.updatedAt },
  };
}
