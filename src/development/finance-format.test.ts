import { describe, expect, it } from 'vitest';
import { addContractYears, demoMoneyInputValue, formatDemoMoney, parseDemoMoneyInput } from './finance-format';

describe('contract money input', () => {
  it('preserves typed pennies and round-trips the safe accounting limit', () => {
    expect(parseDemoMoneyInput(' 1200.50 ')).toBe(120050);
    expect(parseDemoMoneyInput('0.01')).toBe(1);
    expect(parseDemoMoneyInput('1000')).toBe(100000);
    expect(parseDemoMoneyInput(demoMoneyInputValue(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => parseDemoMoneyInput('90071992547409.92')).toThrow('too large');
  });

  it('refuses ambiguous, negative, exponential or rounded wage values', () => {
    for (const value of ['', '£1200', '1,200', '-1', '1e3', '12.345', 'NaN', 'Infinity']) {
      expect(() => parseDemoMoneyInput(value), value).toThrow();
    }
  });

  it('reports signing bonus input errors using the correct field name', () => {
    expect(parseDemoMoneyInput('12000.50', 'signing bonus')).toBe(1200050);
    expect(() => parseDemoMoneyInput('12.345', 'signing bonus')).toThrow('Enter a signing bonus');
    expect(() => parseDemoMoneyInput('90071992547409.92', 'signing bonus')).toThrow('This signing bonus is too large.');
  });

  it('displays exact pennies for balances, including negative and very large values', () => {
    expect(formatDemoMoney(120050)).toBe('£1,200.50');
    expect(formatDemoMoney(-1)).toBe('-£0.01');
    expect(formatDemoMoney(Number.MAX_SAFE_INTEGER)).toBe('£90,071,992,547,409.91');
  });
});

it('clamps a leap-day renewal limit to the last valid calendar day', () => {
  expect(addContractYears('2028-02-29', 5)).toBe('2033-02-28');
});
