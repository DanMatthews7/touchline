import { isDateOnly } from '../commands';
import { isRandomState } from '../random';
import { SEASON_CLUB_COUNT, SEASON_ROUND_COUNT, type SeasonConfig, type SeasonFixture } from './types';

const FIXTURES_PER_ROUND = SEASON_CLUB_COUNT / 2;
const FIRST_LEG_ROUNDS = SEASON_CLUB_COUNT - 1;
const FIXTURE_SEED_STEP = 0x9e3779b1;
const compareIds = (first: string, second: string): number => first < second ? -1 : first > second ? 1 : 0;

/** UTC calendar arithmetic; never normalize an impossible input or silently leave YYYY-MM-DD. */
export function addSeasonDays(date: string, days: number): string {
  if (!isDateOnly(date)) throw new RangeError('Season dates must be valid YYYY-MM-DD calendar dates.');
  if (!Number.isSafeInteger(days)) throw new RangeError('A season date offset must be a safe integer number of days.');
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  if (!Number.isFinite(next.getTime())) throw new RangeError('The season calendar exceeds the supported four-digit year range.');
  const result = next.toISOString().slice(0, 10);
  if (!isDateOnly(result)) throw new RangeError('The season calendar exceeds the supported four-digit year range.');
  return result;
}

/** Original 20-club double round-robin calendar, independent of roster data and ambient locale. */
export function generateSeasonFixtures(config: Pick<SeasonConfig, 'id' | 'seed' | 'firstMatchDate' | 'teams'>): SeasonFixture[] {
  if (typeof config.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(config.id)) throw new Error('A season needs a stable identifier of 1–96 characters.');
  if (!isRandomState(config.seed)) throw new RangeError('A season seed must be an unsigned 32-bit integer.');
  if (!Array.isArray(config.teams) || config.teams.length !== SEASON_CLUB_COUNT) throw new Error('A season requires exactly 20 clubs.');
  const clubs = config.teams.map(team => team.id);
  if (clubs.some(id => typeof id !== 'string' || !id.trim()) || new Set(clubs).size !== SEASON_CLUB_COUNT) throw new Error('Season club identifiers must be nonempty and unique.');
  clubs.sort(compareIds);
  // Check the whole calendar before generating any output, including the 38th matchweek.
  addSeasonDays(config.firstMatchDate, (SEASON_ROUND_COUNT - 1) * 7);

  let rotation = [...clubs];
  const firstLeg: { homeClubId: string; awayClubId: string }[][] = [];
  for (let round = 0; round < FIRST_LEG_ROUNDS; round++) {
    const pairings: { homeClubId: string; awayClubId: string }[] = [];
    for (let match = 0; match < FIXTURES_PER_ROUND; match++) {
      const first = rotation[match]!;
      const second = rotation[SEASON_CLUB_COUNT - match - 1]!;
      // The fixed club alternates weekly. Slot parity alternates the moving clubs' venues.
      const firstAtHome = match === 0 ? round % 2 === 0 : match % 2 === 0;
      pairings.push({ homeClubId: firstAtHome ? first : second, awayClubId: firstAtHome ? second : first });
    }
    firstLeg.push(pairings);
    rotation = [rotation[0]!, rotation[rotation.length - 1]!, ...rotation.slice(1, -1)];
  }

  const fixtures: SeasonFixture[] = [];
  for (let round = 1; round <= SEASON_ROUND_COUNT; round++) {
    const pairings = firstLeg[(round - 1) % FIRST_LEG_ROUNDS]!;
    const reversed = round > FIRST_LEG_ROUNDS;
    for (let match = 0; match < FIXTURES_PER_ROUND; match++) {
      const pairing = pairings[match]!;
      const ordinal = fixtures.length;
      fixtures.push({
        id: `${config.id}:r${String(round).padStart(2, '0')}:m${String(match + 1).padStart(2, '0')}`,
        round,
        date: addSeasonDays(config.firstMatchDate, (round - 1) * 7),
        homeClubId: reversed ? pairing.awayClubId : pairing.homeClubId,
        awayClubId: reversed ? pairing.homeClubId : pairing.awayClubId,
        seed: (config.seed + Math.imul(ordinal + 1, FIXTURE_SEED_STEP)) >>> 0,
      });
    }
  }
  return fixtures;
}

export function getRoundFixtures(fixtures: readonly SeasonFixture[], round: number): SeasonFixture[] {
  if (!Number.isInteger(round) || round < 1 || round > SEASON_ROUND_COUNT) throw new RangeError('Choose a season round from 1 to 38.');
  return fixtures.filter(fixture => fixture.round === round).sort((first, second) => compareIds(first.id, second.id));
}
