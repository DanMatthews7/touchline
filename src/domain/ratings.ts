import { getAttributeValue, type AttributePath } from './attributes';
import type { Player, PlayerRole, Position } from './models';

export interface RoleDefinition {
  label: string;
  positions: readonly Position[];
  /** Relative weights, deliberately inspectable and independent of proprietary ratings. */
  weights: Readonly<Partial<Record<AttributePath, number>>>;
}

/** Initial editorial rules, version 1. These are original game-design choices, not observed facts. */
export const ROLE_DEFINITIONS: Record<PlayerRole, RoleDefinition> = {
  goalkeeper: { label: 'Goalkeeper', positions: ['GK'], weights: { 'goalkeeping.reflexes': 5, 'goalkeeping.handling': 4, 'goalkeeping.oneOnOnes': 3, 'goalkeeping.commandOfArea': 2, 'goalkeeping.aerialReach': 2, 'mental.positioning': 3, 'mental.concentration': 2, 'physical.agility': 2 } },
  centreBack: { label: 'Centre back', positions: ['CB'], weights: { 'technical.marking': 4, 'technical.tackling': 4, 'technical.heading': 3, 'mental.positioning': 4, 'mental.anticipation': 3, 'mental.concentration': 2, 'physical.strength': 3, 'physical.jumpingReach': 2 } },
  fullBack: { label: 'Full back', positions: ['RB', 'LB'], weights: { 'technical.tackling': 3, 'technical.marking': 2, 'technical.crossing': 3, 'mental.positioning': 3, 'mental.workRate': 3, 'physical.pace': 3, 'physical.stamina': 3, 'mental.teamwork': 2 } },
  defensiveMidfielder: { label: 'Defensive midfielder', positions: ['DM'], weights: { 'technical.tackling': 4, 'technical.passing': 3, 'mental.positioning': 4, 'mental.anticipation': 3, 'mental.decisions': 3, 'mental.teamwork': 2, 'physical.stamina': 2, 'physical.strength': 2 } },
  centralMidfielder: { label: 'Central midfielder', positions: ['CM'], weights: { 'technical.passing': 4, 'technical.firstTouch': 3, 'technical.technique': 2, 'mental.decisions': 3, 'mental.vision': 3, 'mental.teamwork': 2, 'mental.workRate': 2, 'physical.stamina': 3 } },
  wideMidfielder: { label: 'Wide midfielder', positions: ['RM', 'LM'], weights: { 'technical.crossing': 4, 'technical.dribbling': 3, 'technical.passing': 2, 'mental.workRate': 3, 'mental.offTheBall': 2, 'mental.teamwork': 2, 'physical.pace': 3, 'physical.stamina': 3 } },
  attackingMidfielder: { label: 'Attacking midfielder', positions: ['AM'], weights: { 'technical.passing': 4, 'technical.firstTouch': 3, 'technical.technique': 3, 'technical.dribbling': 2, 'mental.vision': 4, 'mental.decisions': 3, 'mental.offTheBall': 2, 'mental.flair': 2 } },
  winger: { label: 'Winger', positions: ['RW', 'LW'], weights: { 'technical.dribbling': 4, 'technical.crossing': 4, 'technical.firstTouch': 2, 'mental.offTheBall': 3, 'mental.flair': 2, 'physical.acceleration': 4, 'physical.pace': 4, 'physical.agility': 2 } },
  striker: { label: 'Striker', positions: ['ST'], weights: { 'technical.finishing': 5, 'technical.firstTouch': 3, 'technical.heading': 2, 'mental.composure': 4, 'mental.offTheBall': 4, 'mental.anticipation': 3, 'physical.acceleration': 2, 'physical.strength': 2 } },
};

export type RoleRating = {
  status: 'assessed';
  rating: number;
  missingAttributes: [];
  reason: null;
} | {
  status: 'unassessed';
  rating: null;
  missingAttributes: AttributePath[];
  reason: 'missing-attributes' | 'unfamiliar-position' | 'invalid-attributes';
};

/**
 * Maps the required weighted mean linearly from 1–20 to 1–100:
 * round(1 + 99 × (weightedMean − 1) / 19).
 * Unknown inputs are never imputed. This is a visible attribute summary, not match ability.
 */
export function calculateRoleRating(player: Pick<Player, 'attributes' | 'positions'>, role: PlayerRole): RoleRating {
  const definition = ROLE_DEFINITIONS[role];
  const weights = Object.entries(definition.weights) as [AttributePath, number][];
  const missingAttributes = weights.filter(([path]) => getAttributeValue(player.attributes, path) === null).map(([path]) => path);
  if (missingAttributes.length > 0) return { status: 'unassessed', rating: null, missingAttributes, reason: 'missing-attributes' };
  if (!definition.positions.some(position => player.positions.includes(position))) return { status: 'unassessed', rating: null, missingAttributes: [], reason: 'unfamiliar-position' };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [path, weight] of weights) {
    const value = getAttributeValue(player.attributes, path)!;
    if (!Number.isInteger(value) || value < 1 || value > 20) return { status: 'unassessed', rating: null, missingAttributes: [], reason: 'invalid-attributes' };
    weightedSum += value * weight;
    totalWeight += weight;
  }
  return { status: 'assessed', rating: Math.round(1 + 99 * (weightedSum / totalWeight - 1) / 19), missingAttributes: [], reason: null };
}

export function rolesForPlayer(player: Pick<Player, 'positions'>): PlayerRole[] {
  return (Object.keys(ROLE_DEFINITIONS) as PlayerRole[]).filter(role => ROLE_DEFINITIONS[role].positions.some(position => player.positions.includes(position)));
}
