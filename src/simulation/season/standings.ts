import { SEASON_CLUB_COUNT, SEASON_ROUND_COUNT, type SeasonState, type SeasonTableRow } from './types';

const compareIds = (first: string, second: string): number => first < second ? -1 : first > second ? 1 : 0;
type TableInput = Pick<SeasonState, 'config' | 'fixtures' | 'results'>;

/** Only committed, full-time fixture results enter this 3/1/0 table; no match is simulated here. */
export function getSeasonTable(state: TableInput): SeasonTableRow[] {
  if (state.config.teams.length !== SEASON_CLUB_COUNT) throw new Error('A season table requires exactly 20 clubs.');
  const rows = new Map<string, SeasonTableRow>();
  for (const team of state.config.teams) {
    if (typeof team.id !== 'string' || !team.id.trim() || rows.has(team.id)) throw new Error('Season table club identifiers must be nonempty and unique.');
    rows.set(team.id, { position: 0, clubId: team.id, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 });
  }
  const fixtures = new Map<string, TableInput['fixtures'][number]>();
  for (const fixture of state.fixtures) {
    if (typeof fixture.id !== 'string' || !fixture.id.trim() || fixtures.has(fixture.id)) throw new Error('Season fixture identifiers must be nonempty and unique.');
    if (fixture.homeClubId === fixture.awayClubId || !rows.has(fixture.homeClubId) || !rows.has(fixture.awayClubId)) throw new Error('Every fixture must name two distinct season clubs.');
    if (!Number.isInteger(fixture.round) || fixture.round < 1 || fixture.round > SEASON_ROUND_COUNT) throw new Error('A fixture round must be from 1 to 38.');
    fixtures.set(fixture.id, fixture);
  }
  const recorded = new Set<string>();
  for (const result of state.results) {
    if (recorded.has(result.fixtureId)) throw new Error('A season fixture result can be counted only once.');
    recorded.add(result.fixtureId);
    const fixture = fixtures.get(result.fixtureId);
    if (!fixture) throw new Error('A season result references an unknown fixture.');
    if (result.round !== fixture.round) throw new Error('A result round must match its scheduled fixture.');
    if (result.status !== 'finished') throw new Error('Only full-time results enter the season table.');
    const score = result.summary?.score;
    if (!score || !Number.isSafeInteger(score.home) || score.home < 0 || !Number.isSafeInteger(score.away) || score.away < 0) throw new Error('Season scores must be nonnegative safe integers.');
    const home = rows.get(fixture.homeClubId)!;
    const away = rows.get(fixture.awayClubId)!;
    home.played++;
    away.played++;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;
    if (![home.goalsFor, home.goalsAgainst, away.goalsFor, away.goalsAgainst].every(Number.isSafeInteger)) throw new RangeError('Season goal totals exceed the safe integer range.');
    if (score.home > score.away) { home.won++; away.lost++; home.points += 3; }
    else if (score.home < score.away) { away.won++; home.lost++; away.points += 3; }
    else { home.drawn++; away.drawn++; home.points++; away.points++; }
  }
  const table = [...rows.values()];
  for (const row of table) row.goalDifference = row.goalsFor - row.goalsAgainst;
  table.sort((first, second) => second.points - first.points || second.goalDifference - first.goalDifference || second.goalsFor - first.goalsFor || compareIds(first.clubId, second.clubId));
  return table.map((row, index) => ({ ...row, position: index + 1 }));
}
