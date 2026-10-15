import { describe, expect, it } from 'vitest';
import { ageOnDate, compareValues } from './formatters';

describe('squad sorting', () => {
  it('sorts numeric values numerically and leaves unknowns last in each direction', () => {
    const values = [12, null, 2, 20, null];
    expect([...values].sort((a, b) => compareValues(a, b, 'asc'))).toEqual([2, 12, 20, null, null]);
    expect([...values].sort((a, b) => compareValues(a, b, 'desc'))).toEqual([20, 12, 2, null, null]);
  });
  it('sorts names case-insensitively in both directions', () => {
    const names = ['Zulu', null, 'alpha', 'Bravo'];
    expect([...names].sort((a, b) => compareValues(a, b, 'asc'))).toEqual(['alpha', 'Bravo', 'Zulu', null]);
    expect([...names].sort((a, b) => compareValues(a, b, 'desc'))).toEqual(['Zulu', 'Bravo', 'alpha', null]);
  });
});

describe('age on career date', () => {
  it('uses the birthday boundary rather than subtracting years alone', () => {
    expect(ageOnDate('2000-10-16', '2026-10-15')).toBe(25);
    expect(ageOnDate('2000-10-16', '2026-10-16')).toBe(26);
    expect(ageOnDate(null, '2026-10-15')).toBeNull();
  });
});
