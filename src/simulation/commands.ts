import { SAVE_SCHEMA_VERSION, type ClubId, type DatabaseSnapshot, type GameState } from '../domain/models';
import { initialRandomState, isRandomState } from './random';

export type GameCommand = { type: 'SELECT_CLUB'; clubId: ClubId; issuedAt: string } | { type: 'ADVANCE_DAY'; issuedAt: string };
export type GameEvent = { type: 'CLUB_SELECTED'; clubId: ClubId } | { type: 'DAY_ADVANCED'; previousDate: string; currentDate: string };
export type CommandErrorCode = 'INVALID_STATE' | 'INVALID_COMMAND' | 'UNKNOWN_CLUB' | 'CLUB_ALREADY_SELECTED' | 'NO_CLUB_SELECTED' | 'DATE_OVERFLOW';
export type CommandResult = { ok: true; state: GameState; events: GameEvent[] } | { ok: false; state: GameState; error: { code: CommandErrorCode; message: string } };

/** Strict calendar check: JavaScript Date alone would normalize February 30 silently. */
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  return new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);
}

export interface CreateGameStateOptions { id: string; databaseSnapshotId: string; startDate: string; seed: number; createdAt: string }

export function createGameState(options: CreateGameStateOptions): GameState {
  if (!options.id.trim() || !options.databaseSnapshotId.trim()) throw new Error('Career and database identifiers are required.');
  if (!isDateOnly(options.startDate)) throw new Error('Career start date must be a valid YYYY-MM-DD date.');
  if (!isTimestamp(options.createdAt)) throw new Error('Career creation time must be a valid UTC ISO timestamp.');
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    id: options.id,
    databaseSnapshotId: options.databaseSnapshotId,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    currentDate: options.startDate,
    managedClubId: null,
    simulation: { seed: options.seed, randomState: initialRandomState(options.seed), commandCount: 0 },
  };
}

/**
 * Explicit pure state transitions. Milestone 1 advances a date only: it does not
 * simulate fixtures, attribute changes, transfers, injuries or club decisions.
 * Wall-clock timestamps enter through commands and are therefore replayable.
 */
export function applyCommand(state: GameState, command: GameCommand, snapshot: Pick<DatabaseSnapshot, 'id' | 'clubs'>): CommandResult {
  const fail = (code: CommandErrorCode, message: string): CommandResult => ({ ok: false, state, error: { code, message } });
  if (state.schemaVersion !== SAVE_SCHEMA_VERSION || snapshot.id !== state.databaseSnapshotId || !isDateOnly(state.currentDate) || !isTimestamp(state.createdAt) || !isTimestamp(state.updatedAt) || Date.parse(state.updatedAt) < Date.parse(state.createdAt) || !isRandomState(state.simulation.seed) || !isRandomState(state.simulation.randomState) || state.simulation.randomState === 0 || !Number.isSafeInteger(state.simulation.commandCount) || state.simulation.commandCount < 0 || state.simulation.commandCount === Number.MAX_SAFE_INTEGER) return fail('INVALID_STATE', 'Career state is invalid or belongs to another starting database.');
  if (!isTimestamp(command.issuedAt) || Date.parse(command.issuedAt) < Date.parse(state.updatedAt)) return fail('INVALID_COMMAND', 'Command time must be a valid UTC timestamp at or after the last command.');
  if (state.managedClubId !== null && !snapshot.clubs.some(club => club.id === state.managedClubId)) return fail('INVALID_STATE', 'The managed club does not exist in the starting database.');
  const nextState: GameState = { ...state, updatedAt: command.issuedAt, simulation: { ...state.simulation, commandCount: state.simulation.commandCount + 1 } };
  switch (command.type) {
    case 'SELECT_CLUB':
      if (!snapshot.clubs.some(club => club.id === command.clubId)) return fail('UNKNOWN_CLUB', 'Choose a club present in the starting database.');
      if (state.managedClubId !== null) return fail('CLUB_ALREADY_SELECTED', 'Start a new career to choose another club.');
      return { ok: true, state: { ...nextState, managedClubId: command.clubId }, events: [{ type: 'CLUB_SELECTED', clubId: command.clubId }] };
    case 'ADVANCE_DAY': {
      if (state.managedClubId === null) return fail('NO_CLUB_SELECTED', 'Choose a club before advancing the calendar.');
      const nextDate = new Date(`${state.currentDate}T00:00:00.000Z`);
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const currentDate = nextDate.toISOString().slice(0, 10);
      if (!isDateOnly(currentDate)) return fail('DATE_OVERFLOW', 'The calendar exceeds the supported four-digit year range.');
      return { ok: true, state: { ...nextState, currentDate }, events: [{ type: 'DAY_ADVANCED', previousDate: state.currentDate, currentDate }] };
    }
    default:
      return fail('INVALID_COMMAND', 'This command is not implemented in Milestone 1.');
  }
}
