import { describe, expect, it } from 'vitest';
import referenceInput from '../reference/snapshot.json';
import { parseSnapshot } from './schema';
import { ALL_ATTRIBUTE_PATHS, getAttributeValue } from '../domain/attributes';

describe('bundled real-identity reference snapshot', () => {
  it('passes the same untrusted boundary as external imports with explicit source limitations', () => {
    const snapshot = parseSnapshot(referenceInput);
    expect(snapshot.validation.status).toBe('reference-only');
    expect(snapshot.sources.length).toBeGreaterThan(0);
    expect(snapshot.players.length).toBeGreaterThan(0);
    expect(snapshot.clubs.length).toBeGreaterThan(0);
    for (const player of snapshot.players) {
      expect(player.clubId).toBeNull();
      expect(player.dataStatus.completeness).toBe('partial');
      expect(player.provenance.length).toBeGreaterThan(0);
      expect(ALL_ATTRIBUTE_PATHS.every(path => getAttributeValue(player.attributes, path) === null)).toBe(true);
      expect(player.hidden.potential).toBeNull();
    }
  });
});
