import { ROLE_DEFINITIONS } from '../../domain/ratings';
import { applyMatchCommand, createMatch, FORMATION_POSITIONS, getMatchSummary, positionalFamiliarity, type MatchConfig, type MatchLineupSlot, type MatchSide, type MatchState, type MatchTeam } from '../match';
import { generateSeasonFixtures, getRoundFixtures } from './scheduler';
import { parseSeasonCommand, parseSeasonConfig } from './validation';
import { SEASON_ENGINE_VERSION, SEASON_ROUND_COUNT, type SeasonCommand, type SeasonCommandResult, type SeasonConfig, type SeasonFixture, type SeasonMatchSession, type SeasonResult, type SeasonState, type SeasonTeamSelection } from './types';

export const MAX_SEASON_ABANDONMENT_RETRIES = 3 as const;
const SEED_STRIDE = 0x9e37_79b1;
const idOrder = (first: string, second: string): number => first < second ? -1 : first > second ? 1 : 0;

function initialSelection(team: MatchTeam): SeasonTeamSelection {
  return { formation: team.formation, instructions: { ...team.instructions }, lineup: team.lineup.map(slot => ({ ...slot })), benchIds: [...team.benchIds] };
}
function selectedTeam(state: SeasonState, clubId: string): MatchTeam {
  const original = state.config.teams.find(team => team.id === clubId);
  const selection = state.teamSelections[clubId];
  if (!original || !selection) throw new Error(`Unknown season club: ${clubId}.`);
  return { ...original, ...selection, lineup: selection.lineup.map(slot => ({ ...slot })), benchIds: [...selection.benchIds], instructions: { ...selection.instructions } };
}
export function getSeasonFixtureSeed(state: Pick<SeasonState, 'config' | 'fixtures'>, fixtureId: string, attempt = 0): number {
  const ordinal = state.fixtures.findIndex(fixture => fixture.id === fixtureId);
  if (ordinal < 0 || !Number.isInteger(attempt) || attempt < 0 || attempt > MAX_SEASON_ABANDONMENT_RETRIES) throw new Error('Unknown fixture or unsupported abandonment attempt.');
  // The odd multiplication permutes uint32 values. Retry blocks have 380 seeds,
  // so every fixture/attempt pair has a distinct numeric seed in this season.
  return (state.config.seed + Math.imul(ordinal + 1 + state.fixtures.length * attempt, SEED_STRIDE)) >>> 0;
}
export function getFixtureMatchConfig(state: SeasonState, fixture: SeasonFixture): MatchConfig {
  if (!state.fixtures.some(candidate => candidate.id === fixture.id && candidate.homeClubId === fixture.homeClubId && candidate.awayClubId === fixture.awayClubId)) throw new Error('Fixture is absent from this season.');
  return {
    engineVersion: state.config.matchEngineVersion,
    id: fixture.id,
    seed: getSeasonFixtureSeed(state, fixture.id, state.fixtureAttempts[fixture.id] ?? 0),
    home: selectedTeam(state, fixture.homeClubId), away: selectedTeam(state, fixture.awayClubId),
    assessmentMode: state.config.assessmentMode, homeAdvantage: state.config.homeAdvantage,
  };
}
export function getCurrentSeasonFixtures(state: Pick<SeasonState, 'fixtures' | 'roundIndex'>): SeasonFixture[] {
  if (state.roundIndex === SEASON_ROUND_COUNT) return [];
  return getRoundFixtures(state.fixtures, state.roundIndex + 1);
}
export function getManagedSeasonFixture(state: Pick<SeasonState, 'fixtures' | 'roundIndex' | 'config'>): SeasonFixture | null {
  return getCurrentSeasonFixtures(state).find(fixture => fixture.homeClubId === state.config.managedClubId || fixture.awayClubId === state.config.managedClubId) ?? null;
}

export function createSeason(input: SeasonConfig): SeasonState {
  const config = parseSeasonConfig(input);
  return {
    engineVersion: SEASON_ENGINE_VERSION, config, currentDate: config.startDate, roundIndex: 0,
    status: config.startDate === config.firstMatchDate ? 'matchday' : 'between-rounds',
    fixtures: generateSeasonFixtures(config), results: [], pendingResults: [], activeMatch: null, lastManagedMatch: null,
    commands: [], teamSelections: Object.fromEntries(config.teams.map(team => [team.id, initialSelection(team)])),
    blockedFixtureId: null, fixtureAttempts: {}, abandonedMatches: [],
  };
}
function cloneState(state: SeasonState): SeasonState {
  return { ...state, commands: [...state.commands], results: [...state.results], pendingResults: [...state.pendingResults], teamSelections: { ...state.teamSelections }, fixtureAttempts: { ...state.fixtureAttempts }, abandonedMatches: [...state.abandonedMatches] };
}
function sessionFor(state: SeasonState, fixture: SeasonFixture): SeasonMatchSession {
  return { fixtureId: fixture.id, attempt: state.fixtureAttempts[fixture.id] ?? 0, state: createMatch(getFixtureMatchConfig(state, fixture)) };
}
function automaticallyComplete(session: SeasonMatchSession): SeasonMatchSession {
  let match = session.state;
  while (match.status !== 'finished' && match.status !== 'abandoned') {
    const advanced = applyMatchCommand(match, { type: 'ADVANCE' });
    if (!advanced.ok) throw new Error(`Automatic match rejected: ${advanced.error.code}: ${advanced.error.message}`);
    match = advanced.state;
  }
  return { ...session, state: match };
}
function resultFor(fixture: SeasonFixture, match: MatchState): SeasonResult {
  if (match.status !== 'finished') throw new Error('Only full-time matches can enter a season result.');
  return { fixtureId: fixture.id, round: fixture.round, status: 'finished', summary: getMatchSummary(match) };
}
function blockSeason(state: SeasonState, session: SeasonMatchSession): void {
  state.status = 'blocked';
  state.activeMatch = session;
  state.blockedFixtureId = session.fixtureId;
  state.abandonedMatches.push(session);
}

/**
 * Preserve managed decisions between fixtures. Substitutes remain in the XI;
 * outgoing players return to the bench. Dismissals do not become suspensions in
 * this milestone: missing slots are restored from eligible club players by known
 * positional familiarity, then the prior starter, then stable player ID.
 * This repairs a legal XI without judging ability or inventing a roster fact.
 */
function carryManagedSelection(state: SeasonState, session: SeasonMatchSession): SeasonTeamSelection {
  const side: MatchSide = session.state.config.home.id === state.config.managedClubId ? 'home' : 'away';
  const runtime = session.state.teams[side];
  const team = state.config.teams.find(candidate => candidate.id === state.config.managedClubId)!;
  const previous = state.teamSelections[team.id]!;
  const lineup = runtime.lineup.map(slot => ({ ...slot }));
  // A legal complete shape comes from the formation's canonical position counts.
  const formationPositions = [...FORMATION_POSITIONS[runtime.formation]];
  for (const slot of lineup) {
    const index = formationPositions.indexOf(slot.position);
    if (index < 0) throw new Error('Managed lineup does not fit its formation.');
    formationPositions.splice(index, 1);
  }
  for (const position of formationPositions) {
    const prior = previous.lineup.find(slot => slot.position === position && !lineup.some(active => active.playerId === slot.playerId))?.playerId;
    const available = team.players.filter(player => player.initialCondition > 0 && !lineup.some(slot => slot.playerId === player.id));
    available.sort((first, second) => positionalFamiliarity(second, position) - positionalFamiliarity(first, position)
      || Number(second.id === prior) - Number(first.id === prior) || idOrder(first.id, second.id));
    const player = available[0];
    const role = (Object.keys(ROLE_DEFINITIONS) as MatchLineupSlot['role'][]).find(candidate => ROLE_DEFINITIONS[candidate].positions.includes(position));
    if (!player || !role) throw new Error('A legal starting XI cannot be restored.');
    lineup.push({ playerId: player.id, position, role });
  }
  return { formation: runtime.formation, instructions: { ...runtime.instructions }, lineup, benchIds: team.players.filter(player => !lineup.some(slot => slot.playerId === player.id)).map(player => player.id) };
}

function transition(state: SeasonState, command: SeasonCommand): SeasonCommandResult {
  const fail = (code: string, message: string): SeasonCommandResult => ({ ok: false, state, error: { code, message } });
  if (state.engineVersion !== SEASON_ENGINE_VERSION || state.config.matchEngineVersion !== 1) return fail('VERSION', 'Unsupported season or match engine version.');
  if (state.status === 'finished') return fail('SEASON_FINISHED', 'All thirty-eight rounds have been completed.');
  const current = getCurrentSeasonFixtures(state);
  const managedFixture = getManagedSeasonFixture(state);
  if (current.length !== 10 || !managedFixture) return fail('INVALID_STATE', 'The next round must contain ten fixtures and one managed match.');
  const next = cloneState(state);
  if (command.type === 'ADVANCE_CALENDAR') {
    if (state.status !== 'between-rounds' || state.activeMatch || state.pendingResults.length) return fail('ROUND_PENDING', 'Complete the pending round before advancing the calendar.');
    const fixtureDate = managedFixture.date;
    if (state.currentDate >= fixtureDate) return fail('ALREADY_MATCHDAY', 'The next fixture date has already been reached.');
    next.currentDate = fixtureDate;
    next.status = 'matchday';
  } else if (command.type === 'START_MATCH') {
    if (state.status !== 'matchday' || state.currentDate !== managedFixture.date || state.activeMatch || state.pendingResults.length) return fail('NOT_MATCHDAY', 'Reach the next fixture date before starting the managed match.');
    next.activeMatch = sessionFor(next, managedFixture);
    next.status = 'playing';
  } else if (command.type === 'MATCH_COMMAND') {
    if (state.status !== 'playing' || !state.activeMatch || state.activeMatch.fixtureId !== managedFixture.id) return fail('NO_ACTIVE_MATCH', 'Start the managed fixture before issuing match commands.');
    const managedSide: MatchSide = state.activeMatch.state.config.home.id === state.config.managedClubId ? 'home' : 'away';
    if (command.command.type !== 'ADVANCE' && command.command.team !== managedSide) return fail('OPPOSITION_CONTROL', 'The career manager can change only their own team.');
    const result = applyMatchCommand(state.activeMatch.state, command.command);
    if (!result.ok) return fail(`MATCH_${result.error.code}`, result.error.message);
    next.activeMatch = { ...state.activeMatch, state: result.state };
    if (result.state.status === 'finished') { next.status = 'round-ready'; next.lastManagedMatch = next.activeMatch; }
    else if (result.state.status === 'abandoned') { next.lastManagedMatch = next.activeMatch; blockSeason(next, next.activeMatch); }
  } else if (command.type === 'COMPLETE_ROUND') {
    const managed = state.lastManagedMatch;
    if (state.status !== 'round-ready' || !managed || managed.fixtureId !== managedFixture.id || managed.state.status !== 'finished') return fail('MATCH_PENDING', 'Finish the managed fixture before completing the round.');
    if (state.results.some(result => current.some(fixture => fixture.id === result.fixtureId))) return fail('DUPLICATE_RESULT', 'This round has already entered the table.');
    const stagedIds = new Set(next.pendingResults.map(result => result.fixtureId));
    if (stagedIds.size !== next.pendingResults.length || next.pendingResults.some(result => !current.some(fixture => fixture.id === result.fixtureId))) return fail('INVALID_STATE', 'Staged results must be unique members of this round.');
    if (!stagedIds.has(managedFixture.id)) { next.pendingResults.push(resultFor(managedFixture, managed.state)); stagedIds.add(managedFixture.id); }
    for (const fixture of current) {
      if (stagedIds.has(fixture.id)) continue;
      const completed = automaticallyComplete(sessionFor(next, fixture));
      if (completed.state.status === 'abandoned') {
        blockSeason(next, completed);
        next.commands.push(command);
        return { ok: true, state: next };
      }
      next.pendingResults.push(resultFor(fixture, completed.state));
      stagedIds.add(fixture.id);
    }
    if (next.pendingResults.length !== 10) return fail('INVALID_STATE', 'The complete round must contain exactly ten results.');
    next.results.push(...next.pendingResults);
    next.pendingResults = [];
    next.teamSelections[state.config.managedClubId] = carryManagedSelection(state, managed);
    next.roundIndex++;
    next.activeMatch = null;
    next.blockedFixtureId = null;
    next.status = next.roundIndex === SEASON_ROUND_COUNT ? 'finished' : 'between-rounds';
  } else {
    if (state.status !== 'blocked' || !state.blockedFixtureId || !state.activeMatch || state.activeMatch.fixtureId !== state.blockedFixtureId || state.activeMatch.state.status !== 'abandoned') return fail('NOT_ABANDONED', 'Only an abandoned fixture may be replayed; finished results cannot be rerolled.');
    const fixture = current.find(candidate => candidate.id === state.blockedFixtureId);
    if (!fixture) return fail('INVALID_STATE', 'The abandoned fixture is not part of this round.');
    const previousAttempt = state.fixtureAttempts[fixture.id] ?? 0;
    if (previousAttempt >= MAX_SEASON_ABANDONMENT_RETRIES) return fail('REPLAY_LIMIT', 'This abandoned fixture has exhausted three deterministic retries. Export the season for review.');
    next.fixtureAttempts[fixture.id] = previousAttempt + 1;
    next.blockedFixtureId = null;
    if (fixture.id === managedFixture.id) {
      next.activeMatch = sessionFor(next, fixture);
      next.status = 'playing';
    } else {
      next.activeMatch = state.lastManagedMatch;
      next.status = 'round-ready';
    }
  }
  next.commands.push(command);
  return { ok: true, state: next };
}

export function applySeasonCommand(state: SeasonState, input: SeasonCommand): SeasonCommandResult {
  try { return transition(state, parseSeasonCommand(input)); }
  catch (error) { return { ok: false, state, error: { code: 'INVALID_COMMAND_OR_STATE', message: error instanceof Error ? error.message : 'Invalid season command or state.' } }; }
}
export function replaySeason(config: SeasonConfig, commands: readonly SeasonCommand[]): SeasonState {
  let state = createSeason(config);
  for (const command of commands) {
    const result = applySeasonCommand(state, command);
    if (!result.ok) throw new Error(`Cannot replay season command: ${result.error.code}: ${result.error.message}`);
    state = result.state;
  }
  return state;
}
