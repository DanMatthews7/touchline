import { describe, expect, it } from 'vitest';
import { applySeasonCommand, createSeason, type SeasonCommand, type SeasonState } from '../simulation/season';
import { getDemoClubView } from './club-view';
import { createDemoConfig, defaultDemoScenario } from './scenario';

function command(season: SeasonState, input: SeasonCommand): SeasonState {
  const result = applySeasonCommand(season, input);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}
function startMatch() {
  let state = createSeason(createDemoConfig({ ...defaultDemoScenario(), seed: 12345 }, 'demo-profile-test'));
  state = command(state, { type: 'START_MATCH' });
  return command(state, { type: 'MATCH_COMMAND', command: { type: 'ADVANCE' } });
}

describe('demo club and player projections', () => {
  it('shows the managed squad with configured starting inputs before play, without changing the season', () => {
    const season = createSeason(createDemoConfig({ ...defaultDemoScenario(), managedClubId: 'demo-club-07', initialCondition: 93, initialMorale: 65 }, 'demo-projection'));
    const before = structuredClone(season);
    const view = getDemoClubView(season);
    expect(view.team.name).toBe('Demo Club 07');
    expect(view.basis).toBe('Next match starting values');
    expect(view.players).toHaveLength(16);
    expect(view.players.filter(row => row.status === 'Starting XI')).toHaveLength(11);
    expect(view.players.filter(row => row.status === 'Bench')).toHaveLength(5);
    expect(view.players.every(row => row.condition === 93 && row.morale === 65)).toBe(true);
    expect(view.standing.played).toBe(0);
    expect(season).toEqual(before);
  });

  it('uses actual managed match condition, morale, position and substitution status at a checkpoint', () => {
    let season = startMatch();
    const match = season.activeMatch!.state;
    const side = match.config.home.id === season.config.managedClubId ? 'home' : 'away';
    const outgoing = match.teams[side].lineup.find(slot => slot.position === 'RB')!.playerId;
    const incoming = match.teams[side].benchIds[1]!;
    season = command(season, { type: 'MATCH_COMMAND', command: { type: 'SUBSTITUTE', team: side, playerOutId: outgoing, playerInId: incoming } });
    const view = getDemoClubView(season);
    const current = season.activeMatch!.state.teams[side];
    expect(view.basis).toBe('Live match values');
    expect(view.matchMinute).toBe(15);
    for (const row of view.players) {
      expect(row.condition).toBe(current.players[row.player.id]!.condition);
      expect(row.morale).toBe(current.players[row.player.id]!.morale);
    }
    expect(view.players.find(row => row.player.id === outgoing)!.status).toBe('Substituted');
    expect(view.players.find(row => row.player.id === incoming)!.assignment?.position).toBe('RB');
  });

  it('shows full-time values until round commit, then carried selection and reset next-match inputs', () => {
    let season = startMatch();
    const match = season.activeMatch!.state;
    const side = match.config.home.id === season.config.managedClubId ? 'home' : 'away';
    const outgoing = match.teams[side].lineup.find(slot => slot.position === 'RB')!.playerId;
    const incoming = match.teams[side].benchIds[1]!;
    season = command(season, { type: 'MATCH_COMMAND', command: { type: 'SUBSTITUTE', team: side, playerOutId: outgoing, playerInId: incoming } });
    while (season.status === 'playing') season = command(season, { type: 'MATCH_COMMAND', command: { type: 'ADVANCE' } });
    expect(season.status).toBe('round-ready');
    expect(getDemoClubView(season).basis).toBe('Full-time match values');
    season = command(season, { type: 'COMPLETE_ROUND' });
    const view = getDemoClubView(season);
    expect(view.basis).toBe('Next match starting values');
    expect(view.players.every(row => row.condition === 100 && row.morale === 50)).toBe(true);
    expect(view.players.find(row => row.player.id === outgoing)!.status).toBe('Bench');
    expect(view.players.find(row => row.player.id === incoming)!.status).toBe('Starting XI');
    expect(view.standing.played).toBe(1);
  });
});
