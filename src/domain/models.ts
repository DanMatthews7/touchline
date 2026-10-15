import type { AttributeAssessments, PlayerAttributes } from './attributes';

export type PlayerId = string;
export type ClubId = string;
export type CompetitionId = string;
export type DateOnly = string;
export const DATABASE_SCHEMA_VERSION = 1 as const;
export const SAVE_SCHEMA_VERSION = 1 as const;

export const POSITIONS = ['GK', 'RB', 'CB', 'LB', 'DM', 'CM', 'RM', 'LM', 'AM', 'RW', 'LW', 'ST'] as const;
export type Position = (typeof POSITIONS)[number];
export const POSITION_LABELS: Record<Position, string> = { GK: 'Goalkeeper', RB: 'Right back', CB: 'Centre back', LB: 'Left back', DM: 'Defensive midfield', CM: 'Central midfield', RM: 'Right midfield', LM: 'Left midfield', AM: 'Attacking midfield', RW: 'Right wing', LW: 'Left wing', ST: 'Striker' };
export type PreferredFoot = 'left' | 'right' | 'both' | 'unknown';

export interface DataLicense {
  name: string;
  url: string | null;
  usageRestrictions: string[];
}

export interface ProvenanceRecord {
  sourceId: string;
  sourceName: string;
  url: string;
  accessedAt: string;
  sourceDate: DateOnly | null;
  externalId: string | null;
  license: DataLicense;
}

export interface DataStatus {
  validation: 'verified' | 'needs-review';
  completeness: 'partial' | 'complete';
  notes: string[];
}

/** Account values are integer minor units (for example pennies), with explicit currency. */
export interface Money {
  amountMinor: number;
  currency: string;
}

export interface ClubFinances {
  balance: Money;
  transferBudget: Money;
  weeklyWageBudget: Money;
}

export type PersonalityAttribute = 'professionalism' | 'ambition' | 'loyalty' | 'pressure' | 'sportsmanship' | 'temperament';
/** Hidden values are simulation data and must not be passed to attribute-display components. */
export interface HiddenPlayerAttributes {
  personality: Partial<Record<PersonalityAttribute, number | null>>;
  currentDevelopmentLevel: number | null;
  potential: number | null;
}

export interface Player {
  id: PlayerId;
  name: string;
  dateOfBirth: DateOnly | null;
  nationality: string[];
  positions: Position[];
  preferredFoot: PreferredFoot;
  /** A null club is unknown/unassigned; historical membership is never inferred as current. */
  clubId: ClubId | null;
  attributes: PlayerAttributes;
  attributeAssessments: AttributeAssessments;
  hidden: HiddenPlayerAttributes;
  dataStatus: DataStatus;
  provenance: ProvenanceRecord[];
}

export type VisiblePlayer = Omit<Player, 'hidden'>;
export function visiblePlayer(player: Player): VisiblePlayer {
  const { hidden: _hidden, ...visible } = player;
  return visible;
}

export interface Club {
  id: ClubId;
  name: string;
  shortName: string;
  country: string;
  stadium: string | null;
  primaryColor: string | null;
  finances: ClubFinances | null;
  dataStatus: DataStatus;
  provenance: ProvenanceRecord[];
}

export const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1', '3-5-2'] as const;
export type Formation = (typeof FORMATIONS)[number];
export type PlayerRole = 'goalkeeper' | 'centreBack' | 'fullBack' | 'defensiveMidfielder' | 'centralMidfielder' | 'wideMidfielder' | 'attackingMidfielder' | 'winger' | 'striker';
export interface TacticalAssignment { slotId: string; position: Position; role: PlayerRole; playerId: PlayerId | null }
export interface TeamInstructions {
  mentality: 'defensive' | 'balanced' | 'attacking';
  tempo: 'slow' | 'standard' | 'fast';
  width: 'narrow' | 'standard' | 'wide';
  pressingIntensity: 'low' | 'standard' | 'high';
  defensiveLine: 'deep' | 'standard' | 'high';
}
export interface Tactics {
  clubId: ClubId;
  formation: Formation;
  startingXI: TacticalAssignment[];
  substitutes: PlayerId[];
  instructions: TeamInstructions;
}

export interface Competition {
  id: CompetitionId;
  name: string;
  country: string;
  season: string;
  format: 'league' | 'cup';
  clubIds: ClubId[];
  provenance: ProvenanceRecord[];
}

export interface DatabaseSnapshot {
  schemaVersion: typeof DATABASE_SCHEMA_VERSION;
  id: string;
  name: string;
  season: string;
  createdAt: string;
  sources: ProvenanceRecord[];
  players: Player[];
  clubs: Club[];
  competitions: Competition[];
  validation: { status: 'reference-only' | 'validated'; notes: string[] };
}

/** Mutable career state references a versioned, separately stored starting database. */
export interface GameState {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  id: string;
  databaseSnapshotId: string;
  createdAt: string;
  updatedAt: string;
  currentDate: DateOnly;
  managedClubId: ClubId | null;
  simulation: { seed: number; randomState: number; commandCount: number };
}
