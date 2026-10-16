import { ATTRIBUTE_GROUPS, getAttributeValue, type PlayerAttributes } from '../domain/attributes';
import type { Formation, Player, PlayerRole, Position, TeamInstructions } from '../domain/models';
import { FORMATION_POSITIONS, parseMatchConfig, type MatchConfig, type MatchPlayer } from '../simulation/match';

export const DEFAULT_INSTRUCTIONS: Readonly<TeamInstructions> = {
  mentality: 'balanced', tempo: 'standard', width: 'standard', pressingIntensity: 'standard', defensiveLine: 'standard',
};

const POSITION_ROLE: Record<Position, PlayerRole> = {
  GK: 'goalkeeper', RB: 'fullBack', CB: 'centreBack', LB: 'fullBack', DM: 'defensiveMidfielder',
  CM: 'centralMidfielder', RM: 'wideMidfielder', LM: 'wideMidfielder', AM: 'attackingMidfielder',
  RW: 'winger', LW: 'winger', ST: 'striker',
};

/** These are coach-assigned match slots, never assertions of a real preferred position. */
function formationSlots(formation: Formation) {
  return FORMATION_POSITIONS[formation].map(position => ({ position, role: POSITION_ROLE[position] }));
}
export const FORMATION_SLOTS: Record<Formation, readonly { position: Position; role: PlayerRole }[]> = {
  '4-4-2': formationSlots('4-4-2'), '4-3-3': formationSlots('4-3-3'),
  '4-2-3-1': formationSlots('4-2-3-1'), '4-1-4-1': formationSlots('4-1-4-1'), '3-5-2': formationSlots('3-5-2'),
};

export interface ExhibitionOptions {
  id: string;
  seed: number;
  homePlayerIds: string[];
  awayPlayerIds: string[];
  homeFormation: Formation;
  awayFormation: Formation;
  homeInstructions: TeamInstructions;
  awayInstructions: TeamInstructions;
  initialCondition: number;
  initialMorale: number;
  useUniformEstimates: boolean;
  homeAdvantage: boolean;
}

/** Stable starter and reserve selections from authentic identities, without claimed club membership. */
export function defaultExhibitionSelection(catalogue: readonly Player[]): Pick<ExhibitionOptions, 'homePlayerIds' | 'awayPlayerIds'> {
  if (new Set(catalogue.map(player => player.id)).size !== catalogue.length) throw new Error('The player catalogue contains duplicate identifiers.');
  const keepers = catalogue.filter(player => player.positions.includes('GK'));
  const outfield = catalogue.filter(player => !player.positions.includes('GK'));
  if (keepers.length < 2 || outfield.length < 20) throw new Error('An exhibition needs two known goalkeepers and twenty other distinct player identities. Import suitable records to prepare the lineups.');
  const benchCount = Math.min(2, Math.floor((outfield.length - 20) / 2));
  return {
    homePlayerIds: [keepers[0]!, ...outfield.slice(0, 10), ...keepers.slice(2, 3), ...outfield.slice(20, 20 + benchCount)].map(player => player.id),
    awayPlayerIds: [keepers[1]!, ...outfield.slice(10, 20), ...keepers.slice(3, 4), ...outfield.slice(20 + benchCount, 20 + benchCount * 2)].map(player => player.id),
  };
}

function scenarioPlayer(player: Player, options: ExhibitionOptions): MatchPlayer {
  const attributes: PlayerAttributes = {
    technical: { ...player.attributes.technical }, mental: { ...player.attributes.mental },
    physical: { ...player.attributes.physical }, goalkeeping: { ...player.attributes.goalkeeping },
  };
  for (const group of ATTRIBUTE_GROUPS) {
    for (const attribute of group.attributes) {
      const value = getAttributeValue(player.attributes, attribute.path);
      if (value === null && !options.useUniformEstimates) {
        throw new Error(`${player.name}: ${attribute.label} is unassessed. Enter/import original assessments, or explicitly enable the uniform 10/20 exhibition estimates.`);
      }
      (attributes[group.id] as Record<string, number | null>)[attribute.key] = value ?? 10;
    }
  }
  return {
    id: player.id, name: player.name, attributes, positions: [...player.positions],
    initialCondition: options.initialCondition, initialMorale: options.initialMorale,
  };
}

/** Prepare a self-contained scenario. Source records, career state and hidden attributes are untouched. */
export function prepareExhibition(catalogue: readonly Player[], options: ExhibitionOptions): MatchConfig {
  if (new Set(catalogue.map(player => player.id)).size !== catalogue.length) throw new Error('The player catalogue contains duplicate identifiers.');
  const byId = new Map(catalogue.map(player => [player.id, player]));
  function team(side: 'home' | 'away') {
    const ids = side === 'home' ? options.homePlayerIds : options.awayPlayerIds;
    const formation = side === 'home' ? options.homeFormation : options.awayFormation;
    const instructions = side === 'home' ? options.homeInstructions : options.awayInstructions;
    const slots = FORMATION_SLOTS[formation];
    if (!slots) throw new Error('Choose a supported formation.');
    if (ids.length < 11 || ids.length > 20) throw new Error('Select eleven starters and up to nine substitutes for each side.');
    const players = ids.map(id => {
      const player = byId.get(id);
      if (!player) throw new Error(`Selected player ${id} is absent from the source catalogue.`);
      return scenarioPlayer(player, options);
    });
    return {
      id: `${side}-selection`, name: `${side === 'home' ? 'Home' : 'Away'} selection`, players,
      formation, instructions: { ...instructions },
      lineup: slots.map((slot, index) => ({ ...slot, playerId: ids[index]! })),
      benchIds: ids.slice(11),
    };
  }
  return parseMatchConfig({
    engineVersion: 1,
    id: options.id,
    seed: options.seed,
    assessmentMode: options.useUniformEstimates ? 'uniform-missing-10' : 'recorded-attributes',
    homeAdvantage: options.homeAdvantage ? 0.04 : 0,
    home: team('home'), away: team('away'),
  });
}
