import { z } from 'zod';
import { ATTRIBUTE_KEYS, type PlayerAttributes } from '../domain/attributes';
import type { PlayerRole, Position } from '../domain/models';
import { isDateOnly } from '../simulation/commands';
import { MATCH_ENGINE_VERSION, type MatchPlayer, type MatchTeam } from '../simulation/match';
import { addSeasonDays, parseSeasonConfig, SEASON_ENGINE_VERSION, type SeasonConfig } from '../simulation/season';
import { assertPlainDemoData } from './validation';

/** Generic simulation inputs for the separately launched development tool only. */
export interface DemoScenario {
  scenarioVersion: 1;
  seed: number;
  managedClubId: string;
  startDate: string;
  firstMatchDate: string;
  initialCondition: number;
  initialMorale: number;
  homeAdvantage: number;
}

export const DEMO_CLUBS: ReadonlyArray<Readonly<{ id: string; name: string }>> = Object.freeze(
  Array.from({ length: 20 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return Object.freeze({ id: `demo-club-${number}`, name: `Demo Club ${number}` });
  }),
);

export const DEFAULT_DEMO_SCENARIO: Readonly<DemoScenario> = Object.freeze({
  scenarioVersion: 1, seed: 42, managedClubId: 'demo-club-01',
  startDate: '2026-10-17', firstMatchDate: '2026-10-17',
  initialCondition: 100, initialMorale: 50, homeAdvantage: .04,
});
export function defaultDemoScenario(): DemoScenario { return { ...DEFAULT_DEMO_SCENARIO }; }

const dateSchema = z.string().refine(isDateOnly, 'Use a real YYYY-MM-DD calendar date.');
const scenarioSchema = z.object({
  scenarioVersion: z.literal(1),
  seed: z.number().int().min(0).max(0xffff_ffff),
  managedClubId: z.string().refine(value => DEMO_CLUBS.some(club => club.id === value), 'Choose a demo club.'),
  startDate: dateSchema,
  firstMatchDate: dateSchema,
  initialCondition: z.number().int().min(1).max(100),
  initialMorale: z.number().int().min(0).max(100),
  homeAdvantage: z.number().finite().min(0).max(.2),
}).strict();

export function parseDemoScenario(input: unknown): DemoScenario {
  assertPlainDemoData(input);
  const scenario = scenarioSchema.parse(input);
  if (scenario.firstMatchDate < scenario.startDate) throw new Error('The first demo fixture cannot precede the start date.');
  addSeasonDays(scenario.firstMatchDate, 37 * 7);
  return scenario;
}

const positions: readonly (readonly Position[])[] = [
  ['GK'], ['RB'], ['CB'], ['CB'], ['LB'], ['DM'], ['CM'], ['CM'], ['RW'], ['LW'], ['ST'],
  ['GK'], ['RB', 'CB', 'LB'], ['DM', 'CM', 'AM'], ['RW', 'LW', 'RM', 'LM'], ['ST'],
];
const roles: readonly PlayerRole[] = ['goalkeeper', 'fullBack', 'centreBack', 'centreBack', 'fullBack', 'defensiveMidfielder', 'centralMidfielder', 'centralMidfielder', 'winger', 'winger', 'striker'];
function uniformAttributes(): PlayerAttributes {
  return Object.fromEntries(Object.entries(ATTRIBUTE_KEYS).map(([group, keys]) => [group, Object.fromEntries(keys.map(key => [key, 10]))])) as PlayerAttributes;
}

function createDemoTeam(club: Readonly<{ id: string; name: string }>, clubIndex: number, scenario: DemoScenario): MatchTeam {
  const number = String(clubIndex + 1).padStart(2, '0');
  const players: MatchPlayer[] = positions.map((familiarity, index) => ({
    id: `demo-player-${number}-${String(index + 1).padStart(2, '0')}`,
    name: `Demo ${number} Player ${String(index + 1).padStart(2, '0')}`,
    attributes: uniformAttributes(), positions: [...familiarity],
    initialCondition: scenario.initialCondition, initialMorale: scenario.initialMorale,
  }));
  return {
    id: club.id, name: club.name, players,
    lineup: players.slice(0, 11).map((player, index) => ({ playerId: player.id, position: positions[index]![0]!, role: roles[index]! })),
    benchIds: players.slice(11).map(player => player.id), formation: '4-3-3',
    instructions: { mentality: 'balanced', tempo: 'standard', width: 'standard', pressingIntensity: 'standard', defensiveLine: 'standard' },
  };
}

/** Regenerate every team; backups cannot supply altered players, ratings or fixtures. */
export function createDemoConfig(input: DemoScenario, id = 'development-demo'): SeasonConfig {
  const scenario = parseDemoScenario(input);
  return parseSeasonConfig({
    engineVersion: SEASON_ENGINE_VERSION, matchEngineVersion: MATCH_ENGINE_VERSION,
    id, careerId: `${id}:career`, name: 'Development Demo League',
    startDate: scenario.startDate, firstMatchDate: scenario.firstMatchDate,
    seed: scenario.seed, managedClubId: scenario.managedClubId,
    teams: DEMO_CLUBS.map((club, index) => createDemoTeam(club, index, scenario)),
    assessmentMode: 'recorded-attributes', homeAdvantage: scenario.homeAdvantage,
  });
}
