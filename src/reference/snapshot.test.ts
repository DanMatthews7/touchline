import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '../data';
import { ALL_ATTRIBUTE_PATHS, getAttributeValue } from '../domain';
import source from './snapshot.json';

describe('shipped real-player reference data', () => {
  it('passes the same strict boundary used for external database imports', () => {
    const snapshot = parseSnapshot(source);
    expect(snapshot.players).toHaveLength(12);
    expect(snapshot.clubs).toHaveLength(4);
    expect(snapshot.validation.status).toBe('reference-only');
    expect(snapshot.sources.every(item => item.license.name === 'CC0-1.0')).toBe(true);
  });
  it('makes no unsupported squad, rating, nationality or hidden-potential claims', () => {
    for (const player of parseSnapshot(source).players) {
      expect(player.clubId).toBeNull();
      expect(player.nationality).toEqual([]);
      expect(player.hidden.potential).toBeNull();
      expect(ALL_ATTRIBUTE_PATHS.every(path => getAttributeValue(player.attributes, path) === null)).toBe(true);
      expect(player.provenance[0]!.sourceDate).toBeNull();
    }
  });
});
