import { describe, expect, it } from 'vitest';
import { syntheticMatchConfig } from '../__tests__/match-fixtures';
import { applyMatchCommand, createMatch, positionalFamiliarity, replayMatch } from './engine';
import { getMatchSummary } from './projections';
import { FORMATION_POSITIONS } from './validation';
import type { MatchCommand, MatchState } from './types';

function execute(state: MatchState, command: MatchCommand): MatchState {
  const result = applyMatchCommand(state, command);
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.state;
}
function complete(state: MatchState): MatchState {
  while (state.status !== 'finished' && state.status !== 'abandoned') state = execute(state, { type: 'ADVANCE' });
  return state;
}

describe('authoritative deterministic match engine', () => {
  it('replays the complete match exactly from the same config, seed and commands', () => {
    const config = syntheticMatchConfig(42);
    const initial = createMatch(config);
    const untouched = structuredClone(initial);
    const finished = complete(initial);
    expect(finished.status).toBe('finished');
    expect(finished.minute).toBe(90);
    expect(finished.commands).toHaveLength(6);
    expect(replayMatch(config, finished.commands)).toEqual(finished);
    expect(initial).toEqual(untouched);
    expect(config.home.players[0]!.initialCondition).toBe(100);
    expect(finished.events.at(-1)?.type).toBe('FULL_TIME');
    expect(complete(createMatch(syntheticMatchConfig(43))).events).not.toEqual(finished.events);
  });

  it('derives goals, shooting, saves, passing, discipline and possession from the event stream', () => {
    const state = complete(createMatch(syntheticMatchConfig(12)));
    const { score, stats } = getMatchSummary(state);
    for (const side of ['home', 'away'] as const) {
      const opponent = side === 'home' ? 'away' : 'home';
      expect(score[side]).toBe(state.events.filter(event => event.type === 'GOAL' && event.team === side).length);
      expect(stats[side].shotsOnTarget).toBe(score[side] + stats[opponent].saves);
      expect(stats[side].shots).toBe(stats[side].chances);
      expect(stats[side].passesCompleted).toBeLessThanOrEqual(stats[side].passesAttempted);
      expect(stats[side].tacklesWon).toBeLessThanOrEqual(stats[side].tacklesAttempted);
      expect(stats[side].redCards).toBe(state.events.filter(event => event.type === 'CARD' && event.team === side && event.card !== 'yellow').length);
    }
    expect(stats.home.possession + stats.away.possession).toBeCloseTo(100);
    expect(state.events.every((event, index) => event.id === index && event.minute >= 0 && event.minute <= 90)).toBe(true);
    expect(state.events.every((event, index) => index === 0 || event.minute >= state.events[index - 1]!.minute)).toBe(true);
  });

  it('only lets active players act and removes a dismissal before the next football action', () => {
    const state = complete(createMatch(syntheticMatchConfig(75)));
    const active = { home: new Set(state.config.home.lineup.map(slot => slot.playerId)), away: new Set(state.config.away.lineup.map(slot => slot.playerId)) };
    for (const event of state.events) {
      if (!('team' in event)) continue;
      if ('playerId' in event && event.type !== 'FATIGUE') expect(active[event.team].has(event.playerId)).toBe(true);
      if (event.type === 'CARD' && event.card !== 'yellow') active[event.team].delete(event.playerId);
    }
    expect(active.home.size).toBe(state.teams.home.lineup.length);
    expect(active.away.size).toBe(state.teams.away.lineup.length);
  });

  it('rejects all commands after full time without changing state or the command log', () => {
    const finished = complete(createMatch(syntheticMatchConfig(9)));
    const rejected = applyMatchCommand(finished, { type: 'ADVANCE' });
    expect(rejected).toMatchObject({ ok: false, error: { code: 'MATCH_ENDED' } });
    expect(rejected.state).toBe(finished);
    expect(() => replayMatch(finished.config, [...finished.commands, { type: 'ADVANCE' }])).toThrow();
  });

  it('returns a rejected result for malformed tactical payloads instead of throwing', () => {
    const state = createMatch(syntheticMatchConfig(3));
    const malformed = { type: 'CHANGE_TACTICS', team: 'home', formation: '4-4-2', instructions: state.teams.home.instructions, lineup: [null] } as unknown as MatchCommand;
    expect(applyMatchCommand(state, malformed)).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
    expect(applyMatchCommand(state, malformed).state).toBe(state);
  });
});

describe('discipline and reduced sides', () => {
  it('sends a player off for a second yellow and never permits replacing the dismissed player', () => {
    let state = createMatch(syntheticMatchConfig(3668339987, { instructions: { pressingIntensity: 'high' } }, { instructions: { pressingIntensity: 'high' } }));
    while (state.minute < 45) state = execute(state, { type: 'ADVANCE' });
    const dismissal = state.events.find(event => event.type === 'CARD' && event.card === 'second-yellow');
    expect(dismissal).toBeDefined();
    if (!dismissal || dismissal.type !== 'CARD') throw new Error('Expected the known second-yellow scenario.');
    const team = state.teams[dismissal.team];
    expect(team.players[dismissal.playerId]).toMatchObject({ dismissed: true, yellowCards: 2 });
    expect(team.lineup).toHaveLength(10);
    expect(team.lineup.some(slot => slot.playerId === dismissal.playerId)).toBe(false);
    expect(applyMatchCommand(state, { type: 'SUBSTITUTE', team: dismissal.team, playerOutId: dismissal.playerId, playerInId: team.benchIds[0]! })).toMatchObject({ ok: false, error: { code: 'INVALID_OUTGOING' } });
    const changed = execute(state, { type: 'CHANGE_TACTICS', team: dismissal.team, formation: team.formation, instructions: { ...team.instructions, mentality: 'defensive' }, lineup: team.lineup });
    expect(changed.teams[dismissal.team].lineup).toHaveLength(10);
    expect(replayMatch(changed.config, changed.commands)).toEqual(changed);
  });

  it('abandons explicitly when a further dismissal leaves fewer than seven, preserving the played score', () => {
    const config = syntheticMatchConfig(2, { skill: 8, instructions: { pressingIntensity: 'high' } }, { skill: 8, instructions: { pressingIntensity: 'high' } });
    for (const player of config.home.players) { player.attributes.mental.aggression = 20; player.attributes.mental.decisions = 1; }
    // A synthetic reduced-side checkpoint isolates the rare five-dismissal branch.
    // It is a unit-test state, not a portable archive or a playable source record.
    const reduced = createMatch(config);
    const removed = reduced.teams.home.lineup.splice(7);
    for (const slot of removed) reduced.teams.home.players[slot.playerId]!.dismissed = true;
    const state = complete(reduced);
    expect(state.status).toBe('abandoned');
    expect(state.minute).toBeLessThan(90);
    expect(state.teams.home.lineup).toHaveLength(6);
    expect(state.events.at(-1)).toMatchObject({ type: 'ABANDONED', team: 'home', reason: 'fewer-than-seven' });
    expect(state.events.some(event => event.type === 'FULL_TIME')).toBe(false);
    const score = getMatchSummary(state).score;
    expect(score.home + score.away).toBe(state.events.filter(event => event.type === 'GOAL').length);
    expect(applyMatchCommand(state, { type: 'ADVANCE' })).toMatchObject({ ok: false, error: { code: 'MATCH_ENDED' } });
  });
});

describe('checkpoint decisions and substitution rules', () => {
  it('preserves all state on rejected commands and permits tactical changes only at checkpoints', () => {
    const state = createMatch(syntheticMatchConfig(4));
    const rejected = applyMatchCommand(state, { type: 'SUBSTITUTE', team: 'home', playerOutId: state.config.away.lineup[0]!.playerId, playerInId: state.teams.home.benchIds[0]! });
    expect(rejected).toMatchObject({ ok: false, error: { code: 'INVALID_OUTGOING' } });
    expect(rejected.state).toBe(state);
    expect(applyMatchCommand({ ...state, minute: 1 }, { type: 'ADVANCE' })).toMatchObject({ ok: false, error: { code: 'NOT_CHECKPOINT' } });
  });

  it('substitutes a fresh unused player, retains the outgoing slot and prevents reentry', () => {
    let state = createMatch(syntheticMatchConfig(5, { condition: 55 }));
    state = execute(state, { type: 'ADVANCE' });
    const outgoing = state.teams.home.lineup[1]!;
    const incoming = state.teams.home.benchIds[1]!;
    const substituted = execute(state, { type: 'SUBSTITUTE', team: 'home', playerOutId: outgoing.playerId, playerInId: incoming });
    expect(substituted.teams.home.lineup[1]).toEqual({ ...outgoing, playerId: incoming });
    expect(substituted.teams.home.players[incoming]!.condition).toBe(100);
    expect(substituted.teams.home.substitutionsUsed).toBe(1);
    expect(substituted.teams.home.substitutionWindowsUsed).toBe(1);
    expect(substituted.teams.home.benchIds).not.toContain(outgoing.playerId);
    expect(applyMatchCommand(substituted, { type: 'SUBSTITUTE', team: 'home', playerOutId: incoming, playerInId: outgoing.playerId })).toMatchObject({ ok: false, error: { code: 'INVALID_INCOMING' } });
    expect(replayMatch(substituted.config, substituted.commands)).toEqual(substituted);
  });

  it('allows several changes in one window, caps five players and does not count half time as a window', () => {
    let state = execute(createMatch(syntheticMatchConfig(6)), { type: 'ADVANCE' });
    for (let index = 0; index < 3; index++) state = execute(state, { type: 'SUBSTITUTE', team: 'home', playerOutId: state.teams.home.lineup[index + 1]!.playerId, playerInId: state.teams.home.benchIds[1]! });
    expect(state.teams.home.substitutionWindowsUsed).toBe(1);
    state = execute(execute(state, { type: 'ADVANCE' }), { type: 'ADVANCE' });
    expect(state.minute).toBe(45);
    for (let index = 0; index < 2; index++) state = execute(state, { type: 'SUBSTITUTE', team: 'home', playerOutId: state.teams.home.lineup[index + 5]!.playerId, playerInId: state.teams.home.benchIds[1]! });
    expect(state.teams.home.substitutionsUsed).toBe(5);
    expect(state.teams.home.substitutionWindowsUsed).toBe(1);
    expect(applyMatchCommand(state, { type: 'SUBSTITUTE', team: 'home', playerOutId: state.teams.home.lineup[9]!.playerId, playerInId: state.teams.home.benchIds[1]! })).toMatchObject({ ok: false, error: { code: 'SUBSTITUTION_LIMIT' } });
  });

  it('caps in-play windows and allows a later halftime-free substitution', () => {
    let state = createMatch(syntheticMatchConfig(87));
    for (const target of [15, 30, 60]) {
      while (state.minute < target) state = execute(state, { type: 'ADVANCE' });
      state = execute(state, { type: 'SUBSTITUTE', team: 'home', playerOutId: state.teams.home.lineup[state.teams.home.substitutionsUsed + 1]!.playerId, playerInId: state.teams.home.benchIds[1]! });
    }
    expect(state.teams.home.substitutionWindowsUsed).toBe(3);
    state = execute(state, { type: 'ADVANCE' });
    expect(applyMatchCommand(state, { type: 'SUBSTITUTE', team: 'home', playerOutId: state.teams.home.lineup[8]!.playerId, playerInId: state.teams.home.benchIds[1]! })).toMatchObject({ ok: false, error: { code: 'SUBSTITUTION_WINDOWS' } });
  });

  it('changes all five instruction settings and an entire formation without mutating the previous state', () => {
    const state = createMatch(syntheticMatchConfig(8));
    const before = structuredClone(state);
    const positions = FORMATION_POSITIONS['4-3-3'];
    const roles = { GK: 'goalkeeper', RB: 'fullBack', CB: 'centreBack', LB: 'fullBack', DM: 'defensiveMidfielder', CM: 'centralMidfielder', RW: 'winger', LW: 'winger', ST: 'striker' } as const;
    const lineup = state.teams.home.lineup.map((slot, index) => ({ ...slot, position: positions[index]!, role: roles[positions[index] as keyof typeof roles] }));
    const instructions = { mentality: 'attacking', tempo: 'fast', width: 'wide', pressingIntensity: 'high', defensiveLine: 'high' } as const;
    const changed = execute(state, { type: 'CHANGE_TACTICS', team: 'home', formation: '4-3-3', instructions, lineup });
    expect(changed.teams.home.formation).toBe('4-3-3');
    expect(changed.teams.home.instructions).toEqual(instructions);
    expect(state).toEqual(before);
    expect(replayMatch(state.config, changed.commands)).toEqual(changed);
    expect(complete(changed).events).not.toEqual(complete(state).events);
  });
});

describe('physical and positional inputs', () => {
  it('uses explicit conservative familiarity assumptions without changing the original positions', () => {
    expect(positionalFamiliarity({ positions: [] }, 'ST')).toBe(.85);
    expect(positionalFamiliarity({ positions: ['ST'] }, 'ST')).toBe(1);
    expect(positionalFamiliarity({ positions: ['ST'] }, 'AM')).toBe(.9);
    expect(positionalFamiliarity({ positions: ['ST'] }, 'CB')).toBe(.72);
    expect(positionalFamiliarity({ positions: ['ST'] }, 'GK')).toBe(.45);
  });

  it('decreases active condition, preserves unused substitutes and emits the exact resulting condition', () => {
    const state = complete(createMatch(syntheticMatchConfig(123)));
    for (const side of ['home', 'away'] as const) {
      for (const slot of state.teams[side].lineup) {
        const runtime = state.teams[side].players[slot.playerId]!;
        expect(runtime.condition).toBeGreaterThanOrEqual(0);
        expect(runtime.condition).toBeLessThan(100);
        const last = state.events.filter(event => event.type === 'FATIGUE' && event.playerId === slot.playerId).at(-1);
        expect(last).toMatchObject({ type: 'FATIGUE', condition: runtime.condition });
      }
      for (const id of state.teams[side].benchIds) expect(state.teams[side].players[id]!.condition).toBe(100);
    }
  });
});
