import type { MatchCommand, MatchState, MatchSummary, MatchTeam } from '../match/types';

export const SEASON_ENGINE_VERSION = 1 as const;
export const SEASON_CLUB_COUNT = 20 as const;
export const SEASON_ROUND_COUNT = 38 as const;
export interface SeasonConfig {
  engineVersion: typeof SEASON_ENGINE_VERSION;
  matchEngineVersion: 1;
  id: string;
  careerId: string;
  name: string;
  startDate: string;
  firstMatchDate: string;
  seed: number;
  managedClubId: string;
  teams: MatchTeam[];
  assessmentMode: 'recorded-attributes' | 'uniform-missing-10';
  homeAdvantage: number;
}
export interface SeasonFixture { id: string; round: number; date: string; homeClubId: string; awayClubId: string; seed: number }
/** Only full-time scores enter the table. An abandonment blocks the entire round for review. */
export interface SeasonResult { fixtureId: string; round: number; status: 'finished'; summary: MatchSummary }
export interface SeasonTeamSelection {
  formation: MatchTeam['formation'];
  instructions: MatchTeam['instructions'];
  lineup: MatchTeam['lineup'];
  benchIds: string[];
}
export interface SeasonMatchSession { fixtureId: string; attempt: number; state: MatchState }
export type SeasonCommand = { type: 'ADVANCE_CALENDAR' } | { type: 'START_MATCH' }
  | { type: 'MATCH_COMMAND'; command: MatchCommand } | { type: 'COMPLETE_ROUND' } | { type: 'REPLAY_ABANDONED' };
export interface SeasonState {
  engineVersion: typeof SEASON_ENGINE_VERSION;
  config: SeasonConfig;
  currentDate: string;
  /** Number of completely committed rounds; 0 initially, 38 only after the season ends. */
  roundIndex: number;
  status: 'between-rounds' | 'matchday' | 'playing' | 'round-ready' | 'blocked' | 'finished';
  fixtures: SeasonFixture[];
  results: SeasonResult[];
  /** Results staged during a blocked round never enter the league table. */
  pendingResults: SeasonResult[];
  activeMatch: SeasonMatchSession | null;
  lastManagedMatch: SeasonMatchSession | null;
  commands: SeasonCommand[];
  teamSelections: Record<string, SeasonTeamSelection>;
  blockedFixtureId: string | null;
  fixtureAttempts: Record<string, number>;
  abandonedMatches: SeasonMatchSession[];
}
export type SeasonCommandResult = { ok: true; state: SeasonState } | { ok: false; state: SeasonState; error: { code: string; message: string } };
export interface SeasonTableRow {
  position: number;
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
