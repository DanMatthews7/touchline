import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_KEYS, type AttributeGroup, type PlayerAttributes } from '../../domain/attributes';
import type { PlayerRole, Position } from '../../domain/models';
import { commentaryForEvent, getMatchSummary } from './projections';
import type { MatchConfig, MatchEvent, MatchPlayer, MatchSide, MatchTeam } from './types';
import { FORMATION_POSITIONS, MatchValidationError, parseMatchCommand, parseMatchConfig, validateMatchConfig } from './validation';

const roles: Record<Position, PlayerRole> = {
  GK: 'goalkeeper', RB: 'fullBack', CB: 'centreBack', LB: 'fullBack', DM: 'defensiveMidfielder',
  CM: 'centralMidfielder', RM: 'wideMidfielder', LM: 'wideMidfielder', AM: 'attackingMidfielder',
  RW: 'winger', LW: 'winger', ST: 'striker',
};

/** Complete fictional inputs exist only in this explicitly synthetic automated fixture. */
function syntheticPlayer(id: string): MatchPlayer {
  const attributes = Object.fromEntries((Object.keys(ATTRIBUTE_KEYS) as AttributeGroup[])
    .map(group => [group, Object.fromEntries(ATTRIBUTE_KEYS[group].map(key => [key, 10]))])) as PlayerAttributes;
  return { id, name: `Synthetic ${id}`, attributes, positions: [], initialCondition: 100, initialMorale: 50 };
}

function syntheticTeam(side: MatchSide): MatchTeam {
  const players = Array.from({ length: 13 }, (_, index) => syntheticPlayer(`${side}-${index}`));
  return {
    id: side, name: `Synthetic ${side} test team`, players,
    formation: '4-4-2', lineup: FORMATION_POSITIONS['4-4-2'].map((position, index) => ({ playerId: players[index]!.id, position, role: roles[position] })),
    benchIds: players.slice(11).map(player => player.id),
    instructions: { mentality: 'balanced', tempo: 'standard', width: 'standard', pressingIntensity: 'standard', defensiveLine: 'standard' },
  };
}

function syntheticConfig(): MatchConfig {
  return { engineVersion: 1, id: 'synthetic-boundary-test', seed: 0, homeAdvantage: 0.08, assessmentMode: 'recorded-attributes', home: syntheticTeam('home'), away: syntheticTeam('away') };
}

describe('match configuration boundary', () => {
  it('accepts explicit unknown position familiarity and clones every mutable branch', () => {
    const input = syntheticConfig();
    const result = parseMatchConfig(input);
    expect(result).toEqual(input);
    expect(validateMatchConfig(result)).toEqual([]);
    result.home.players[0]!.attributes.technical.passing = 20;
    result.home.players[0]!.positions.push('GK');
    result.home.lineup[0]!.playerId = 'changed';
    result.home.benchIds.pop();
    result.home.instructions.tempo = 'fast';
    expect(input.home.players[0]!.attributes.technical.passing).toBe(10);
    expect(input.home.players[0]!.positions).toEqual([]);
    expect(input.home.lineup[0]!.playerId).toBe('home-0');
    expect(input.home.benchIds).toHaveLength(2);
    expect(input.home.instructions.tempo).toBe('standard');
  });

  it('accepts all supported formation geometries independently of lineup order', () => {
    for (const formation of Object.keys(FORMATION_POSITIONS) as (keyof typeof FORMATION_POSITIONS)[]) {
      const input = syntheticConfig();
      input.home.formation = formation;
      input.home.lineup = [...FORMATION_POSITIONS[formation]].reverse().map((position, index) => ({ playerId: input.home.players[index]!.id, position, role: roles[position] }));
      expect(validateMatchConfig(input)).toEqual([]);
    }
  });

  it.each([null, 0, [], 'config', undefined])('rejects a non-record root: %s', input => {
    expect(() => parseMatchConfig(input)).toThrow(MatchValidationError);
  });

  it('rejects unknown keys, symbols, hidden properties and inherited fields', () => {
    const extra = { ...syntheticConfig(), futureFeature: true };
    const symbolic = { ...syntheticConfig(), [Symbol('hidden')]: 1 };
    const hidden = Object.defineProperty(syntheticConfig(), 'hidden', { value: 1 });
    const inherited = Object.assign(Object.create({ homeAdvantage: 0.1 }) as Record<string, unknown>, syntheticConfig());
    const polluted = { ...syntheticConfig(), home: { ...syntheticConfig().home, ['__proto__']: {} } };
    for (const input of [extra, symbolic, hidden, inherited, polluted]) expect(() => parseMatchConfig(input)).toThrow(MatchValidationError);
    const nullPrototype: unknown = Object.assign(Object.create(null) as object, syntheticConfig());
    expect(parseMatchConfig(nullPrototype).id).toBe('synthetic-boundary-test');
  });

  it('rejects accessors without invoking them and reports hostile inspection safely', () => {
    let getterCalled = false;
    const accessor = Object.defineProperty(syntheticConfig(), 'seed', { enumerable: true, get: () => { getterCalled = true; return 0; } });
    expect(() => parseMatchConfig(accessor)).toThrow(MatchValidationError);
    expect(getterCalled).toBe(false);
    const proxy = new Proxy({}, { getPrototypeOf: () => { throw new Error('hostile inspection'); } });
    expect(() => parseMatchConfig(proxy)).toThrow(MatchValidationError);
    const descriptorOnly = new Proxy(syntheticConfig(), { get: () => { throw new Error('property reads are unsafe'); } });
    expect(parseMatchConfig(descriptorOnly)).toEqual(syntheticConfig());
  });

  it('requires explicit assessment mode and preserves the opt-in model disclaimer', () => {
    const input = syntheticConfig();
    input.assessmentMode = 'uniform-missing-10';
    expect(parseMatchConfig(input).assessmentMode).toBe('uniform-missing-10');
    const missing = { ...input } as Partial<MatchConfig>; delete missing.assessmentMode;
    expect(() => parseMatchConfig(missing)).toThrow(MatchValidationError);
    expect(() => parseMatchConfig({ ...input, assessmentMode: 'guessed' })).toThrow(MatchValidationError);
  });

  it('requires finite complete integer attributes without filling unknown values', () => {
    for (const value of [null, 0, 21, 10.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const input = syntheticConfig();
      input.home.players[0]!.attributes.technical.passing = value;
      expect(() => parseMatchConfig(input)).toThrow(MatchValidationError);
    }
    const missing = syntheticConfig();
    delete (missing.home.players[0]!.attributes.mental as Partial<typeof missing.home.players[0]['attributes']['mental']>).decisions;
    expect(() => parseMatchConfig(missing)).toThrow(MatchValidationError);
  });

  it('rejects out-of-range seeds, versions, advantage, condition and morale', () => {
    for (const seed of [-1, 0.5, 0x1_0000_0000, Number.NaN]) {
      expect(() => parseMatchConfig({ ...syntheticConfig(), seed })).toThrow(MatchValidationError);
    }
    for (const homeAdvantage of [-0.1, 0.201, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => parseMatchConfig({ ...syntheticConfig(), homeAdvantage })).toThrow(MatchValidationError);
    }
    expect(() => parseMatchConfig({ ...syntheticConfig(), engineVersion: 2 })).toThrow(MatchValidationError);
    for (const field of ['initialCondition', 'initialMorale'] as const) {
      for (const value of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
        const input = syntheticConfig();
        input.away.players[0]![field] = value;
        expect(() => parseMatchConfig(input)).toThrow(MatchValidationError);
      }
    }
    const boundary = syntheticConfig();
    boundary.seed = 0xffff_ffff;
    boundary.homeAdvantage = 0.2;
    boundary.home.players[11]!.initialCondition = 0;
    boundary.home.players[0]!.initialMorale = 0;
    expect(validateMatchConfig(boundary)).toEqual([]);
  });

  it('rejects duplicate identities across teams and repeated selection', () => {
    const sameTeam = syntheticConfig(); sameTeam.away.id = sameTeam.home.id;
    const shared = syntheticConfig(); shared.away.players[0]!.id = shared.home.players[0]!.id;
    const repeated = syntheticConfig(); repeated.home.lineup[1]!.playerId = repeated.home.lineup[0]!.playerId;
    const benchStarter = syntheticConfig(); benchStarter.home.benchIds[0] = benchStarter.home.lineup[0]!.playerId;
    const repeatedPlayer = syntheticConfig(); repeatedPlayer.home.players[1]!.id = repeatedPlayer.home.players[0]!.id;
    for (const input of [sameTeam, shared, repeated, benchStarter, repeatedPlayer]) expect(validateMatchConfig(input).length).toBeGreaterThan(0);
  });

  it('requires exactly the XI and bench, positive starter condition and one goalkeeper', () => {
    const shortXI = syntheticConfig(); shortXI.home.lineup.pop();
    const missing = syntheticConfig(); missing.home.lineup[0]!.playerId = 'absent';
    const extra = syntheticConfig(); extra.home.players.push(syntheticPlayer('home-extra'));
    const excessBench = syntheticConfig(); excessBench.home.benchIds = Array.from({ length: 10 }, (_, index) => `bench-${index}`);
    const unfit = syntheticConfig(); unfit.home.players[0]!.initialCondition = 0;
    const noKeeper = syntheticConfig(); noKeeper.home.lineup[0] = { playerId: 'home-0', position: 'ST', role: 'striker' };
    const twoKeepers = syntheticConfig(); twoKeepers.home.lineup[1] = { playerId: 'home-1', position: 'GK', role: 'goalkeeper' };
    for (const input of [shortXI, missing, extra, excessBench, unfit, noKeeper, twoKeepers]) expect(() => parseMatchConfig(input)).toThrow(MatchValidationError);
  });

  it('rejects invalid positions, incompatible roles, instructions and formation geometry', () => {
    const position = syntheticConfig(); (position.home.players[0]!.positions as string[]).push('sweeper');
    const repeatedPosition = syntheticConfig(); repeatedPosition.home.players[0]!.positions = ['GK', 'GK'];
    const incompatible = syntheticConfig(); incompatible.home.lineup[0]!.role = 'striker';
    const inheritedRole = syntheticConfig(); (inheritedRole.home.lineup[0] as unknown as Record<string, unknown>).role = 'constructor';
    const instruction = syntheticConfig(); (instruction.home.instructions as unknown as Record<string, unknown>).tempo = 'very-fast';
    const formation = syntheticConfig(); formation.home.formation = '4-3-3';
    for (const input of [position, repeatedPosition, incompatible, inheritedRole, instruction, formation]) expect(() => parseMatchConfig(input)).toThrow(MatchValidationError);
  });

  it('rejects sparse, extended and accessor arrays without running array accessors', () => {
    const sparse = syntheticConfig(); delete sparse.home.players[0];
    const extended = syntheticConfig(); Object.assign(extended.home.benchIds, { extra: true });
    let getterCalled = false;
    const accessor = syntheticConfig();
    Object.defineProperty(accessor.home.lineup, '0', { enumerable: true, get: () => { getterCalled = true; return {}; } });
    for (const input of [sparse, extended, accessor]) expect(() => parseMatchConfig(input)).toThrow(MatchValidationError);
    expect(getterCalled).toBe(false);
  });

  it('reports concrete paths without mutating rejected inputs', () => {
    const input = syntheticConfig(); input.home.players[2]!.attributes.technical.finishing = null;
    const before = structuredClone(input);
    const issues = validateMatchConfig(input);
    expect(issues).toContainEqual(expect.objectContaining({ path: 'home.players[2].attributes.technical.finishing' }));
    expect(input).toEqual(before);
    try { parseMatchConfig(input); } catch (error) {
      expect(error).toBeInstanceOf(MatchValidationError);
      expect((error as MatchValidationError).issues).toEqual(issues);
    }
  });
});

describe('match command boundary', () => {
  it('clones valid commands and permits reduced tactical lineups for engine eligibility checks', () => {
    expect(parseMatchCommand({ type: 'ADVANCE' })).toEqual({ type: 'ADVANCE' });
    expect(parseMatchCommand({ type: 'SUBSTITUTE', team: 'home', playerOutId: 'home-1', playerInId: 'home-11' })).toMatchObject({ type: 'SUBSTITUTE' });
    const team = syntheticTeam('home');
    const command = { type: 'CHANGE_TACTICS', team: 'home', formation: team.formation, instructions: team.instructions, lineup: team.lineup.slice(0, 7) };
    const parsed = parseMatchCommand(command);
    expect(parsed).toEqual(command);
    if (parsed.type !== 'CHANGE_TACTICS') throw new Error('Expected tactical command.');
    parsed.instructions.tempo = 'fast'; parsed.lineup[0]!.playerId = 'changed';
    expect(command.instructions.tempo).toBe('standard');
    expect(command.lineup[0]!.playerId).toBe('home-0');
  });

  it('rejects malformed commands before engine code can dereference nested slots', () => {
    const team = syntheticTeam('home');
    const tactics = { type: 'CHANGE_TACTICS', team: 'home', formation: team.formation, instructions: team.instructions, lineup: team.lineup };
    for (const command of [null, [], {}, { type: 'WAIT' }, { type: 'ADVANCE', extra: true },
      { type: 'SUBSTITUTE', team: 'other', playerOutId: 'home-1', playerInId: 'home-11' },
      { ...tactics, lineup: [null, ...team.lineup.slice(1)] },
      { ...tactics, instructions: null }, { ...tactics, formation: '1-1-1' },
      { ...tactics, lineup: team.lineup.slice(0, 6) },
    ]) expect(() => parseMatchCommand(command)).toThrow(MatchValidationError);
    let getterCalled = false;
    const accessor = Object.defineProperty({}, 'type', { enumerable: true, get: () => { getterCalled = true; return 'ADVANCE'; } });
    expect(() => parseMatchCommand(accessor)).toThrow(MatchValidationError);
    expect(getterCalled).toBe(false);
  });
});

type EventPayload = MatchEvent extends infer Event ? Event extends MatchEvent ? Omit<Event, 'id' | 'minute'> : never : never;
function events(...payloads: EventPayload[]): MatchEvent[] {
  return payloads.map((payload, index) => ({ ...payload, id: index, minute: index + 1 }));
}

describe('authoritative match projections', () => {
  it('derives goals, action counts, discipline and possession only from their events', () => {
    const stream = events(
      { type: 'KICKOFF', team: 'away' },
      { type: 'POSSESSION', team: 'home' }, { type: 'POSSESSION', team: 'home' }, { type: 'POSSESSION', team: 'away' },
      { type: 'PASS', team: 'home', playerId: 'home-1', recipientId: 'home-2', completed: true },
      { type: 'PASS', team: 'home', playerId: 'home-2', recipientId: 'home-1', completed: false },
      { type: 'TACKLE', team: 'away', playerId: 'away-1', opponentId: 'home-1', won: true },
      { type: 'TACKLE', team: 'away', playerId: 'away-2', opponentId: 'home-2', won: false },
      { type: 'CHANCE', team: 'home', playerId: 'home-1', quality: 0.4 },
      { type: 'SHOT', team: 'home', playerId: 'home-1', onTarget: true, expectedGoals: 0.3 },
      { type: 'SAVE', team: 'away', playerId: 'away-0', shooterId: 'home-1' },
      { type: 'SHOT', team: 'home', playerId: 'home-1', onTarget: false, expectedGoals: 0.1 },
      { type: 'GOAL', team: 'home', playerId: 'home-1' },
      { type: 'FOUL', team: 'away', playerId: 'away-1', fouledPlayerId: 'home-1' },
      { type: 'CARD', team: 'away', playerId: 'away-1', card: 'yellow' },
      { type: 'CARD', team: 'away', playerId: 'away-1', card: 'second-yellow' },
      { type: 'CARD', team: 'home', playerId: 'home-3', card: 'red' },
      { type: 'FATIGUE', team: 'home', playerId: 'home-1', condition: 42 },
      { type: 'CHECKPOINT' }, { type: 'FULL_TIME' },
    );
    const before = structuredClone(stream);
    const summary = getMatchSummary({ events: stream });
    expect(summary.score).toEqual({ home: 1, away: 0 });
    expect(summary.stats.home).toMatchObject({ passesAttempted: 2, passesCompleted: 1, chances: 1, shots: 2, shotsOnTarget: 1, expectedGoals: 0.4, redCards: 1, yellowCards: 0 });
    expect(summary.stats.away).toMatchObject({ tacklesAttempted: 2, tacklesWon: 1, saves: 1, fouls: 1, yellowCards: 2, redCards: 1 });
    expect(summary.stats.home.possession).toBeCloseTo(200 / 3);
    expect(summary.stats.home.possession + summary.stats.away.possession).toBe(100);
    expect(stream).toEqual(before);
    expect(getMatchSummary({ events: stream })).toEqual(summary);
  });

  it('uses balanced possession before any possession event and returns fresh projections', () => {
    const first = getMatchSummary({ events: [] });
    expect(first.score).toEqual({ home: 0, away: 0 });
    expect(first.stats.home.possession).toBe(50);
    expect(first.stats.away.possession).toBe(50);
    first.score.home = 100; first.stats.home.shots = 100;
    expect(getMatchSummary({ events: [] }).stats.home.shots).toBe(0);
    expect(getMatchSummary({ events: [] }).score.home).toBe(0);
  });

  it('renders every event type from its payload and names without inventing a result', () => {
    const config = syntheticConfig();
    const stream = events(
      { type: 'KICKOFF', team: 'home' }, { type: 'POSSESSION', team: 'away' },
      { type: 'PASS', team: 'home', playerId: 'home-1', recipientId: 'home-2', completed: true },
      { type: 'TACKLE', team: 'home', playerId: 'home-1', opponentId: 'away-2', won: false },
      { type: 'CHANCE', team: 'away', playerId: 'away-1', quality: 0.2 },
      { type: 'SHOT', team: 'away', playerId: 'away-1', onTarget: false, expectedGoals: 0.1 },
      { type: 'SAVE', team: 'home', playerId: 'home-0', shooterId: 'away-1' },
      { type: 'GOAL', team: 'home', playerId: 'home-1' },
      { type: 'FOUL', team: 'home', playerId: 'home-1', fouledPlayerId: 'away-1' },
      { type: 'CARD', team: 'home', playerId: 'home-1', card: 'second-yellow' },
      { type: 'FATIGUE', team: 'home', playerId: 'home-1', condition: 72.25 },
      { type: 'SUBSTITUTION', team: 'home', playerOutId: 'home-1', playerInId: 'home-11' },
      { type: 'TACTICS_CHANGED', team: 'away', formation: '4-3-3', instructions: config.away.instructions },
      { type: 'CHECKPOINT' }, { type: 'FULL_TIME' },
      { type: 'ABANDONED', team: 'away', reason: 'fewer-than-seven' },
    );
    const lines = stream.map(event => commentaryForEvent({ config }, event));
    expect(lines.every((line, index) => line.startsWith(`${index + 1}′ `) && !line.includes('undefined'))).toBe(true);
    expect(lines[4]).toContain('Synthetic away-1 has a chance');
    expect(lines[5]).toContain('off target');
    expect(lines[7]).toContain('Synthetic home-1 scores');
    expect(lines[9]).toContain('second yellow');
    expect(lines[11]).toContain('Synthetic home-11');
    expect(lines[12]).toContain('4-3-3');
    expect(lines[14]).toBe('15′ Full time.');
    expect(lines[15]).toContain('fewer than seven');
    expect(commentaryForEvent({ config }, stream[7]!)).toBe(lines[7]);
  });
});
