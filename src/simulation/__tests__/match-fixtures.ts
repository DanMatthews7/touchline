/**
 * SYNTHETIC AUTOMATED TESTS ONLY.
 * These invented identities/ratings are confined to automated tests and the calibration CLI.
 * Never import this module into the application UI, a source snapshot, or a career database.
 */
import { createUnknownAttributes } from '../../domain/attributes';
import { POSITIONS, type Formation, type PlayerRole, type Position, type TeamInstructions } from '../../domain/models';
import type { MatchConfig, MatchPlayer, MatchTeam } from '../match';
import { FORMATION_POSITIONS } from '../match/validation';

export const SYNTHETIC_FIXTURE_NOTICE = 'SYNTHETIC AUTOMATED TESTS ONLY — invented identities and ratings; no observed football dataset.';

const POSITION_ROLES: Record<Position, PlayerRole> = {
  GK: 'goalkeeper', RB: 'fullBack', CB: 'centreBack', LB: 'fullBack', DM: 'defensiveMidfielder',
  CM: 'centralMidfielder', RM: 'wideMidfielder', LM: 'wideMidfielder', AM: 'attackingMidfielder',
  RW: 'winger', LW: 'winger', ST: 'striker',
};

export const BALANCED_INSTRUCTIONS: TeamInstructions = {
  mentality: 'balanced', tempo: 'standard', width: 'standard', pressingIntensity: 'standard', defensiveLine: 'standard',
};

export interface SyntheticTeamOptions {
  skill?: number;
  stamina?: number;
  condition?: number;
  morale?: number;
  formation?: Formation;
  instructions?: Partial<TeamInstructions>;
}

export function syntheticMatchTeam(id: string, options: SyntheticTeamOptions = {}): MatchTeam {
  const { skill = 12, stamina = 12, condition = 100, morale = 70, formation = '4-4-2' } = options;
  const positions = FORMATION_POSITIONS[formation];
  const players: MatchPlayer[] = Array.from({ length: 20 }, (_, index) => {
    const goalkeeper = index === 0 || index === 11;
    const attributes = createUnknownAttributes();
    for (const group of Object.values(attributes)) for (const attribute of Object.keys(group)) (group as Record<string, number | null>)[attribute] = skill;
    // Changing overall action skill must not silently change aggression or the stamina treatment.
    attributes.mental.aggression = 10;
    attributes.physical.stamina = stamina;
    attributes.physical.naturalFitness = 12;
    return {
      id: `${id}-synthetic-player-${index + 1}`,
      name: `SYNTHETIC AUTOMATED TEST ${id} player ${index + 1}`,
      attributes,
      // Equal outfield familiarity isolates formation structure from accidental positional penalties.
      positions: goalkeeper ? ['GK'] : POSITIONS.filter(position => position !== 'GK'),
      initialCondition: index < 11 ? condition : 100,
      initialMorale: morale,
    };
  });
  return {
    id, name: `SYNTHETIC AUTOMATED TEST ${id}`,
    players,
    lineup: positions.map((position, index) => ({ playerId: players[index]!.id, position, role: POSITION_ROLES[position] })),
    benchIds: players.slice(11).map(player => player.id),
    formation,
    instructions: { ...BALANCED_INSTRUCTIONS, ...options.instructions },
  };
}

export function syntheticMatchConfig(seed: number, home: SyntheticTeamOptions = {}, away: SyntheticTeamOptions = {}, homeAdvantage = 0.04): MatchConfig {
  return {
    engineVersion: 1,
    assessmentMode: 'recorded-attributes',
    id: `synthetic-automated-calibration-${seed}`,
    seed,
    home: syntheticMatchTeam('synthetic-home', home),
    away: syntheticMatchTeam('synthetic-away', away),
    homeAdvantage,
  };
}
