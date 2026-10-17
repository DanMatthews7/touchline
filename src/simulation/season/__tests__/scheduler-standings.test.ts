/** SYNTHETIC AUTOMATED TESTS ONLY. No invented clubs or score fixtures enter application UI/data. */
import { describe, expect, it } from 'vitest';
import type { MatchStats } from '../../match/types';
import { syntheticMatchTeam } from '../../__tests__/match-fixtures';
import { addSeasonDays, generateSeasonFixtures, getRoundFixtures } from '../scheduler';
import { getSeasonTable } from '../standings';
import type { SeasonConfig, SeasonFixture, SeasonResult } from '../types';

function syntheticConfig(): SeasonConfig {
  return {
    engineVersion: 1, matchEngineVersion: 1,
    id: 'synthetic-automated-season', careerId: 'synthetic-automated-career',
    name: 'SYNTHETIC AUTOMATED TEST SEASON ONLY', startDate: '2026-07-01', firstMatchDate: '2026-08-08',
    seed: 42, managedClubId: 'synthetic-test-club-00',
    teams: Array.from({ length: 20 }, (_, index) => syntheticMatchTeam(`synthetic-test-club-${String(index).padStart(2, '0')}`)),
    assessmentMode: 'recorded-attributes', homeAdvantage: 0.04,
  };
}

const emptyStats = (): MatchStats => ({ possession: 50, passesAttempted: 0, passesCompleted: 0, tacklesAttempted: 0, tacklesWon: 0, chances: 0, shots: 0, shotsOnTarget: 0, expectedGoals: 0, saves: 0, fouls: 0, yellowCards: 0, redCards: 0 });
/** Table-arithmetic examples only; these hand-authored scores do not claim match-engine simulation. */
function score(fixture: SeasonFixture, home: number, away: number): SeasonResult {
  return { fixtureId: fixture.id, round: fixture.round, status: 'finished', summary: { score: { home, away }, stats: { home: emptyStats(), away: emptyStats() } } };
}

describe('20-club double round-robin schedule', () => {
  it('covers all 380 ordered pairings in 38 complete, weekly UTC matchweeks', () => {
    const config = syntheticConfig();
    const before = structuredClone(config);
    const fixtures = generateSeasonFixtures(config);
    expect(config).toEqual(before);
    expect(fixtures).toHaveLength(380);
    expect(new Set(fixtures.map(fixture => fixture.id)).size).toBe(380);
    expect(new Set(fixtures.map(fixture => fixture.seed)).size).toBe(380);
    expect(new Set(fixtures.map(fixture => `${fixture.homeClubId}|${fixture.awayClubId}`)).size).toBe(380);
    expect(new Set(fixtures.map(fixture => fixture.date)).size).toBe(38);
    for (let round = 1; round <= 38; round++) {
      const matchweek = getRoundFixtures(fixtures, round);
      expect(matchweek).toHaveLength(10);
      expect(new Set(matchweek.flatMap(fixture => [fixture.homeClubId, fixture.awayClubId])).size).toBe(20);
      expect(matchweek.every(fixture => fixture.homeClubId !== fixture.awayClubId && fixture.date === addSeasonDays(config.firstMatchDate, (round - 1) * 7))).toBe(true);
      expect(matchweek[0]!.id).toBe(`${config.id}:r${String(round).padStart(2, '0')}:m01`);
      expect(matchweek[9]!.id).toBe(`${config.id}:r${String(round).padStart(2, '0')}:m10`);
    }
    for (const club of config.teams) {
      const games = fixtures.filter(fixture => fixture.homeClubId === club.id || fixture.awayClubId === club.id);
      expect(games).toHaveLength(38);
      expect(games.filter(fixture => fixture.homeClubId === club.id)).toHaveLength(19);
      expect(games.filter(fixture => fixture.awayClubId === club.id)).toHaveLength(19);
      const opponents = games.map(fixture => fixture.homeClubId === club.id ? fixture.awayClubId : fixture.homeClubId);
      expect(new Set(opponents).size).toBe(19);
      for (const opponent of new Set(opponents)) expect(opponents.filter(id => id === opponent)).toHaveLength(2);
      const firstLegHomes = games.filter(fixture => fixture.round <= 19 && fixture.homeClubId === club.id).length;
      expect([9, 10]).toContain(firstLegHomes);
      const venues = games.map(fixture => fixture.homeClubId === club.id ? 'H' : 'A').join('');
      expect(Math.max(...[...venues.matchAll(/H+|A+/g)].map(match => match[0].length))).toBeLessThanOrEqual(3);
    }
    for (let round = 1; round <= 19; round++) {
      const first = getRoundFixtures(fixtures, round);
      const returning = getRoundFixtures(fixtures, round + 19);
      expect(returning.map(fixture => [fixture.homeClubId, fixture.awayClubId])).toEqual(first.map(fixture => [fixture.awayClubId, fixture.homeClubId]));
    }
    expect(fixtures[0]!.seed).toBe(2_654_435_803);
    expect(fixtures.at(-1)!.date).toBe('2027-04-24');
  });

  it('reproduces fixtures across input permutations and changes only fixture seeds for a new season seed', () => {
    const config = syntheticConfig();
    const fixtures = generateSeasonFixtures(config);
    expect(generateSeasonFixtures({ ...config, teams: [...config.teams].reverse() })).toEqual(fixtures);
    const alternate = generateSeasonFixtures({ ...config, seed: 43 });
    expect(alternate.map(({ seed: _seed, ...fixture }) => fixture)).toEqual(fixtures.map(({ seed: _seed, ...fixture }) => fixture));
    expect(alternate.every((fixture, index) => fixture.seed !== fixtures[index]!.seed)).toBe(true);
    const reversed = [...fixtures].reverse();
    expect(getRoundFixtures(reversed, 20)).toEqual(getRoundFixtures(fixtures, 20));
    expect(reversed).toEqual([...fixtures].reverse());
  });

  it('rejects duplicate clubs, the wrong league size, invalid seeds and invalid round selectors', () => {
    const config = syntheticConfig();
    expect(() => generateSeasonFixtures({ ...config, teams: config.teams.slice(1) })).toThrow('exactly 20');
    expect(() => generateSeasonFixtures({ ...config, teams: [...config.teams.slice(1), config.teams[1]!] })).toThrow('unique');
    for (const seed of [-1, 1.5, 0x1_0000_0000, Number.NaN]) expect(() => generateSeasonFixtures({ ...config, seed })).toThrow('unsigned');
    expect(generateSeasonFixtures({ ...config, seed: 0 })).toHaveLength(380);
    expect(generateSeasonFixtures({ ...config, seed: 0xffff_ffff })).toHaveLength(380);
    for (const round of [0, 39, 1.5]) expect(() => getRoundFixtures([], round)).toThrow('1 to 38');
  });

  it('handles leap days, year boundaries and signed offsets without normalizing impossible dates', () => {
    expect(addSeasonDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addSeasonDays('2028-02-28', 2)).toBe('2028-03-01');
    expect(addSeasonDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addSeasonDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addSeasonDays('2026-07-01', 0)).toBe('2026-07-01');
    for (const invalid of ['2026-02-29', '2028-02-30', '2026-13-01', '2026-2-01']) expect(() => addSeasonDays(invalid, 1)).toThrow('valid');
    expect(() => addSeasonDays('2026-07-01', 0.5)).toThrow('integer');
    expect(() => addSeasonDays('9999-12-31', 1)).toThrow('four-digit');
    expect(() => addSeasonDays('0000-01-01', -1)).toThrow('four-digit');
    expect(() => addSeasonDays('2026-07-01', Number.MAX_SAFE_INTEGER)).toThrow('four-digit');
    expect(() => generateSeasonFixtures({ ...syntheticConfig(), firstMatchDate: '9999-12-31' })).toThrow('four-digit');
  });
});

describe('committed season standings', () => {
  function setup() {
    const config = syntheticConfig();
    const fixtures = generateSeasonFixtures(config);
    const fixture = (home: number, away: number) => fixtures.find(match => match.homeClubId === config.teams[home]!.id && match.awayClubId === config.teams[away]!.id)!;
    return { config, fixtures, fixture };
  }

  it('begins with all 20 clubs at zero, ordered by stable identifier', () => {
    const { config, fixtures } = setup();
    const table = getSeasonTable({ config: { ...config, teams: [...config.teams].reverse() }, fixtures, results: [] });
    expect(table.map(row => row.clubId)).toEqual(config.teams.map(team => team.id));
    expect(table.map(row => row.position)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(table.every(row => row.played === 0 && row.points === 0 && row.goalsFor === 0 && row.goalsAgainst === 0)).toBe(true);
  });

  it('counts only supplied full-time results and awards home wins, draws and away wins correctly', () => {
    const { config, fixtures, fixture } = setup();
    const input = { config, fixtures, results: [score(fixture(0, 1), 3, 0), score(fixture(2, 3), 1, 1), score(fixture(4, 5), 0, 2)] };
    const before = structuredClone(input);
    const table = getSeasonTable(input);
    const row = (club: number) => table.find(entry => entry.clubId === config.teams[club]!.id)!;
    expect(row(0)).toMatchObject({ played: 1, won: 1, drawn: 0, lost: 0, points: 3, goalsFor: 3, goalsAgainst: 0, goalDifference: 3 });
    expect(row(1)).toMatchObject({ played: 1, won: 0, drawn: 0, lost: 1, points: 0, goalsFor: 0, goalsAgainst: 3, goalDifference: -3 });
    expect(row(2)).toMatchObject({ played: 1, drawn: 1, points: 1, goalsFor: 1, goalsAgainst: 1 });
    expect(row(3)).toMatchObject({ played: 1, drawn: 1, points: 1 });
    expect(row(5)).toMatchObject({ played: 1, won: 1, points: 3, goalsFor: 2, goalsAgainst: 0 });
    expect(row(6)).toMatchObject({ played: 0, points: 0 });
    expect(input).toEqual(before);
    expect(getSeasonTable({ ...input, results: [...input.results].reverse(), fixtures: [...fixtures].reverse() })).toEqual(table);
  });

  it('orders by points, goal difference, goals scored, then locale-independent stable club ID', () => {
    const { config, fixtures, fixture } = setup();
    const results = [score(fixture(0, 7), 3, 1), score(fixture(1, 8), 2, 0), score(fixture(2, 9), 4, 3), score(fixture(3, 10), 3, 1), score(fixture(4, 11), 4, 4), score(fixture(4, 12), 4, 4)];
    const table = getSeasonTable({ config, fixtures, results });
    expect(table.slice(0, 5).map(row => row.clubId)).toEqual([0, 3, 1, 2, 4].map(index => config.teams[index]!.id));
    expect(table[4]).toMatchObject({ points: 2, goalsFor: 8 });
  });

  it('preserves league totals after all 380 arithmetic fixture results', () => {
    const { config, fixtures } = setup();
    const results = fixtures.map((fixture, index) => score(fixture, index % 5, (index * 3 + 1) % 4));
    const table = getSeasonTable({ config, fixtures, results });
    expect(table).toHaveLength(20);
    for (const row of table) {
      expect(row.played).toBe(38);
      expect(row.won + row.drawn + row.lost).toBe(38);
      expect(row.points).toBe(3 * row.won + row.drawn);
      expect(row.goalDifference).toBe(row.goalsFor - row.goalsAgainst);
    }
    const total = (read: (row: typeof table[number]) => number) => table.reduce((sum, row) => sum + read(row), 0);
    expect(total(row => row.played)).toBe(760);
    expect(total(row => row.goalDifference)).toBe(0);
    expect(total(row => row.goalsFor)).toBe(total(row => row.goalsAgainst));
    expect(total(row => row.goalsFor)).toBe(results.reduce((sum, result) => sum + result.summary.score.home + result.summary.score.away, 0));
    const draws = results.filter(result => result.summary.score.home === result.summary.score.away).length;
    expect(total(row => row.points)).toBe(3 * 380 - draws);
  });

  it('rejects duplicate, unknown, mismatched and unfinished fixture results', () => {
    const { config, fixtures } = setup();
    const result = score(fixtures[0]!, 1, 0);
    const table = (results: SeasonResult[]) => getSeasonTable({ config, fixtures, results });
    expect(() => table([result, result])).toThrow('only once');
    expect(() => table([{ ...result, fixtureId: 'unknown-synthetic-fixture' }])).toThrow('unknown fixture');
    expect(() => table([{ ...result, round: result.round + 1 }])).toThrow('round');
    expect(() => table([{ ...result, status: 'abandoned' } as unknown as SeasonResult])).toThrow('full-time');
    for (const invalid of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => table([score(fixtures[0]!, invalid, 0)])).toThrow('safe integers');
      expect(() => table([score(fixtures[0]!, 0, invalid)])).toThrow('safe integers');
    }
  });

  it('rejects invalid fixture relationships and unsafe aggregate goal totals', () => {
    const { config, fixtures, fixture } = setup();
    expect(() => getSeasonTable({ config: { ...config, teams: config.teams.slice(1) }, fixtures, results: [] })).toThrow('exactly 20');
    expect(() => getSeasonTable({ config: { ...config, teams: config.teams.map((team, index) => index === 0 ? { ...team, id: ' ' } : team) }, fixtures, results: [] })).toThrow('nonempty');
    expect(() => getSeasonTable({ config: { ...config, teams: [...config.teams.slice(1), config.teams[1]!] }, fixtures, results: [] })).toThrow('unique');
    expect(() => getSeasonTable({ config, fixtures: [fixtures[0]!, fixtures[0]!], results: [] })).toThrow('unique');
    expect(() => getSeasonTable({ config, fixtures: [{ ...fixtures[0]!, awayClubId: 'absent-synthetic-club' }], results: [] })).toThrow('two distinct');
    expect(() => getSeasonTable({ config, fixtures: [{ ...fixtures[0]!, awayClubId: fixtures[0]!.homeClubId }], results: [] })).toThrow('two distinct');
    expect(() => getSeasonTable({ config, fixtures, results: [score(fixture(0, 1), Number.MAX_SAFE_INTEGER, 0), score(fixture(0, 2), 1, 0)] })).toThrow('safe integer range');
  });
});
