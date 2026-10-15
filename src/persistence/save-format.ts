import { z } from 'zod';
import { DATABASE_SCHEMA_VERSION, SAVE_SCHEMA_VERSION, type DatabaseSnapshot, type GameState } from '../domain/models';
import { applyCommand, createGameState } from '../simulation/commands';
import { dateSchema, idSchema, parseSnapshot, requireVersion, snapshotSchema, timestampSchema, uint32Schema } from '../data/schema';

export const MAX_SAVE_BYTES = 16 * 1024 * 1024;
export const SAVE_FORMAT = 'touchline-save' as const;

export const gameStateSchema = z.object({
  schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
  id: idSchema,
  databaseSnapshotId: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  currentDate: dateSchema,
  managedClubId: idSchema.nullable(),
  simulation: z.object({
    seed: uint32Schema,
    randomState: uint32Schema.min(1),
    commandCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  }).strict(),
}).strict().refine(value => Date.parse(value.updatedAt) >= Date.parse(value.createdAt), {
  path: ['updatedAt'], message: 'A career cannot be updated before it was created.',
});

export interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  exportedAt: string;
  snapshot: DatabaseSnapshot;
  career: GameState;
}

export function parseGameState(input: unknown): GameState {
  requireVersion(input, SAVE_SCHEMA_VERSION, 'career');
  return gameStateSchema.parse(input);
}

export function validateCareerSnapshot(career: GameState, snapshot: DatabaseSnapshot): void {
  if (career.databaseSnapshotId !== snapshot.id) throw new Error('Career references a different starting database snapshot.');
  if (career.managedClubId !== null && !snapshot.clubs.some(club => club.id === career.managedClubId)) {
    throw new Error('Managed club is absent from the starting database snapshot.');
  }
}

export const saveEnvelopeSchema = z.object({
  format: z.literal(SAVE_FORMAT),
  schemaVersion: z.literal(SAVE_SCHEMA_VERSION),
  exportedAt: timestampSchema,
  snapshot: snapshotSchema,
  career: gameStateSchema,
}).strict().superRefine((envelope, context) => {
  if (envelope.career.databaseSnapshotId !== envelope.snapshot.id) {
    context.addIssue({ code: 'custom', path: ['career', 'databaseSnapshotId'], message: 'Career references a different starting database snapshot.' });
  }
  if (envelope.career.managedClubId !== null && !envelope.snapshot.clubs.some(club => club.id === envelope.career.managedClubId)) {
    context.addIssue({ code: 'custom', path: ['career', 'managedClubId'], message: 'Managed club is absent from the starting database snapshot.' });
  }
});

/** Parsing is deliberately pure: callers can inspect a backup before writing anything. */
export function importSave(input: string | unknown): SaveEnvelope {
  let candidate: unknown = input;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).byteLength > MAX_SAVE_BYTES) throw new Error('Save exceeds the 16 MiB import limit.');
    try { candidate = JSON.parse(input) as unknown; }
    catch { throw new Error('Save is not valid JSON. Select an exported Touchline JSON save.'); }
  }
  requireVersion(candidate, SAVE_SCHEMA_VERSION, 'save');
  if (typeof candidate === 'object' && candidate !== null) {
    if ('snapshot' in candidate) requireVersion(candidate.snapshot, DATABASE_SCHEMA_VERSION, 'database snapshot');
    if ('career' in candidate) requireVersion(candidate.career, SAVE_SCHEMA_VERSION, 'career');
  }
  return saveEnvelopeSchema.parse(candidate);
}

/** Hidden simulation values remain in backups, never in presentation player props. */
export function exportSave(snapshot: DatabaseSnapshot, career: GameState): string {
  const envelope = importSave({
    format: SAVE_FORMAT,
    schemaVersion: SAVE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    snapshot,
    career,
  });
  const serialized = JSON.stringify(envelope, null, 2);
  if (new TextEncoder().encode(serialized).byteLength > MAX_SAVE_BYTES) throw new Error('Save exceeds the 16 MiB export limit.');
  return serialized;
}

export function createCareer(snapshotInput: DatabaseSnapshot, clubId: string, seed: number): GameState {
  const snapshot = parseSnapshot(snapshotInput);
  if (!snapshot.clubs.some(club => club.id === clubId)) throw new Error('Choose a club present in the starting database snapshot.');
  uint32Schema.parse(seed);
  const now = new Date().toISOString();
  const initialState = createGameState({
    id: `career-${crypto.randomUUID()}`,
    databaseSnapshotId: snapshot.id,
    createdAt: now,
    startDate: `${snapshot.season.slice(0, 4)}-07-01`,
    seed,
  });
  const selection = applyCommand(initialState, { type: 'SELECT_CLUB', clubId, issuedAt: now }, snapshot);
  if (!selection.ok) throw new Error(selection.error.message);
  return parseGameState(selection.state);
}
