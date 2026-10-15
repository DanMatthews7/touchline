import { describe, expect, it } from 'vitest';
import type { Club, GameState } from '../domain/models';
import { applyCommand, createGameState, isDateOnly, type GameCommand } from './commands';
import { createSeededRandom, initialRandomState, nextRandom } from './random';

const timestamp = '2026-10-15T12:00:00.000Z';
const club: Club = { id: 'test-club', name: 'Synthetic Test Club', shortName: 'TEST', country: 'Test country', stadium: null, primaryColor: null, finances: null, dataStatus: { validation: 'needs-review', completeness: 'partial', notes: ['Synthetic automated-test fixture.'] }, provenance: [] };
const snapshot = { id: 'test-snapshot', clubs: [club] };
const initial = (startDate = '2026-07-01'): GameState => createGameState({ id: 'test-career', databaseSnapshotId: snapshot.id, startDate, seed: 42, createdAt: timestamp });
const select: GameCommand = { type: 'SELECT_CLUB', clubId: 'test-club', issuedAt: timestamp };
const advance: GameCommand = { type: 'ADVANCE_DAY', issuedAt: timestamp };
function replay(state: GameState, commands: GameCommand[]): GameState {
  return commands.reduce((current, command) => {
    const result = applyCommand(current, command, snapshot);
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  }, state);
}

describe('deterministic seeded randomness', () => {
  it('reproduces sequences and allows exact continuation from a saved state', () => {
    const first = createSeededRandom(42);
    const second = createSeededRandom(42);
    const values = Array.from({ length: 20 }, () => first.next());
    expect(Array.from({ length: 20 }, () => second.next())).toEqual(values);
    expect(values.every(value => value >= 0 && value < 1)).toBe(true);
    expect(nextRandom(first.getState()).value).toBe(first.next());
    expect(createSeededRandom(43).next()).not.toBe(values[0]);
  });

  it('handles seed zero reproducibly and rejects invalid seed/state values', () => {
    expect(createSeededRandom(0).next()).toBe(createSeededRandom(0).next());
    expect(initialRandomState(0)).not.toBe(0);
    expect(() => createSeededRandom(-1)).toThrow();
    expect(() => nextRandom(0)).toThrow();
    expect(() => createSeededRandom(1).nextInt(0)).toThrow();
  });

  it('returns bounded integers without consuming ambient randomness', () => {
    const generator = createSeededRandom(100);
    const draws = Array.from({ length: 100 }, () => generator.nextInt(7));
    expect(draws.every(value => Number.isInteger(value) && value >= 0 && value < 7)).toBe(true);
    expect(new Set(draws).size).toBe(7);
  });

  it('includes zero in the integer output domain even at the maximum supported bound', () => {
    // This seed advances to xorshift32 state 1; the integer sample must map to zero.
    expect(createSeededRandom(4071982377).nextInt(0xffff_ffff)).toBe(0);
    expect(createSeededRandom(42).nextInt(1)).toBe(0);
    expect(() => createSeededRandom(42).nextInt(0x1_0000_0000)).toThrow();
  });
});

describe('explicit career transitions', () => {
  it('replays the same initial state, seed and commands without mutating inputs', () => {
    const state = initial();
    const before = structuredClone(state);
    const commands = [select, advance, advance];
    const result = replay(state, commands);
    expect(result).toEqual(replay(initial(), commands));
    expect(state).toEqual(before);
    expect(result.currentDate).toBe('2026-07-03');
    expect(result.managedClubId).toBe('test-club');
    expect(result.simulation.commandCount).toBe(3);
    expect(result.simulation.randomState).toBe(state.simulation.randomState);
  });

  it('advances through leap days and year boundaries in UTC', () => {
    expect(replay(initial('2028-02-28'), [select, advance]).currentDate).toBe('2028-02-29');
    expect(replay(initial('2028-02-28'), [select, advance, advance]).currentDate).toBe('2028-03-01');
    expect(replay(initial('2026-12-31'), [select, advance]).currentDate).toBe('2027-01-01');
  });

  it('rejects impossible calendar dates', () => {
    expect(isDateOnly('2026-02-30')).toBe(false);
    expect(isDateOnly('2026-02-29')).toBe(false);
    expect(isDateOnly('2028-02-29')).toBe(true);
    expect(() => initial('2026-02-30')).toThrow();
  });

  it('rejects unknown clubs, calendar advancement before selection and club switching', () => {
    expect(applyCommand(initial(), { ...select, clubId: 'missing-club' }, snapshot)).toMatchObject({ ok: false, error: { code: 'UNKNOWN_CLUB' } });
    expect(applyCommand(initial(), advance, snapshot)).toMatchObject({ ok: false, error: { code: 'NO_CLUB_SELECTED' } });
    const selected = replay(initial(), [select]);
    expect(applyCommand(selected, select, snapshot)).toMatchObject({ ok: false, error: { code: 'CLUB_ALREADY_SELECTED' } });
  });

  it('rejects mismatched starting databases and nonmonotonic timestamps without changing state', () => {
    const state = initial();
    const rejected = applyCommand(state, select, { ...snapshot, id: 'another-snapshot' });
    expect(rejected).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(rejected.state).toBe(state);
    expect(applyCommand(state, { ...select, issuedAt: '2026-10-14T12:00:00.000Z' }, snapshot)).toMatchObject({ ok: false, error: { code: 'INVALID_COMMAND' } });
  });

  it('accepts imported UTC timestamps without milliseconds and orders them by time', () => {
    const state = { ...initial(), createdAt: '2026-10-15T12:00:00Z', updatedAt: '2026-10-15T12:00:00Z' };
    expect(applyCommand(state, { ...select, issuedAt: '2026-10-15T12:00:00.001Z' }, snapshot)).toMatchObject({ ok: true });
    expect(applyCommand(initial(), { ...select, issuedAt: '2026-10-15T12:00:00Z' }, snapshot)).toMatchObject({ ok: true });
  });
});
