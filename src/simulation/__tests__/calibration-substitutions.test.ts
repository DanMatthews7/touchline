/** SYNTHETIC AUTOMATED TESTS ONLY. Regression fixtures never enter application UI or data. */
import { describe, expect, it } from 'vitest';
import { createMatch } from '../match';
import { selectSubstituteOutgoingPlayers, substituteFreshPlayers } from './calibration-harness';
import { syntheticMatchConfig } from './match-fixtures';

describe('calibration substitution treatment after dismissals', () => {
  it('still replaces three eligible outfield players when a dismissal shortened the current lineup', () => {
    const state = createMatch(syntheticMatchConfig(42));
    const team = state.teams.home;
    const dismissed = team.lineup.find(slot => slot.role === 'centreBack')!.playerId;
    team.players[dismissed]!.dismissed = true;
    team.lineup = team.lineup.filter(slot => slot.playerId !== dismissed);
    expect(team.lineup).toHaveLength(10);
    const before = structuredClone(state);
    const result = substituteFreshPlayers(state);
    expect(result.teams.home.substitutionsUsed).toBe(3);
    expect(result.teams.home.lineup).toHaveLength(10);
    const replacements = result.events.filter(event => event.type === 'SUBSTITUTION');
    expect(replacements).toHaveLength(3);
    expect(replacements.every(event => event.type === 'SUBSTITUTION' && event.playerOutId !== dismissed)).toBe(true);
    expect(state).toEqual(before);
  });

  it('fills a missing role group from other eligible outfield players without choosing the goalkeeper', () => {
    const team = createMatch(syntheticMatchConfig(43)).teams.home;
    team.lineup = team.lineup.filter(slot => slot.role !== 'striker');
    const selected = selectSubstituteOutgoingPlayers(team);
    expect(selected).toHaveLength(3);
    expect(new Set(selected).size).toBe(3);
    expect(selected.every(id => team.lineup.some(slot => slot.playerId === id && slot.position !== 'GK'))).toBe(true);
  });

  it('selects only the available eligible outfield players when fewer than three remain', () => {
    const team = createMatch(syntheticMatchConfig(44)).teams.home;
    team.lineup = team.lineup.slice(0, 3);
    expect(selectSubstituteOutgoingPlayers(team)).toHaveLength(2);
    const unavailable = team.lineup.find(slot => slot.position !== 'GK')!.playerId;
    team.players[unavailable]!.dismissed = true;
    const selected = selectSubstituteOutgoingPlayers(team);
    expect(selected).toHaveLength(1);
    expect(selected).not.toContain(unavailable);
  });
});
