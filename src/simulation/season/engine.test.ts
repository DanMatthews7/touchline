import { describe, expect, it } from 'vitest';
import { syntheticMatchTeam } from '../__tests__/match-fixtures';
import { createMatch, getMatchSummary, replayMatch, type MatchSide } from '../match';
import { applySeasonCommand, createSeason, getCurrentSeasonFixtures, getFixtureMatchConfig, getManagedSeasonFixture, getSeasonFixtureSeed, MAX_SEASON_ABANDONMENT_RETRIES, replaySeason } from './engine';
import { getSeasonTable } from './standings';
import type { SeasonCommand, SeasonConfig, SeasonMatchSession, SeasonState } from './types';
import { parseSeasonCommand, parseSeasonConfig } from './validation';

/** SYNTHETIC AUTOMATED TESTS ONLY. Never import these invented teams into application data. */
function config(seed = 42): SeasonConfig {
  const teams = Array.from({ length: 20 }, (_, index) => {
    const team = syntheticMatchTeam(`synthetic-club-${String(index).padStart(2, '0')}`);
    team.players = team.players.slice(0, 14);
    team.benchIds = team.benchIds.slice(0, 3);
    return team;
  });
  return { engineVersion: 1, matchEngineVersion: 1, id: 'synthetic-season', careerId: 'synthetic-career', name: 'SYNTHETIC AUTOMATED TEST SEASON', startDate: '2026-07-01', firstMatchDate: '2026-08-01', seed, managedClubId: teams[0]!.id, teams, assessmentMode: 'recorded-attributes', homeAdvantage: .04 };
}
function execute(state: SeasonState, command: SeasonCommand): SeasonState {
  const result = applySeasonCommand(state, command);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
function start(state: SeasonState): SeasonState {
  if (state.status === 'between-rounds') state = execute(state, { type: 'ADVANCE_CALENDAR' });
  return execute(state, { type: 'START_MATCH' });
}
function finishManaged(state: SeasonState): SeasonState {
  while (state.status === 'playing') state = execute(state, { type: 'MATCH_COMMAND', command: { type: 'ADVANCE' } });
  return state;
}
function finishRound(state: SeasonState): SeasonState {
  if (state.status === 'between-rounds' || state.status === 'matchday') state = start(state);
  for (;;) {
    state = finishManaged(state);
    if (state.status === 'blocked') { state = execute(state, { type: 'REPLAY_ABANDONED' }); continue; }
    state = execute(state, { type: 'COMPLETE_ROUND' });
    if (state.status !== 'blocked') return state;
    state = execute(state, { type: 'REPLAY_ABANDONED' });
  }
}

describe('strict season boundaries', () => {
  it('clones complete twenty-club inputs and permits eleven through twenty selected players per team', () => {
    const input = config();
    input.teams[0]!.players = input.teams[0]!.players.slice(0, 11);
    input.teams[0]!.benchIds = [];
    const parsed = parseSeasonConfig(input);
    parsed.teams[1]!.players[0]!.attributes.technical.passing = 1;
    expect(input.teams[1]!.players[0]!.attributes.technical.passing).toBe(12);
    expect(parsed.teams[0]!.players).toHaveLength(11);
  });
  it('rejects cross-club player duplication, unsupported versions, impossible dates and missing assessments', () => {
    const duplicate = config();
    const duplicatedId = duplicate.teams[0]!.players[0]!.id;
    duplicate.teams[2]!.players[0]!.id = duplicatedId;
    duplicate.teams[2]!.lineup[0]!.playerId = duplicatedId;
    expect(() => parseSeasonConfig(duplicate)).toThrow('only one season team');
    expect(() => parseSeasonConfig({ ...config(), engineVersion: 2 })).toThrow('Unsupported season');
    expect(() => parseSeasonConfig({ ...config(), matchEngineVersion: 2 })).toThrow('Unsupported match');
    expect(() => parseSeasonConfig({ ...config(), firstMatchDate: '2026-02-30' })).toThrow();
    expect(() => parseSeasonConfig({ ...config(), firstMatchDate: '9999-12-31' })).toThrow();
    const unknown = config(); unknown.teams[0]!.players[0]!.attributes.mental.decisions = null;
    expect(() => parseSeasonConfig(unknown)).toThrow();
  });
  it('does not invoke getters or accept unknown command/config keys', () => {
    let reads = 0;
    const input = Object.defineProperty(config(), 'teams', { enumerable: true, get() { reads++; return []; } });
    expect(() => parseSeasonConfig(input)).toThrow();
    expect(reads).toBe(0);
    expect(() => parseSeasonConfig({ ...config(), secretBonus: 5 })).toThrow('Unrecognized');
    expect(() => parseSeasonCommand({ type: 'ADVANCE_CALENDAR', days: 100 })).toThrow();
    expect(() => parseSeasonCommand({ type: 'MATCH_COMMAND', command: { type: 'ADVANCE', score: 5 } })).toThrow();
    const getterCommand = Object.defineProperty({}, 'type', { enumerable: true, get() { reads++; return 'ADVANCE_CALENDAR'; } }) as SeasonCommand;
    expect(() => replaySeason(config(), [getterCommand])).toThrow('Cannot replay season command');
    expect(reads).toBe(0);
  });
});

describe('calendar, managed matches and atomic round results', () => {
  it('stops the calendar at the pending fixture and blocks progress until the full round commits', () => {
    const initial = createSeason(config());
    const before = structuredClone(initial);
    const matchday = execute(initial, { type: 'ADVANCE_CALENDAR' });
    expect(matchday.currentDate).toBe('2026-08-01');
    expect(initial).toEqual(before);
    expect(applySeasonCommand(matchday, { type: 'ADVANCE_CALENDAR' })).toMatchObject({ ok: false, error: { code: 'ROUND_PENDING' } });
    const playing = execute(matchday, { type: 'START_MATCH' });
    expect(applySeasonCommand(playing, { type: 'COMPLETE_ROUND' })).toMatchObject({ ok: false, error: { code: 'MATCH_PENDING' } });
    const finished = finishManaged(playing);
    expect(finished.results).toHaveLength(0);
    expect(getSeasonTable(finished).every(row => row.played === 0)).toBe(true);
    const committed = execute(finished, { type: 'COMPLETE_ROUND' });
    expect(committed.results).toHaveLength(10);
    expect(committed.roundIndex).toBe(1);
    expect(committed.currentDate).toBe('2026-08-01');
    expect(getSeasonTable(committed).every(row => row.played === 1)).toBe(true);
    const rejected = applySeasonCommand(committed, { type: 'COMPLETE_ROUND' });
    expect(rejected.ok).toBe(false);
    expect(rejected.state).toBe(committed);
    expect(execute(committed, { type: 'ADVANCE_CALENDAR' }).currentDate).toBe('2026-08-08');
  });
  it('uses the unchanged authoritative match engine for every result and unique fixture seeds', () => {
    const initial = createSeason(config());
    const fixture = getManagedSeasonFixture(initial)!;
    const expectedConfig = getFixtureMatchConfig(initial, fixture);
    expect(expectedConfig.seed).toBe(fixture.seed);
    expect(new Set(initial.fixtures.map(item => item.seed)).size).toBe(380);
    const managed = finishManaged(start(initial));
    const expected = getMatchSummary(managed.activeMatch!.state);
    const committed = execute(managed, { type: 'COMPLETE_ROUND' });
    expect(committed.results.find(result => result.fixtureId === fixture.id)?.summary).toEqual(expected);
    expect(replaySeason(initial.config, committed.commands)).toEqual(committed);
  });
  it('rejects opposition decisions and retains managed substitutions and tactics for the next fixture', () => {
    const input = config();
    for (const player of input.teams[0]!.players) { player.initialCondition = 83; player.initialMorale = 64; }
    let state = start(createSeason(input));
    const side: MatchSide = state.activeMatch!.state.config.home.id === input.managedClubId ? 'home' : 'away';
    const other: MatchSide = side === 'home' ? 'away' : 'home';
    const team = state.activeMatch!.state.teams[side];
    const opposition = state.activeMatch!.state.teams[other];
    const rejected = applySeasonCommand(state, { type: 'MATCH_COMMAND', command: { type: 'CHANGE_TACTICS', team: other, formation: opposition.formation, instructions: opposition.instructions, lineup: opposition.lineup } });
    expect(rejected).toMatchObject({ ok: false, error: { code: 'OPPOSITION_CONTROL' } });
    expect(rejected.state).toBe(state);
    const outgoing = team.lineup[1]!.playerId, incoming = team.benchIds[1]!;
    state = execute(state, { type: 'MATCH_COMMAND', command: { type: 'SUBSTITUTE', team: side, playerOutId: outgoing, playerInId: incoming } });
    const current = state.activeMatch!.state.teams[side];
    state = execute(state, { type: 'MATCH_COMMAND', command: { type: 'CHANGE_TACTICS', team: side, formation: current.formation, instructions: { ...current.instructions, tempo: 'slow' }, lineup: current.lineup } });
    state = finishRound(state);
    expect(state.teamSelections[input.managedClubId]!.lineup.some(slot => slot.playerId === incoming)).toBe(true);
    expect(state.teamSelections[input.managedClubId]!.benchIds).toContain(outgoing);
    state = start(state);
    const nextSide: MatchSide = state.activeMatch!.state.config.home.id === input.managedClubId ? 'home' : 'away';
    expect(state.activeMatch!.state.teams[nextSide].instructions.tempo).toBe('slow');
    expect(state.activeMatch!.state.teams[nextSide].players[incoming]).toMatchObject({ condition: 83, morale: 64, yellowCards: 0, dismissed: false });
    expect(state.config.teams[0]!.lineup.some(slot => slot.playerId === outgoing)).toBe(true);
  });
  it('restores a complete legal XI after a managed dismissal without carrying suspensions into the next fixture', () => {
    const input = config();
    input.managedClubId = input.teams[19]!.id;
    for (const team of input.teams) team.instructions.pressingIntensity = 'high';
    // The opening fixture is ordinal zero; map its match seed to a reproducible
    // second-yellow treatment using the same unchanged M2 engine.
    input.seed = (3668339987 - Math.imul(1, 0x9e3779b1)) >>> 0;
    let state = finishManaged(start(createSeason(input)));
    const managedSide: MatchSide = state.activeMatch!.state.config.home.id === input.managedClubId ? 'home' : 'away';
    expect(state.activeMatch!.state.teams[managedSide].lineup).toHaveLength(10);
    state = execute(state, { type: 'COMPLETE_ROUND' });
    const selection = state.teamSelections[input.managedClubId]!;
    expect(selection.lineup).toHaveLength(11);
    expect(new Set([...selection.lineup.map(slot => slot.playerId), ...selection.benchIds]).size).toBe(14);
    state = start(state);
    const nextSide: MatchSide = state.activeMatch!.state.config.home.id === input.managedClubId ? 'home' : 'away';
    expect(Object.values(state.activeMatch!.state.teams[nextSide].players).every(player => !player.dismissed && player.yellowCards === 0)).toBe(true);
    expect(replaySeason(input, state.commands)).toEqual(state);
  });
  it('does not restore a zero-condition substitute to a starting slot after a dismissal', () => {
    const input = config();
    const team = input.teams[0]!;
    for (const slot of team.lineup.filter(slot => slot.position === 'CB')) team.players.find(player => player.id === slot.playerId)!.positions = [];
    const unfit = team.players[12]!;
    unfit.positions = ['CB']; unfit.initialCondition = 0;
    const ready = finishManaged(start(createSeason(input)));
    const session = ready.lastManagedMatch!;
    const side: MatchSide = session.state.config.home.id === input.managedClubId ? 'home' : 'away';
    const runtime = session.state.teams[side];
    const dismissed = runtime.lineup.find(slot => slot.position === 'CB')!;
    // Isolated synthetic terminal checkpoint: exercise legal-XI repair when a
    // specialist bench player is explicitly unfit. Goals remain M2 event-derived.
    const reduced = { ...session, state: { ...session.state, teams: { ...session.state.teams, [side]: { ...runtime, lineup: runtime.lineup.filter(slot => slot.playerId !== dismissed.playerId) } } } };
    const checkpoint = { ...ready, activeMatch: reduced, lastManagedMatch: reduced };
    const committed = execute(checkpoint, { type: 'COMPLETE_ROUND' });
    expect(committed.teamSelections[input.managedClubId]!.lineup.some(slot => slot.playerId === unfit.id)).toBe(false);
    expect(committed.teamSelections[input.managedClubId]!.benchIds).toContain(unfit.id);
    expect(start(committed).status).toBe('playing');
  });
});

describe('abandonment policy', () => {
  function isolatedAbandonment(state: SeasonState): SeasonState {
    const session = state.activeMatch!;
    const match = { ...session.state, status: 'abandoned' as const, events: [...session.state.events, { id: session.state.events.length, minute: session.state.minute, type: 'ABANDONED' as const, team: 'home' as const, reason: 'fewer-than-seven' as const }] };
    const abandoned: SeasonMatchSession = { ...session, state: match };
    // Synthetic unit checkpoint only: isolates the rare abandonment recovery branch.
    return { ...state, status: 'blocked', activeMatch: abandoned, blockedFixtureId: session.fixtureId, abandonedMatches: [...state.abandonedMatches, abandoned] };
  }
  it('retries only abandoned fixtures with audited distinct seeds, and enforces the retry cap', () => {
    let state = start(createSeason(config()));
    const fixtureId = state.activeMatch!.fixtureId;
    const seeds = new Set([state.activeMatch!.state.config.seed]);
    for (let attempt = 1; attempt <= MAX_SEASON_ABANDONMENT_RETRIES; attempt++) {
      state = isolatedAbandonment(state);
      const prior = state;
      state = execute(state, { type: 'REPLAY_ABANDONED' });
      expect(state.activeMatch!.attempt).toBe(attempt);
      seeds.add(state.activeMatch!.state.config.seed);
      expect(state.results).toHaveLength(0);
      expect(state.abandonedMatches).toHaveLength(attempt);
      expect(prior.status).toBe('blocked');
    }
    expect(seeds.size).toBe(4);
    expect(getSeasonFixtureSeed(state, fixtureId, 3)).toBe(state.activeMatch!.state.config.seed);
    state = isolatedAbandonment(state);
    expect(applySeasonCommand(state, { type: 'REPLAY_ABANDONED' })).toMatchObject({ ok: false, error: { code: 'REPLAY_LIMIT' } });
    expect(applySeasonCommand(finishRound(createSeason(config())), { type: 'REPLAY_ABANDONED' })).toMatchObject({ ok: false, error: { code: 'NOT_ABANDONED' } });
  });
  it('keeps a blocked automatic round out of the table and preserves already-finished staged games on recovery', () => {
    const ready = finishManaged(start(createSeason(config())));
    const fixtures = getCurrentSeasonFixtures(ready);
    const managed = getManagedSeasonFixture(ready)!;
    const automatic = fixtures.filter(fixture => fixture.id !== managed.id);
    const first = automatic[0]!, abandoned = automatic[1]!;
    const completedAutomatic = replayMatch(getFixtureMatchConfig(ready, first), Array.from({ length: 6 }, () => ({ type: 'ADVANCE' as const })));
    const staged = [
      { fixtureId: managed.id, round: 1, status: 'finished' as const, summary: getMatchSummary(ready.lastManagedMatch!.state) },
      { fixtureId: first.id, round: 1, status: 'finished' as const, summary: getMatchSummary(completedAutomatic) },
    ];
    const checkpoint = { ...ready, activeMatch: { fixtureId: abandoned.id, attempt: 0, state: createMatch(getFixtureMatchConfig(ready, abandoned)) }, pendingResults: staged };
    const blocked = isolatedAbandonment(checkpoint);
    expect(getSeasonTable(blocked).every(row => row.played === 0)).toBe(true);
    expect(blocked.results).toHaveLength(0);
    const recovered = execute(blocked, { type: 'REPLAY_ABANDONED' });
    expect(recovered.status).toBe('round-ready');
    expect(recovered.activeMatch).toEqual(ready.lastManagedMatch);
    expect(recovered.pendingResults).toEqual(staged);
    expect(recovered.fixtureAttempts[abandoned.id]).toBe(1);
    const committed = execute(recovered, { type: 'COMPLETE_ROUND' });
    expect(committed.results).toHaveLength(10);
    expect(committed.results.find(result => result.fixtureId === first.id)).toEqual(staged[1]);
    expect(committed.pendingResults).toHaveLength(0);
    expect(getSeasonTable(committed).every(row => row.played === 1)).toBe(true);
  });
});

it('finishes and exactly replays a 380-match season with conserved standings and no 39th round', () => {
  const input = config(31415);
  let state = createSeason(input);
  while (state.status !== 'finished') state = finishRound(state);
  expect(state.results).toHaveLength(380);
  expect(new Set(state.results.map(result => result.fixtureId)).size).toBe(380);
  expect(state.roundIndex).toBe(38);
  expect(state.currentDate).toBe(state.fixtures.at(-1)!.date);
  const table = getSeasonTable(state);
  expect(table.every(row => row.played === 38)).toBe(true);
  expect(table.reduce((sum, row) => sum + row.played, 0)).toBe(760);
  expect(table.reduce((sum, row) => sum + row.goalDifference, 0)).toBe(0);
  expect(getCurrentSeasonFixtures(state)).toEqual([]);
  expect(getManagedSeasonFixture(state)).toBeNull();
  expect(applySeasonCommand(state, { type: 'ADVANCE_CALENDAR' })).toMatchObject({ ok: false, error: { code: 'SEASON_FINISHED' } });
  expect(replaySeason(input, state.commands)).toEqual(state);
}, 60_000);
