import {
  CAREER_FINANCE_ENGINE_VERSION, MAX_FINANCE_ADVANCE_DAYS, advanceCareerFinances, createCareerFinances,
  recordCareerMatchdayIncome, renewCareerContract, type CareerFinanceState,
} from '../simulation/career';
import { addSeasonDays, applySeasonCommand, type SeasonState } from '../simulation/season';
import type { DemoCommand } from './commands';

/** Version-1 career inputs for generic demo clubs only, never real financial facts. */
export const DEMO_CAREER_INPUTS = Object.freeze({
  openingBalanceMinor: 500_000_000,
  transferBudgetMinor: 100_000_000,
  weeklyWageBudgetMinor: 8_000_000,
  playerWeeklyWageMinor: 100_000,
  matchdayIncomeMinor: 2_500_000,
});

function twoYearsAfter(date: string): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year + 2, month, 0)).getUTCDate();
  return `${String(year + 2).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/** Activate at the current replay boundary, without charging earlier football dates. */
export function createDemoFinances(season: SeasonState): CareerFinanceState {
  const nextFixture = season.fixtures.find(fixture => fixture.round > season.roundIndex);
  if (nextFixture && Date.parse(`${nextFixture.date}T00:00:00Z`) - Date.parse(`${season.currentDate}T00:00:00Z`) > MAX_FINANCE_ADVANCE_DAYS * 86_400_000) {
    throw new Error('Career management requires the next matchday to be within ten years of the current date. Choose a closer first matchday.');
  }
  const lastFixtureDate = season.fixtures.reduce((latest, fixture) => fixture.date > latest ? fixture.date : latest, season.currentDate);
  const minimumEnd = addSeasonDays(lastFixtureDate, 365);
  const usualEnd = twoYearsAfter(season.currentDate);
  const endDate = usualEnd > minimumEnd ? usualEnd : minimumEnd;
  return createCareerFinances({
    engineVersion: CAREER_FINANCE_ENGINE_VERSION,
    startDate: season.currentDate,
    clubs: season.config.teams.map(team => ({
      clubId: team.id, balanceMinor: DEMO_CAREER_INPUTS.openingBalanceMinor,
      transferBudgetMinor: DEMO_CAREER_INPUTS.transferBudgetMinor,
      weeklyWageBudgetMinor: DEMO_CAREER_INPUTS.weeklyWageBudgetMinor,
      matchdayIncomeMinor: DEMO_CAREER_INPUTS.matchdayIncomeMinor,
    })),
    contracts: season.config.teams.flatMap(team => team.players.map(player => ({
      playerId: player.id, clubId: team.id, startDate: season.currentDate,
      endDate, weeklyWageMinor: DEMO_CAREER_INPUTS.playerWeeklyWageMinor,
    }))),
  });
}

/** Football and finance changes are prepared together before a checkpoint write. */
export function applyDemoDecision(state: SeasonState, finances: CareerFinanceState | null, command: DemoCommand): { state: SeasonState; finances: CareerFinanceState | null } {
  if (command.type === 'RENEW_CONTRACT') {
    if (!finances) throw new Error('Enable career management before renewing a demo contract.');
    const next = renewCareerContract(finances, {
      clubId: state.config.managedClubId, playerId: command.playerId,
      weeklyWageMinor: command.weeklyWageMinor, endDate: command.endDate,
    });
    return { state, finances: next };
  }
  const result = applySeasonCommand(state, command);
  if (!result.ok) throw new Error(result.error.message);
  let nextFinances = finances;
  if (nextFinances && result.state.currentDate !== state.currentDate) nextFinances = advanceCareerFinances(nextFinances, result.state.currentDate);
  if (nextFinances && result.state.results.length > state.results.length) {
    const recorded = new Set(state.results.map(value => value.fixtureId));
    for (const committed of result.state.results) {
      if (recorded.has(committed.fixtureId)) continue;
      const fixture = result.state.fixtures.find(value => value.id === committed.fixtureId);
      if (!fixture) throw new Error('A committed demo fixture has no schedule record.');
      nextFinances = recordCareerMatchdayIncome(nextFinances, { clubId: fixture.homeClubId, fixtureId: fixture.id, date: fixture.date });
    }
  }
  return { state: result.state, finances: nextFinances };
}
