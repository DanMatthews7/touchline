import { describe, expect, it } from 'vitest';
import {
  MAX_CAREER_MONEY_MINOR,
  advanceCareerFinances,
  createCareerFinances,
  getClubFinancialSummary,
  parseCareerFinanceConfig,
  recordCareerMatchdayIncome,
  renewCareerContract,
  type CareerFinanceConfig,
  type CareerFinanceState,
} from './index';

function config(): CareerFinanceConfig {
  return {
    engineVersion: 1,
    startDate: '2026-08-01',
    clubs: [
      { clubId: 'club-a', balanceMinor: 1_000_000, transferBudgetMinor: 200_000, weeklyWageBudgetMinor: 100_000, matchdayIncomeMinor: 25_000 },
      { clubId: 'club-b', balanceMinor: 1_000_000, transferBudgetMinor: 200_000, weeklyWageBudgetMinor: 100_000, matchdayIncomeMinor: 25_000 },
    ],
    contracts: [
      { playerId: 'player-a', clubId: 'club-a', startDate: '2026-07-01', endDate: '2028-06-30', weeklyWageMinor: 10_000 },
      { playerId: 'player-b', clubId: 'club-b', startDate: '2026-07-01', endDate: '2028-06-30', weeklyWageMinor: 10_000 },
    ],
  };
}

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function assertBalanced(state: CareerFinanceState): void {
  for (const club of Object.values(state.clubs)) {
    const entries = state.ledger.filter(entry => entry.clubId === club.clubId);
    let balance = club.openingBalanceMinor;
    for (const entry of entries) {
      balance += entry.amountMinor;
      expect(entry.balanceAfterMinor).toBe(balance);
    }
    expect(club.balanceMinor).toBe(balance);
    expect(club.balanceMinor).toBe(club.openingBalanceMinor + club.incomeReceivedMinor - club.wagesPaidMinor);
    expect(club.incomeReceivedMinor).toBe(entries.filter(entry => entry.kind === 'matchday-income').reduce((sum, entry) => sum + entry.amountMinor, 0));
    expect(club.wagesPaidMinor).toBe(-entries.filter(entry => entry.kind === 'wages').reduce((sum, entry) => sum + entry.amountMinor, 0));
  }
}

describe('career contract and finance engine', () => {
  it('accrues earned wages daily and pays completed weeks exactly once for every club', () => {
    const initial = freeze(createCareerFinances(config()));
    const beforePayday = advanceCareerFinances(initial, '2026-08-07');
    expect(beforePayday.ledger).toEqual([]);
    expect(getClubFinancialSummary(beforePayday, 'club-a')).toMatchObject({
      balanceMinor: 1_000_000, weeklyWagesMinor: 10_000, remainingWageBudgetMinor: 90_000,
      accruedWagesMinor: 8_571, totalSpendingMinor: 0, nextPayDate: '2026-08-08',
    });
    const paid = advanceCareerFinances(beforePayday, '2026-08-08');
    expect(paid.ledger).toHaveLength(2);
    for (const club of Object.values(paid.clubs)) {
      expect(club).toMatchObject({ balanceMinor: 990_000, wagesPaidMinor: 10_000, accruedWageNumerator: 0 });
    }
    expect(paid.nextPayDate).toBe('2026-08-15');
    expect(advanceCareerFinances(paid, paid.currentDate)).toEqual(paid);
    expect(initial).toEqual(createCareerFinances(config()));
    assertBalanced(paid);
  });

  it('preserves fractional pennies when two midweek renewals change the rate', () => {
    const input = config();
    input.contracts[0]!.weeklyWageMinor = 101;
    let state = advanceCareerFinances(createCareerFinances(input), '2026-08-04');
    state = renewCareerContract(state, { clubId: 'club-a', playerId: 'player-a', weeklyWageMinor: 102, endDate: '2029-06-30' });
    state = advanceCareerFinances(state, '2026-08-08');
    expect(state.clubs['club-a']).toMatchObject({ wagesPaidMinor: 101, accruedWageNumerator: 4 });
    state = advanceCareerFinances(state, '2026-08-11');
    state = renewCareerContract(state, { clubId: 'club-a', playerId: 'player-a', weeklyWageMinor: 103, endDate: '2030-06-30' });
    state = advanceCareerFinances(state, '2026-08-15');
    expect(state.clubs['club-a']).toMatchObject({ wagesPaidMinor: 204, accruedWageNumerator: 1 });
    expect(state.clubs['club-a']!.wagesPaidMinor * 7 + state.clubs['club-a']!.accruedWageNumerator).toBe(3 * 101 + 4 * 102 + 3 * 102 + 4 * 103);
    assertBalanced(state);
  });

  it('honours inclusive expiry, stops future wages and can renew an expired player without backpay', () => {
    const input = config();
    input.contracts[0]!.endDate = '2026-08-03';
    input.contracts[0]!.weeklyWageMinor = 700;
    let state = advanceCareerFinances(createCareerFinances(input), '2026-08-08');
    expect(getClubFinancialSummary(state, 'club-a')).toMatchObject({ weeklyWagesMinor: 0, totalSpendingMinor: 300, accruedWagesMinor: 0 });
    state = renewCareerContract(state, { clubId: 'club-a', playerId: 'player-a', weeklyWageMinor: 700, endDate: '2027-06-30' });
    state = advanceCareerFinances(state, '2026-08-15');
    expect(state.clubs['club-a']!.wagesPaidMinor).toBe(1_000);
    assertBalanced(state);
  });

  it('records configured home income once, refuses a second owner and conserves cash', () => {
    const initial = freeze(createCareerFinances(config()));
    const receipt = { clubId: 'club-a', fixtureId: 'fixture-1', date: initial.currentDate };
    const state = recordCareerMatchdayIncome(initial, receipt);
    expect(recordCareerMatchdayIncome(freeze(state), receipt)).toEqual(state);
    expect(() => recordCareerMatchdayIncome(state, { ...receipt, clubId: 'club-b' })).toThrow(/different matchday receipt/);
    expect(() => recordCareerMatchdayIncome(state, { ...receipt, fixtureId: 'fixture-2', date: '2026-08-02' })).toThrow(/current career date/);
    expect(state.ledger).toEqual([expect.objectContaining({ fixtureId: 'fixture-1', amountMinor: 25_000, balanceAfterMinor: 1_025_000 })]);
    expect(initial.ledger).toEqual([]);
    assertBalanced(advanceCareerFinances(state, '2026-08-15'));
  });

  it('uses identical terms, cash rules and budgets for each club', () => {
    const initial = freeze(createCareerFinances(config()));
    const states = ['a', 'b'].map(suffix => {
      const clubId = `club-${suffix}`;
      return renewCareerContract(initial, { clubId, playerId: `player-${suffix}`, weeklyWageMinor: 20_000, endDate: '2029-06-30' });
    });
    expect(states[0]!.contracts['player-a']).toMatchObject({ weeklyWageMinor: 20_000, endDate: '2029-06-30' });
    expect(states[1]!.contracts['player-b']).toMatchObject({ weeklyWageMinor: 20_000, endDate: '2029-06-30' });
    for (const suffix of ['a', 'b']) {
      expect(() => renewCareerContract(initial, { clubId: `club-${suffix}`, playerId: `player-${suffix}`, weeklyWageMinor: 100_001, endDate: '2029-06-30' })).toThrow(/wage budget/);
    }
  });

  it('rejects invalid and unaffordable renewals before changing any state', () => {
    const input = config();
    input.clubs[0]!.balanceMinor = 10_000;
    input.clubs[0]!.transferBudgetMinor = 0;
    const state = freeze(createCareerFinances(input));
    const baseline = structuredClone(state);
    const valid = { clubId: 'club-a', playerId: 'player-a', weeklyWageMinor: 10_000, endDate: '2029-06-30' };
    const invalid = [
      { ...valid, clubId: 'club-b' },
      { ...valid, weeklyWageMinor: 9_999 },
      { ...valid, weeklyWageMinor: 10_001 },
      { ...valid, endDate: '2028-06-30' },
      { ...valid, endDate: '2031-08-02' },
      { ...valid, endDate: '2029-02-30' },
    ];
    for (const renewal of invalid) {
      expect(() => renewCareerContract(state, renewal)).toThrow();
      expect(state).toEqual(baseline);
    }
    expect(renewCareerContract(state, valid).contracts['player-a']!.endDate).toBe('2029-06-30');
  });

  it('allows cash to become negative after wages and blocks new commitments without funding', () => {
    const input = config();
    input.clubs[0]!.balanceMinor = 5_000;
    input.clubs[0]!.transferBudgetMinor = 0;
    const state = advanceCareerFinances(createCareerFinances(input), '2026-08-08');
    expect(state.clubs['club-a']!.balanceMinor).toBe(-5_000);
    expect(() => renewCareerContract(state, { clubId: 'club-a', playerId: 'player-a', weeklyWageMinor: 10_000, endDate: '2029-06-30' })).toThrow(/cannot fund one full week/);
    expect(state.ledger[0]).toMatchObject({ amountMinor: -10_000, balanceAfterMinor: -5_000 });
    assertBalanced(state);
  });

  it('replays a long calendar identically across split decisions and checks every ledger balance', () => {
    const initial = freeze(createCareerFinances(config()));
    const single = advanceCareerFinances(initial, '2036-08-01');
    const split = advanceCareerFinances(advanceCareerFinances(initial, '2031-08-01'), '2036-08-01');
    expect(single).toEqual(split);
    expect(single.currentDate).toBe('2036-08-01');
    expect(single.ledger.length).toBeGreaterThan(100);
    expect(new Set(single.ledger.map(entry => entry.id)).size).toBe(single.ledger.length);
    assertBalanced(single);
  });

  it('rejects unsupported dates, overflowing money and malformed graph inputs without mutation', () => {
    const initial = freeze(createCareerFinances(config()));
    for (const toDate of ['2026-02-30', '2026-07-31', '2036-08-02', '10000-01-01']) {
      expect(() => advanceCareerFinances(initial, toDate)).toThrow();
    }
    const overflow = config();
    overflow.clubs[0]!.balanceMinor = MAX_CAREER_MONEY_MINOR;
    const rich = freeze(createCareerFinances(overflow));
    expect(() => recordCareerMatchdayIncome(rich, { clubId: 'club-a', fixtureId: 'overflow', date: rich.currentDate })).toThrow(/integer range/);
    expect(rich.clubs['club-a']!.balanceMinor).toBe(MAX_CAREER_MONEY_MINOR);
    expect(rich.ledger).toEqual([]);
    const duplicate = config();
    duplicate.contracts.push({ ...duplicate.contracts[0]! });
    expect(() => parseCareerFinanceConfig(duplicate)).toThrow(/more than one initial contract/);
    const unknown = config();
    unknown.contracts[0]!.clubId = 'unknown';
    expect(() => parseCareerFinanceConfig(unknown)).toThrow(/unknown club/);
    const future = config();
    future.contracts[0]!.startDate = '2026-08-02';
    expect(() => parseCareerFinanceConfig(future)).toThrow(/future signings/);
    const malformed = config();
    malformed.clubs[0]!.balanceMinor = MAX_CAREER_MONEY_MINOR + 1;
    expect(() => parseCareerFinanceConfig(malformed)).toThrow();
    expect(() => parseCareerFinanceConfig({ ...config(), startDate: '9999-12-31' })).toThrow(/calendar/);
    expect(initial).toEqual(createCareerFinances(config()));
  });

  it('uses the fifth anniversary as the renewal limit, including leap-day dates', () => {
    const input = config();
    input.startDate = '2028-02-29';
    const state = createCareerFinances(input);
    expect(() => renewCareerContract(state, { clubId: 'club-a', playerId: 'player-a', weeklyWageMinor: 10_000, endDate: '2033-03-01' })).toThrow(/five years/);
    expect(renewCareerContract(state, { clubId: 'club-a', playerId: 'player-a', weeklyWageMinor: 10_000, endDate: '2033-02-28' }).contracts['player-a']!.endDate).toBe('2033-02-28');
  });
});
