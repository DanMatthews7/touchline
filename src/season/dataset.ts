import { z } from 'zod';
import { parseSnapshot } from '../data';
import type { DatabaseSnapshot } from '../domain';
import { evaluateSeasonRosterReadiness, parseCurrentSquadManifest, type CurrentSquadManifest } from './rosters';

export const MAX_SQUAD_DATASET_BYTES = 16 * 1024 * 1024;
export interface CurrentSquadDataset { snapshot: DatabaseSnapshot; manifest: CurrentSquadManifest }
const envelopeSchema = z.object({
  format: z.literal('touchline-squad-dataset'), schemaVersion: z.literal(1),
  snapshot: z.unknown(), manifest: z.unknown(),
}).strict();

/** Structural and reviewed-evidence validation never substitutes for checking the cited sources. */
export function importCurrentSquadDataset(serialized: string): CurrentSquadDataset {
  if (new TextEncoder().encode(serialized).byteLength > MAX_SQUAD_DATASET_BYTES) throw new Error('Squad dataset exceeds the 16 MiB limit.');
  let candidate: unknown;
  try { candidate = JSON.parse(serialized) as unknown; }
  catch { throw new Error('Squad dataset is not valid JSON.'); }
  const envelope = envelopeSchema.parse(candidate);
  const snapshot = parseSnapshot(envelope.snapshot);
  const manifest = parseCurrentSquadManifest(envelope.manifest);
  const readiness = evaluateSeasonRosterReadiness(snapshot, manifest);
  if (readiness.status !== 'ready') throw new Error(`Current squad dataset did not pass the required source checks. ${readiness.notes.join(' ')}`);
  return { snapshot, manifest };
}
