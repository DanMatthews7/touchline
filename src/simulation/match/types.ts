import type { PlayerAttributes } from '../../domain/attributes';
import type { Formation, PlayerRole, Position, TeamInstructions } from '../../domain/models';

export const MATCH_ENGINE_VERSION = 1 as const;
export type MatchSide = 'home' | 'away';

/** All condition/morale values are explicit scenario inputs, not biographical facts. */
export interface MatchPlayer {
  id: string;
  name: string;
  attributes: PlayerAttributes;
  positions: Position[];
  initialCondition: number;
  initialMorale: number;
}
export interface MatchLineupSlot { playerId: string; position: Position; role: PlayerRole }
export interface MatchTeam {
  id: string;
  name: string;
  players: MatchPlayer[];
  lineup: MatchLineupSlot[];
  benchIds: string[];
  formation: Formation;
  instructions: TeamInstructions;
}
export interface MatchConfig {
  engineVersion: typeof MATCH_ENGINE_VERSION;
  id: string;
  seed: number;
  /** Retains the explicit disclaimer when unknown source ratings were filled for an exhibition. */
  assessmentMode: 'recorded-attributes' | 'uniform-missing-10';
  home: MatchTeam;
  away: MatchTeam;
  /** Explicit advantage applied to home action efficiency; 0 is neutral, maximum .2. */
  homeAdvantage: number;
}
export interface MatchPlayerRuntime { condition: number; morale: number; yellowCards: number; dismissed: boolean }
export interface MatchTeamState {
  lineup: MatchLineupSlot[];
  benchIds: string[];
  players: Record<string, MatchPlayerRuntime>;
  formation: Formation;
  instructions: TeamInstructions;
  substitutionsUsed: number;
  substitutionWindowsUsed: number;
  lastSubstitutionMinute: number | null;
}
interface EventBase { id: number; minute: number }
export type MatchEvent = EventBase & (
  { type: 'KICKOFF'; team: MatchSide }
  | { type: 'POSSESSION'; team: MatchSide }
  | { type: 'PASS'; team: MatchSide; playerId: string; recipientId: string; completed: boolean }
  | { type: 'TACKLE'; team: MatchSide; playerId: string; opponentId: string; won: boolean }
  | { type: 'CHANCE'; team: MatchSide; playerId: string; quality: number }
  | { type: 'SHOT'; team: MatchSide; playerId: string; onTarget: boolean; expectedGoals: number }
  | { type: 'SAVE'; team: MatchSide; playerId: string; shooterId: string }
  | { type: 'GOAL'; team: MatchSide; playerId: string }
  | { type: 'FOUL'; team: MatchSide; playerId: string; fouledPlayerId: string }
  | { type: 'CARD'; team: MatchSide; playerId: string; card: 'yellow' | 'second-yellow' | 'red' }
  | { type: 'FATIGUE'; team: MatchSide; playerId: string; condition: number }
  | { type: 'SUBSTITUTION'; team: MatchSide; playerOutId: string; playerInId: string }
  | { type: 'TACTICS_CHANGED'; team: MatchSide; formation: Formation; instructions: TeamInstructions }
  | { type: 'CHECKPOINT' }
  | { type: 'FULL_TIME' }
  | { type: 'ABANDONED'; team: MatchSide; reason: 'fewer-than-seven' }
);
export type MatchCommand = { type: 'ADVANCE' }
  | { type: 'SUBSTITUTE'; team: MatchSide; playerOutId: string; playerInId: string }
  | { type: 'CHANGE_TACTICS'; team: MatchSide; formation: Formation; instructions: TeamInstructions; lineup: MatchLineupSlot[] };
export interface MatchState {
  engineVersion: typeof MATCH_ENGINE_VERSION;
  config: MatchConfig;
  minute: number;
  status: 'ready' | 'paused' | 'finished' | 'abandoned';
  randomState: number;
  possession: MatchSide;
  teams: Record<MatchSide, MatchTeamState>;
  events: MatchEvent[];
  commands: MatchCommand[];
}
export type MatchCommandResult = { ok: true; state: MatchState } | { ok: false; state: MatchState; error: { code: string; message: string } };
export interface MatchStats {
  possession: number;
  passesAttempted: number;
  passesCompleted: number;
  tacklesAttempted: number;
  tacklesWon: number;
  chances: number;
  shots: number;
  shotsOnTarget: number;
  expectedGoals: number;
  saves: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}
export interface MatchSummary { score: Record<MatchSide, number>; stats: Record<MatchSide, MatchStats> }
