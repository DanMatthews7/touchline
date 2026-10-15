import { describe, expect, it } from 'vitest';
import { parseSnapshot, VersionCompatibilityError } from './schema';
import { syntheticSnapshot } from './__tests__/fixtures';

describe('provider-independent snapshot boundary', () => {
  it('preserves unknown data and accepts explicitly assessed original attributes', () => {
    expect(parseSnapshot(syntheticSnapshot()).players[0]!.attributes.technical.passing).toBeNull();
    expect(parseSnapshot(syntheticSnapshot(true)).players[0]!.attributes.technical.passing).toBe(10);
  });

  it.each([0, 21, 1.5, Infinity, NaN])('rejects invalid attribute %s', value => {
    const snapshot = syntheticSnapshot(true);
    snapshot.players[0]!.attributes.technical.passing = value;
    expect(() => parseSnapshot(snapshot)).toThrow();
  });

  it('requires an original assessment and registered evidence for every known attribute', () => {
    const snapshot = syntheticSnapshot();
    snapshot.players[0]!.attributes.technical.passing = 10;
    expect(() => parseSnapshot(snapshot)).toThrow(/assessment/);
    const assessed = syntheticSnapshot(true);
    assessed.players[0]!.attributeAssessments['technical.passing']!.evidenceSourceIds = ['absent-source'];
    expect(() => parseSnapshot(assessed)).toThrow(/registered source/);
  });

  it('rejects duplicate IDs and dangling player and competition clubs', () => {
    const duplicate = syntheticSnapshot();
    duplicate.players.push(structuredClone(duplicate.players[0]!));
    expect(() => parseSnapshot(duplicate)).toThrow(/Duplicate/);
    const missingClub = syntheticSnapshot();
    missingClub.players[0]!.clubId = 'absent-club';
    expect(() => parseSnapshot(missingClub)).toThrow(/absent/);
    const competition = syntheticSnapshot();
    competition.competitions[0]!.clubIds.push('absent-club');
    expect(() => parseSnapshot(competition)).toThrow(/absent/);
  });

  it('requires complete provenance, safe URLs, source registration and real calendar dates', () => {
    const missing = syntheticSnapshot();
    missing.players[0]!.provenance = [];
    expect(() => parseSnapshot(missing)).toThrow();
    const unsafe = syntheticSnapshot();
    unsafe.sources[0]!.url = 'javascript:alert(1)';
    expect(() => parseSnapshot(unsafe)).toThrow(/HTTP/);
    const credentials = syntheticSnapshot();
    credentials.sources[0]!.url = 'https://secret@example.com/data';
    expect(() => parseSnapshot(credentials)).toThrow(/credentials/);
    const unregistered = syntheticSnapshot();
    unregistered.sources = [];
    expect(() => parseSnapshot(unregistered)).toThrow(/registered/);
    const date = syntheticSnapshot();
    date.players[0]!.dateOfBirth = '2001-02-29';
    expect(() => parseSnapshot(date)).toThrow(/calendar/);
  });

  it('does not coerce values or accept extra fields in verified factual records', () => {
    const snapshot = syntheticSnapshot();
    const withSourceRatings = { ...snapshot, players: [{ ...snapshot.players[0], sourceRatings: { passing: 20 } }] };
    expect(() => parseSnapshot(withSourceRatings)).toThrow();
    const oversized = syntheticSnapshot();
    oversized.players[0]!.name = 'x'.repeat(241);
    expect(() => parseSnapshot(oversized)).toThrow();
    expect(() => parseSnapshot(JSON.parse(JSON.stringify(snapshot).replace('"schemaVersion":1', '"schemaVersion":"1"')))).toThrow();
  });

  it('enforces integer money, nonnegative budgets and a single club currency', () => {
    const fractional = syntheticSnapshot();
    fractional.clubs[0]!.finances!.balance.amountMinor = 1.2;
    expect(() => parseSnapshot(fractional)).toThrow();
    const negativeBudget = syntheticSnapshot();
    negativeBudget.clubs[0]!.finances!.transferBudget.amountMinor = -1;
    expect(() => parseSnapshot(negativeBudget)).toThrow();
    const currency = syntheticSnapshot();
    currency.clubs[0]!.finances!.weeklyWageBudget.currency = 'EUR';
    expect(() => parseSnapshot(currency)).toThrow(/currency/);
  });

  it.each([0, 2, 999])('rejects unsupported snapshot version %s without guessing a migration', version => {
    expect(() => parseSnapshot({ ...syntheticSnapshot(), schemaVersion: version })).toThrow(VersionCompatibilityError);
  });
});
