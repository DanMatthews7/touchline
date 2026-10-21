import { describe, expect, it } from 'vitest';
import {
  advanceCareerFinances, assessCareerContractOffer, createCareerFinances, getClubFinancialSummary,
  MAX_CAREER_MONEY_MINOR, negotiateCareerContract, renewCareerContract,
  type CareerContractOffer, type CareerFinanceConfig, type CareerFinanceState,
} from './index';

function config(balanceMinor = 10_000_000): CareerFinanceConfig {
  return {
    engineVersion: 1, startDate: '2026-10-21',
    clubs: ['a', 'b'].map(clubId => ({ clubId, balanceMinor, transferBudgetMinor: 0, weeklyWageBudgetMinor: 500_000, matchdayIncomeMinor: 1_000 })),
    contracts: ['a', 'b'].map(clubId => ({ playerId: `player-${clubId}`, clubId, startDate: '2026-10-01', endDate: '2028-10-20', weeklyWageMinor: 100_000 })),
  };
}
function offer(overrides: Partial<CareerContractOffer> = {}): CareerContractOffer {
  return { negotiationVersion: 1, clubId: 'a', playerId: 'player-a', weeklyWageMinor: 90_000, endDate: '2029-10-20', signingBonusMinor: 0, ...overrides };
}
const unknown = { birthDate: null };
function assertAccounting(state: CareerFinanceState): void {
  for (const club of Object.values(state.clubs)) {
    const entries = state.ledger.filter(entry => entry.clubId === club.clubId);
    let balance = club.openingBalanceMinor;
    for (const entry of entries) {
      balance += entry.amountMinor;
      expect(entry.balanceAfterMinor).toBe(balance);
    }
    const summary = getClubFinancialSummary(state, club.clubId);
    expect(club.balanceMinor).toBe(balance);
    expect(summary.balanceMinor).toBe(club.openingBalanceMinor + summary.totalIncomeMinor - summary.totalSpendingMinor);
  }
}

describe('version-1 negotiated contract offers', () => {
  it('uses known current age at exact birthday thresholds and never infers an unknown age', () => {
    const state = createCareerFinances(config());
    expect(assessCareerContractOffer(state, offer(), unknown)).toMatchObject({ accepted: false, ageYears: null, concessionPercent: 0, minimumWeeklyWageMinor: 100_000 });
    expect(assessCareerContractOffer(state, offer(), { birthDate: '1994-10-22' })).toMatchObject({ accepted: false, ageYears: 31, concessionPercent: 0 });
    expect(assessCareerContractOffer(state, offer(), { birthDate: '1994-10-21' })).toMatchObject({ accepted: true, ageYears: 32, concessionPercent: 10, requiredSigningBonusMinor: 0 });
    expect(assessCareerContractOffer(state, offer({ weeklyWageMinor: 80_000 }), { birthDate: '1991-10-21' })).toMatchObject({ accepted: true, ageYears: 35, concessionPercent: 20 });
    expect(() => assessCareerContractOffer(state, offer(), { birthDate: '2027-01-01' })).toThrow(/birth date/);
  });

  it('derives distress from pre-offer cash and requires an extra guaranteed year for concessions', () => {
    const state = createCareerFinances(config(1_299_999));
    expect(assessCareerContractOffer(state, offer(), unknown)).toMatchObject({ accepted: true, financialPressure: true, concessionPercent: 10 });
    expect(assessCareerContractOffer(createCareerFinances(config(1_300_000)), offer(), unknown)).toMatchObject({ accepted: false, financialPressure: false });
    expect(assessCareerContractOffer(state, offer({ endDate: '2029-10-19' }), unknown)).toMatchObject({ accepted: false, concessionPercent: 0 });
    expect(assessCareerContractOffer(state, offer({ weeklyWageMinor: 80_000 }), { birthDate: '1991-10-21' })).toMatchObject({ accepted: true, concessionPercent: 20 });
    // A proposed bonus cannot manufacture financial pressure for its own offer.
    expect(assessCareerContractOffer(createCareerFinances(config(1_400_000)), offer({ signingBonusMinor: 100_001 }), unknown)).toMatchObject({ financialPressure: false, concessionPercent: 0 });
  });

  it('requires compensation for the full offered term, rounded up to a penny, before accepting a cut', () => {
    const initial = createCareerFinances(config());
    const assessment = assessCareerContractOffer(initial, offer(), unknown);
    const days = (Date.parse('2029-10-20T00:00:00Z') - Date.parse('2026-10-21T00:00:00Z')) / 86_400_000 + 1;
    const required = Number((10_000n * BigInt(days) + 6n) / 7n);
    expect(assessment.requiredSigningBonusMinor).toBe(required);
    expect(required).toBeGreaterThan(52 * 10_000);
    const baseline = structuredClone(initial);
    expect(() => negotiateCareerContract(initial, offer({ signingBonusMinor: required - 1 }), unknown)).toThrow(/Player declined/);
    expect(initial).toEqual(baseline);
    const accepted = negotiateCareerContract(initial, offer({ signingBonusMinor: required }), unknown);
    expect(accepted.contracts['player-a']!.weeklyWageMinor).toBe(90_000);
    expect(accepted.clubs.a!.balanceMinor).toBe(10_000_000 - required);
    expect(accepted.clubs.a!.wagesPaidMinor).toBe(0);
    expect(accepted.ledger).toEqual([expect.objectContaining({ kind: 'signing-bonus', amountMinor: -required, playerId: 'player-a' })]);
    expect(getClubFinancialSummary(accepted, 'a')).toMatchObject({ totalBonusesMinor: required, totalSpendingMinor: required });
    assertAccounting(advanceCareerFinances(accepted, '2026-10-28'));
  });

  it('preserves already earned wages and rounding carry when a negotiated reduction begins midweek', () => {
    const input = config();
    input.contracts[0]!.weeklyWageMinor = 101;
    let state = advanceCareerFinances(createCareerFinances(input), '2026-10-24');
    state = negotiateCareerContract(state, offer({ weeklyWageMinor: 91 }), { birthDate: '1994-10-21' });
    state = advanceCareerFinances(state, '2026-10-28');
    expect(state.clubs.a).toMatchObject({ wagesPaidMinor: 95, accruedWageNumerator: 2 });
    expect(state.clubs.a!.wagesPaidMinor * 7 + state.clubs.a!.accruedWageNumerator).toBe(3 * 101 + 4 * 91);
    assertAccounting(state);
  });

  it('anchors concession floors rather than permitting repeated compounded reductions', () => {
    const context = { birthDate: '1994-10-21' };
    let state = negotiateCareerContract(createCareerFinances(config()), offer(), context);
    expect(state.contracts['player-a']!.negotiation).toEqual({ referenceWeeklyWageMinor: 100_000, sequence: 1 });
    expect(assessCareerContractOffer(state, offer({ weeklyWageMinor: 81_000, endDate: '2030-10-20' }), context)).toMatchObject({ accepted: false, minimumWeeklyWageMinor: 90_000 });
    state = renewCareerContract(state, { clubId: 'a', playerId: 'player-a', weeklyWageMinor: 200_000, endDate: '2030-10-20' });
    expect(state.contracts['player-a']!.negotiation!.referenceWeeklyWageMinor).toBe(200_000);
    expect(assessCareerContractOffer(state, offer({ weeklyWageMinor: 170_000, endDate: '2031-10-20' }), context)).toMatchObject({ accepted: false, minimumWeeklyWageMinor: 180_000 });
  });

  it('retains identity, budget and term constraints and requires bonus plus a full week of cash', () => {
    const state = createCareerFinances(config(100_000));
    expect(assessCareerContractOffer(state, offer({ weeklyWageMinor: 100_000, signingBonusMinor: 1 }), unknown)).toMatchObject({ accepted: false, explanation: expect.stringContaining('cannot fund') });
    expect(assessCareerContractOffer(state, offer({ weeklyWageMinor: 500_001 }), unknown)).toMatchObject({ accepted: false, explanation: expect.stringContaining('wage budget') });
    expect(assessCareerContractOffer(state, offer({ endDate: '2031-10-22' }), unknown)).toMatchObject({ accepted: false, explanation: expect.stringContaining('five years') });
    expect(assessCareerContractOffer(state, offer({ endDate: '2028-10-20' }), unknown)).toMatchObject({ accepted: false, explanation: expect.stringContaining('extend') });
    expect(() => assessCareerContractOffer(state, offer({ clubId: 'b' }), unknown)).toThrow(/contracted/);
    expect(() => assessCareerContractOffer(state, offer({ signingBonusMinor: -1 }), unknown)).toThrow();
    expect(() => assessCareerContractOffer(state, offer({ signingBonusMinor: MAX_CAREER_MONEY_MINOR + 1 }), unknown)).toThrow();
    expect(() => assessCareerContractOffer(state, { ...offer(), negotiationVersion: 2 } as unknown as CareerContractOffer, unknown)).toThrow();
  });

  it('uses equal club rules and unique replay-stable bonus entries for repeated or same-day offers', () => {
    const initial = createCareerFinances(config());
    const first = offer({ weeklyWageMinor: 100_000, signingBonusMinor: 100 });
    const second = offer({ clubId: 'b', playerId: 'player-b', weeklyWageMinor: 100_000, signingBonusMinor: 100 });
    const third = offer({ weeklyWageMinor: 110_000, endDate: '2030-10-20', signingBonusMinor: 100 });
    const replay = () => [first, second, third].reduce((state, decision) => negotiateCareerContract(state, decision, unknown), createCareerFinances(config()));
    const state = replay();
    expect(replay()).toEqual(state);
    expect(state.ledger).toHaveLength(3);
    expect(new Set(state.ledger.map(entry => entry.id)).size).toBe(3);
    expect(state.ledger.map(entry => entry.id)).toEqual(['signing-bonus:a:player-a:1', 'signing-bonus:b:player-b:1', 'signing-bonus:a:player-a:2']);
    expect(initial.ledger).toEqual([]);
    assertAccounting(state);
  });

  it('leaves the legacy no-cut renewal and initial contract shape unchanged', () => {
    const state = createCareerFinances(config());
    expect(state.contracts['player-a']).not.toHaveProperty('negotiation');
    expect(() => renewCareerContract(state, { clubId: 'a', playerId: 'player-a', weeklyWageMinor: 90_000, endDate: '2029-10-20' })).toThrow(/cannot reduce/);
    const legacy = renewCareerContract(state, { clubId: 'a', playerId: 'player-a', weeklyWageMinor: 100_000, endDate: '2029-10-20' });
    expect(legacy.contracts['player-a']).not.toHaveProperty('negotiation');
  });

  it('rejects total-spending overflow before an offer or later payday can commit it', () => {
    const input = config(MAX_CAREER_MONEY_MINOR);
    const initial = createCareerFinances(input);
    let state = negotiateCareerContract(initial, offer({ weeklyWageMinor: 100_000, signingBonusMinor: MAX_CAREER_MONEY_MINOR - 100_000 }), unknown);
    state = advanceCareerFinances(state, '2026-10-28');
    expect(getClubFinancialSummary(state, 'a').totalSpendingMinor).toBe(MAX_CAREER_MONEY_MINOR);
    const baseline = structuredClone(state);
    expect(() => advanceCareerFinances(state, '2026-11-04')).toThrow(/integer range/);
    expect(() => negotiateCareerContract(state, offer({ weeklyWageMinor: 100_000, endDate: '2030-10-20', signingBonusMinor: 1 }), unknown)).toThrow(/integer range/);
    expect(state).toEqual(baseline);
  });
});
