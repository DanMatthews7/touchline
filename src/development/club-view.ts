import type { MatchLineupSlot, MatchPlayer, MatchSide, MatchState } from '../simulation/match';
import { getManagedSeasonFixture, getSeasonTable, type SeasonState } from '../simulation/season';

export interface DemoPlayerView {
  player: MatchPlayer;
  assignment: MatchLineupSlot | undefined;
  status: 'Starting XI' | 'Bench' | 'Substituted' | 'Dismissed' | 'Not selected';
  condition: number;
  morale: number;
  yellowCards: number;
}

function managedSide(match: MatchState, clubId: string): MatchSide | null {
  return match.config.home.id === clubId ? 'home' : match.config.away.id === clubId ? 'away' : null;
}

/** Read-only projection of the same team and match state used by the season engine. */
export function getDemoClubView(season: SeasonState) {
  const clubId = season.config.managedClubId;
  const team = season.config.teams.find(candidate => candidate.id === clubId);
  const selection = season.teamSelections[clubId];
  if (!team || !selection) throw new Error('The managed demo club is missing from this season.');

  let match = season.activeMatch?.state ?? null;
  if (match && managedSide(match, clubId) === null) match = null;
  // An opposition abandonment may be active while our completed match is still
  // awaiting the round commit. Retain our actual report, not next-match inputs.
  const last = season.lastManagedMatch;
  const lastFixture = last && season.fixtures.find(fixture => fixture.id === last.fixtureId);
  if (!match && last && lastFixture && (lastFixture.round > season.roundIndex || season.status === 'finished')) match = last.state;
  const side = match && managedSide(match, clubId);
  const runtime = match && side ? match.teams[side] : null;
  const currentSelection = runtime ?? selection;
  const basis = match && runtime
    ? season.status === 'finished' ? 'Final match values' : match.status === 'finished' ? 'Full-time match values' : match.status === 'abandoned' ? 'Abandoned match values' : 'Live match values'
    : 'Next match starting values';
  const players: DemoPlayerView[] = team.players.map(player => {
    const current = runtime?.players[player.id];
    const assignment = currentSelection.lineup.find(slot => slot.playerId === player.id);
    return {
      player, assignment,
      status: current?.dismissed ? 'Dismissed' : assignment ? 'Starting XI' : currentSelection.benchIds.includes(player.id) ? 'Bench' : runtime ? 'Substituted' : 'Not selected',
      condition: current?.condition ?? player.initialCondition,
      morale: current?.morale ?? player.initialMorale,
      yellowCards: current?.yellowCards ?? 0,
    };
  });
  return {
    team, players, selection: currentSelection, basis,
    matchMinute: match?.minute ?? null,
    standing: getSeasonTable(season).find(row => row.clubId === clubId)!,
    nextFixture: season.status === 'finished' ? null : getManagedSeasonFixture(season),
  };
}
