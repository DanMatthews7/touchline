import { describe, expect, it } from 'vitest';
import { ALL_ATTRIBUTE_PATHS, ATTRIBUTE_KEYS, createUnknownAttributes, type AttributePath, type PlayerAttributes } from './attributes';
import { visiblePlayer, type Club, type DatabaseSnapshot, type Player } from './models';
import { calculateRoleRating, ROLE_DEFINITIONS } from './ratings';
import { validateAttributes, validateDatabaseInvariants, validateMoney, validateTactics } from './validation';

// Synthetic records are restricted to automated tests and never shipped as real-player data.
const testClub = (id = 'test-club'): Club => ({ id, name: 'Synthetic Test Club', shortName: 'TEST', country: 'Test country', stadium: null, primaryColor: null, finances: null, dataStatus: { validation: 'needs-review', completeness: 'partial', notes: ['Synthetic automated-test fixture.'] }, provenance: [] });
const testPlayer = (): Player => ({ id: 'test-player', name: 'Synthetic Test Player', dateOfBirth: null, nationality: [], positions: ['ST'], preferredFoot: 'unknown', clubId: 'test-club', attributes: createUnknownAttributes(), attributeAssessments: {}, hidden: { personality: { ambition: 19 }, currentDevelopmentLevel: 12, potential: 17 }, dataStatus: { validation: 'needs-review', completeness: 'partial', notes: ['Synthetic automated-test fixture.'] }, provenance: [] });
function setValue(attributes: PlayerAttributes, path: AttributePath, value: number | null) {
  const [group, key] = path.split('.') as [keyof PlayerAttributes, string];
  (attributes[group] as Record<string, number | null>)[key] = value;
}
function strikerAt(value: number) {
  const player = testPlayer();
  for (const path of Object.keys(ROLE_DEFINITIONS.striker.weights) as AttributePath[]) setValue(player.attributes, path, value);
  return player;
}
const testSnapshot = (): Pick<DatabaseSnapshot, 'players' | 'clubs' | 'competitions' | 'sources'> => ({ players: [testPlayer()], clubs: [testClub()], competitions: [], sources: [] });

describe('attribute vocabulary and uncertainty', () => {
  it('contains all 45 individual attributes in the specified groups, initially unassessed', () => {
    expect(Object.values(ATTRIBUTE_KEYS).map(keys => keys.length)).toEqual([14, 14, 8, 9]);
    expect(ALL_ATTRIBUTE_PATHS).toHaveLength(45);
    expect(new Set(ALL_ATTRIBUTE_PATHS).size).toBe(45);
    const attributes = createUnknownAttributes();
    expect(Object.values(attributes).flatMap(group => Object.values(group))).toEqual(Array(45).fill(null));
    expect(validateAttributes(attributes)).toEqual([]);
  });

  it.each([0, 21, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid attribute %s', value => {
    const attributes = createUnknownAttributes();
    attributes.technical.passing = value;
    expect(validateAttributes(attributes)).toEqual([{ path: 'attributes.technical.passing', message: 'Expected null or an integer from 1 to 20.' }]);
  });

  it('keeps hidden personality and potential out of the visible-player projection', () => {
    const player = testPlayer();
    const visible = visiblePlayer(player);
    expect(visible).not.toHaveProperty('hidden');
    expect(visible.name).toBe(player.name);
    expect(player.hidden.potential).toBe(17);
  });
});

describe('original position-specific role ratings', () => {
  it('maps the complete rating scale endpoints and middle correctly', () => {
    expect(calculateRoleRating(strikerAt(1), 'striker').rating).toBe(1);
    expect(calculateRoleRating(strikerAt(20), 'striker').rating).toBe(100);
    expect(calculateRoleRating(strikerAt(11), 'striker').rating).toBe(53);
  });

  it('weights finishing more heavily than heading for a striker', () => {
    const finisher = strikerAt(1);
    finisher.attributes.technical.finishing = 20;
    const header = strikerAt(1);
    header.attributes.technical.heading = 20;
    expect(calculateRoleRating(finisher, 'striker').rating).toBe(21);
    expect(calculateRoleRating(header, 'striker').rating).toBe(9);
  });

  it('does not impute an average when one required attribute is unknown', () => {
    const player = strikerAt(20);
    player.attributes.mental.composure = null;
    expect(calculateRoleRating(player, 'striker')).toEqual({ status: 'unassessed', rating: null, missingAttributes: ['mental.composure'], reason: 'missing-attributes' });
  });

  it('does not treat an assessed striker as a familiar centre back', () => {
    const player = strikerAt(20);
    for (const path of Object.keys(ROLE_DEFINITIONS.centreBack.weights) as AttributePath[]) setValue(player.attributes, path, 20);
    expect(calculateRoleRating(player, 'centreBack').reason).toBe('unfamiliar-position');
    expect(calculateRoleRating(player, 'striker').rating).toBe(100);
  });
});

describe('database and squad invariants', () => {
  it('rejects duplicate identifiers, missing clubs and invalid competition membership', () => {
    const snapshot = testSnapshot();
    snapshot.players.push({ ...testPlayer(), clubId: 'missing-club' });
    snapshot.competitions.push({ id: 'test-league', name: 'Synthetic Test League', country: 'Test country', season: '2026/27', format: 'league', clubIds: ['test-club', 'test-club', 'missing-club'], provenance: [] });
    expect(validateDatabaseInvariants(snapshot).map(issue => issue.path)).toEqual(['players.1.id', 'players.1.clubId', 'competitions.0.clubIds', 'competitions.0.clubIds']);
  });

  it('permits explicitly unknown club assignments', () => {
    const snapshot = testSnapshot();
    snapshot.players[0]!.clubId = null;
    expect(validateDatabaseInvariants(snapshot)).toEqual([]);
  });

  it('rejects fractional and unsafe minor-unit accounting', () => {
    expect(validateMoney({ amountMinor: 12345, currency: 'GBP' })).toEqual([]);
    expect(validateMoney({ amountMinor: -100, currency: 'GBP' })).toEqual([]);
    expect(validateMoney({ amountMinor: 10.99, currency: 'GBP' })).toHaveLength(1);
    expect(validateMoney({ amountMinor: Number.MAX_SAFE_INTEGER + 1, currency: 'GBP' })).toHaveLength(1);
  });

  it('rejects mixed-currency ledgers and negative spending budgets while allowing debt', () => {
    const snapshot = testSnapshot();
    snapshot.clubs[0]!.finances = { balance: { amountMinor: -100, currency: 'GBP' }, transferBudget: { amountMinor: 100, currency: 'EUR' }, weeklyWageBudget: { amountMinor: -100, currency: 'GBP' } };
    expect(validateDatabaseInvariants(snapshot).map(issue => issue.path)).toEqual(['clubs.0.finances.transferBudget.currency', 'clubs.0.finances.weeklyWageBudget.amountMinor']);
  });

  it('rejects a player occupying both a starting slot and the bench', () => {
    const slots = Array.from({ length: 11 }, (_, index) => ({ slotId: `slot-${index}`, position: index === 0 ? 'GK' as const : 'CM' as const, role: index === 0 ? 'goalkeeper' as const : 'centralMidfielder' as const, playerId: index === 0 ? 'test-player' : null }));
    const issues = validateTactics({ clubId: 'test-club', formation: '4-4-2', startingXI: slots, substitutes: ['test-player'], instructions: { mentality: 'balanced', tempo: 'standard', width: 'standard', pressingIntensity: 'standard', defensiveLine: 'standard' } }, [testPlayer()], [testClub()]);
    expect(issues.some(issue => issue.message.includes('multiple squad places'))).toBe(true);
  });
});
