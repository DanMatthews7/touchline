import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '../data';
import { ALL_ATTRIBUTE_PATHS, getAttributeValue } from '../domain';
import poolInput from '../reference/exhibition-snapshot.json';
import originalInput from '../reference/snapshot.json';
import { DEFAULT_INSTRUCTIONS, defaultExhibitionSelection, prepareExhibition, type ExhibitionOptions } from './prepare';

const pool = parseSnapshot(poolInput);
function options(): ExhibitionOptions {
  return {
    id: 'test-reference-exhibition', seed: 202627, ...defaultExhibitionSelection(pool.players),
    homeFormation: '4-4-2', awayFormation: '4-4-2', homeInstructions: { ...DEFAULT_INSTRUCTIONS }, awayInstructions: { ...DEFAULT_INSTRUCTIONS },
    initialCondition: 100, initialMorale: 50, useUniformEstimates: false, homeAdvantage: true,
  };
}

describe('real-identity exhibition boundary', () => {
  it('validates the additional sourced pool without mutating the original career database', () => {
    expect(pool.players).toHaveLength(32);
    expect(pool.players.filter(player => player.positions.includes('GK'))).toHaveLength(5);
    expect(parseSnapshot(originalInput).players).toHaveLength(12);
    for (const player of pool.players) {
      expect(player.clubId).toBeNull();
      expect(ALL_ATTRIBUTE_PATHS.every(path => getAttributeValue(player.attributes, path) === null)).toBe(true);
      expect(player.provenance[0]!.license.name).toBe('CC0-1.0');
    }
  });
  it('requires explicit permission for original uniform comparison estimates', () => {
    expect(() => prepareExhibition(pool.players, options())).toThrow(/unassessed/);
  });
  it('prepares unique temporary selections and preserves known original assessments and unknown biography', () => {
    const catalogue = structuredClone(pool.players);
    const selected = options();
    const keeper = catalogue.find(player => player.id === selected.homePlayerIds[0])!;
    keeper.attributes.goalkeeping.reflexes = 18; // Deliberate automated-test editorial input.
    const before = structuredClone(catalogue);
    const config = prepareExhibition(catalogue, { ...selected, useUniformEstimates: true });
    expect(config.assessmentMode).toBe('uniform-missing-10');
    expect(config.home.players[0]!.attributes.goalkeeping.reflexes).toBe(18);
    expect(config.home.players[0]!.attributes.technical.passing).toBe(10);
    expect(config.home.players.find(player => player.positions.length === 0)).toBeDefined();
    expect(new Set([...config.home.players, ...config.away.players].map(player => player.id)).size).toBe(28);
    expect(catalogue).toEqual(before);
    expect(config.home.players[0]).not.toHaveProperty('hidden');
  });
  it('rejects a real identity selected for both sides', () => {
    const selected = options();
    selected.awayPlayerIds[0] = selected.homePlayerIds[0]!;
    expect(() => prepareExhibition(pool.players, { ...selected, useUniformEstimates: true })).toThrow(/unique|once/i);
  });
});
