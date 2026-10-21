import { z } from 'zod';
import { isDateOnly } from '../commands';

export const CAREER_FINANCE_ENGINE_VERSION = 1 as const;
export const MAX_CAREER_MONEY_MINOR = 1_000_000_000_000_000;
export const MAX_WEEKLY_WAGE_MINOR = 1_000_000_000;
export const MAX_FINANCE_ADVANCE_DAYS = 3_653;
export const CAREER_CONTRACT_NEGOTIATION_VERSION = 1 as const;

export interface CareerContract {
  playerId: string;
  clubId: string;
  startDate: string;
  endDate: string;
  weeklyWageMinor: number;
  /** Created by versioned negotiation decisions, never supplied by an initial config. */
  negotiation?: { referenceWeeklyWageMinor: number; sequence: number };
}
export interface CareerClubFinanceConfig {
  clubId: string;
  balanceMinor: number;
  transferBudgetMinor: number;
  weeklyWageBudgetMinor: number;
  matchdayIncomeMinor: number;
}
export interface CareerFinanceConfig {
  engineVersion: typeof CAREER_FINANCE_ENGINE_VERSION;
  startDate: string;
  clubs: CareerClubFinanceConfig[];
  contracts: CareerContract[];
}
export interface CareerClubFinanceState extends CareerClubFinanceConfig {
  openingBalanceMinor: number;
  /** Seventh-minor-units owed; includes sub-penny rounding carried past payday. */
  accruedWageNumerator: number;
  wagesPaidMinor: number;
  incomeReceivedMinor: number;
}
export interface CareerFinanceTransaction {
  id: string;
  date: string;
  clubId: string;
  kind: 'wages' | 'matchday-income' | 'signing-bonus';
  amountMinor: number;
  balanceAfterMinor: number;
  fixtureId: string | null;
  playerId?: string;
}
export interface CareerFinanceState {
  engineVersion: typeof CAREER_FINANCE_ENGINE_VERSION;
  currency: 'GBP';
  startDate: string;
  currentDate: string;
  nextPayDate: string;
  clubs: Record<string, CareerClubFinanceState>;
  contracts: Record<string, CareerContract>;
  ledger: CareerFinanceTransaction[];
  processedFixtures: Record<string, { clubId: string; date: string; amountMinor: number }>;
}
export interface ClubFinancialSummary {
  clubId: string;
  currency: 'GBP';
  balanceMinor: number;
  transferBudgetMinor: number;
  weeklyWageBudgetMinor: number;
  weeklyWagesMinor: number;
  remainingWageBudgetMinor: number;
  totalIncomeMinor: number;
  totalSpendingMinor: number;
  totalBonusesMinor: number;
  accruedWagesMinor: number;
  nextPayDate: string;
}
export interface CareerContractRenewal {
  clubId: string;
  playerId: string;
  weeklyWageMinor: number;
  endDate: string;
}
export interface CareerMatchdayIncome { clubId: string; fixtureId: string; date: string }
export interface CareerContractOffer extends CareerContractRenewal {
  negotiationVersion: typeof CAREER_CONTRACT_NEGOTIATION_VERSION;
  signingBonusMinor: number;
}
/** Trusted career/source context; unknown birth dates must stay null. */
export interface CareerNegotiationContext { birthDate: string | null }
export interface CareerContractOfferAssessment {
  accepted: boolean;
  explanation: string;
  ageYears: number | null;
  financialPressure: boolean;
  concessionPercent: number;
  minimumWeeklyWageMinor: number;
  requiredSigningBonusMinor: number;
  projectedWeeklyWagesMinor: number;
}

const identifier = z.string().min(1).max(180).regex(/^[A-Za-z0-9][A-Za-z0-9:._-]*$/)
  .refine(value => !['__proto__', 'constructor', 'prototype'].includes(value), 'Unsupported identifier.');
const date = z.string().refine(isDateOnly, 'Use a real YYYY-MM-DD date.');
const positiveMoney = z.number().int().min(0).max(MAX_CAREER_MONEY_MINOR);
const wage = z.number().int().min(0).max(MAX_WEEKLY_WAGE_MINOR);
const contractSchema = z.object({ playerId: identifier, clubId: identifier, startDate: date, endDate: date, weeklyWageMinor: wage }).strict();
const clubSchema = z.object({
  clubId: identifier, balanceMinor: positiveMoney, transferBudgetMinor: positiveMoney,
  weeklyWageBudgetMinor: positiveMoney, matchdayIncomeMinor: positiveMoney,
}).strict();
const configSchema = z.object({
  engineVersion: z.literal(CAREER_FINANCE_ENGINE_VERSION), startDate: date,
  clubs: z.array(clubSchema).min(1).max(200), contracts: z.array(contractSchema).max(10_000),
}).strict();

function safeAmount(amount: number): number {
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > MAX_CAREER_MONEY_MINOR) throw new Error('The financial amount exceeds the supported integer range.');
  return amount;
}
function addDays(value: string, days: number): string {
  const result = new Date(Date.parse(`${value}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  if (!isDateOnly(result)) throw new Error('The financial calendar exceeds supported four-digit dates.');
  return result;
}
function fiveYearsAfter(value: string): string {
  const result = new Date(`${value}T00:00:00Z`);
  const month = result.getUTCMonth();
  result.setUTCFullYear(result.getUTCFullYear() + 5);
  if (result.getUTCMonth() !== month) result.setUTCDate(0);
  const formatted = result.toISOString().slice(0, 10);
  if (!isDateOnly(formatted)) throw new Error('The contract date exceeds the supported calendar.');
  return formatted;
}
function requireClub(state: CareerFinanceState, clubId: string): CareerClubFinanceState {
  identifier.parse(clubId);
  const club = Object.hasOwn(state.clubs, clubId) ? state.clubs[clubId] : undefined;
  if (!club) throw new Error('The club is not part of this financial career.');
  return club;
}
function active(contract: CareerContract, currentDate: string): boolean {
  return contract.startDate <= currentDate && currentDate <= contract.endDate;
}
function weeklyWages(state: CareerFinanceState, clubId: string): number {
  return Object.values(state.contracts).reduce((sum, contract) => contract.clubId === clubId && active(contract, state.currentDate) ? safeAmount(sum + contract.weeklyWageMinor) : sum, 0);
}

export function parseCareerFinanceConfig(input: unknown): CareerFinanceConfig {
  const config = configSchema.parse(input);
  const clubs = new Set<string>();
  for (const club of config.clubs) {
    if (clubs.has(club.clubId)) throw new Error('Financial club identifiers must be unique.');
    if (club.transferBudgetMinor > club.balanceMinor) throw new Error('An opening transfer budget cannot exceed the opening club balance.');
    clubs.add(club.clubId);
  }
  const players = new Set<string>();
  for (const contract of config.contracts) {
    if (players.has(contract.playerId)) throw new Error('A player cannot hold more than one initial contract.');
    if (!clubs.has(contract.clubId)) throw new Error('A contract references an unknown club.');
    if (contract.endDate < contract.startDate) throw new Error('A contract cannot expire before its start date.');
    if (contract.startDate > config.startDate) throw new Error('Initial contracts must already have started; future signings are not part of this career slice.');
    players.add(contract.playerId);
  }
  // Ensure a first payday is representable even before the calendar advances.
  addDays(config.startDate, 7);
  return config;
}

/** Construct a career from explicit model inputs; no real financial facts are inferred. */
export function createCareerFinances(input: CareerFinanceConfig): CareerFinanceState {
  const config = parseCareerFinanceConfig(input);
  const state: CareerFinanceState = {
    engineVersion: CAREER_FINANCE_ENGINE_VERSION, currency: 'GBP', startDate: config.startDate,
    currentDate: config.startDate, nextPayDate: addDays(config.startDate, 7),
    clubs: Object.fromEntries(config.clubs.map(club => [club.clubId, {
      ...club, openingBalanceMinor: club.balanceMinor, accruedWageNumerator: 0, wagesPaidMinor: 0, incomeReceivedMinor: 0,
    }])),
    contracts: Object.fromEntries(config.contracts.map(contract => [contract.playerId, { ...contract }])),
    ledger: [], processedFixtures: {},
  };
  for (const club of config.clubs) {
    if (weeklyWages(state, club.clubId) > club.weeklyWageBudgetMinor) throw new Error('Initial active wages exceed the club wage budget.');
  }
  return state;
}

/** Process [old date, new date), paying completed seven-day periods on payday. */
export function advanceCareerFinances(state: CareerFinanceState, toDateInput: string): CareerFinanceState {
  const toDate = date.parse(toDateInput);
  if (toDate < state.currentDate) throw new Error('The financial calendar cannot move backwards.');
  const days = (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${state.currentDate}T00:00:00Z`)) / 86_400_000;
  if (days > MAX_FINANCE_ADVANCE_DAYS) throw new Error('A single financial calendar decision cannot exceed ten years.');
  const next = structuredClone(state);
  const contracts = Object.values(next.contracts);
  const bonusTotals = Object.fromEntries(Object.keys(next.clubs).map(clubId => [clubId, next.ledger.reduce((total, entry) => entry.clubId === clubId && entry.kind === 'signing-bonus' ? safeAmount(total - entry.amountMinor) : total, 0)]));
  while (next.currentDate < toDate) {
    for (const contract of contracts) {
      if (!active(contract, next.currentDate)) continue;
      const club = next.clubs[contract.clubId]!;
      club.accruedWageNumerator = safeAmount(club.accruedWageNumerator + contract.weeklyWageMinor);
    }
    next.currentDate = addDays(next.currentDate, 1);
    if (next.currentDate === next.nextPayDate) {
      for (const club of Object.values(next.clubs)) {
        const amount = Math.floor(club.accruedWageNumerator / 7);
        if (amount > 0) {
          safeAmount(club.wagesPaidMinor + amount + bonusTotals[club.clubId]!);
          club.balanceMinor = safeAmount(club.balanceMinor - amount);
          club.wagesPaidMinor = safeAmount(club.wagesPaidMinor + amount);
          next.ledger.push({
            id: `wages:${club.clubId}:${next.currentDate}`, date: next.currentDate, clubId: club.clubId,
            kind: 'wages', amountMinor: -amount, balanceAfterMinor: club.balanceMinor, fixtureId: null,
          });
        }
        club.accruedWageNumerator %= 7;
      }
      next.nextPayDate = addDays(next.nextPayDate, 7);
    }
  }
  return next;
}

/** An agreed renewal changes future accrual, never wages already earned. */
export function renewCareerContract(state: CareerFinanceState, input: CareerContractRenewal): CareerFinanceState {
  const renewal = z.object({ clubId: identifier, playerId: identifier, weeklyWageMinor: wage, endDate: date }).strict().parse(input);
  const club = requireClub(state, renewal.clubId);
  const contract = Object.hasOwn(state.contracts, renewal.playerId) ? state.contracts[renewal.playerId] : undefined;
  if (!contract || contract.clubId !== renewal.clubId) throw new Error('Renew only a player contracted to this club.');
  if (state.currentDate < contract.startDate) throw new Error('A contract cannot be renewed before its start date.');
  if (renewal.weeklyWageMinor < contract.weeklyWageMinor) throw new Error('A renewal cannot reduce the player\'s agreed weekly wage.');
  if (renewal.endDate <= contract.endDate || renewal.endDate <= state.currentDate) throw new Error('A renewal must extend the existing contract expiry.');
  if (renewal.endDate > fiveYearsAfter(state.currentDate)) throw new Error('The renewed contract cannot extend beyond five years from today.');
  const previousWage = active(contract, state.currentDate) ? contract.weeklyWageMinor : 0;
  const commitment = safeAmount(weeklyWages(state, renewal.clubId) - previousWage + renewal.weeklyWageMinor);
  if (commitment > club.weeklyWageBudgetMinor) throw new Error('The renewal exceeds the club\'s weekly wage budget.');
  if (club.balanceMinor < commitment) throw new Error('The club cannot fund one full week of the proposed wage commitments.');
  return { ...state, contracts: { ...state.contracts, [renewal.playerId]: {
    ...contract, weeklyWageMinor: renewal.weeklyWageMinor, endDate: renewal.endDate,
    ...(contract.negotiation ? { negotiation: { ...contract.negotiation, referenceWeeklyWageMinor: Math.max(contract.negotiation.referenceWeeklyWageMinor, renewal.weeklyWageMinor) } } : {}),
  } } };
}

const offerSchema = z.object({
  negotiationVersion: z.literal(CAREER_CONTRACT_NEGOTIATION_VERSION), clubId: identifier, playerId: identifier,
  weeklyWageMinor: wage, endDate: date, signingBonusMinor: positiveMoney,
}).strict();
const negotiationContextSchema = z.object({ birthDate: date.nullable() }).strict();

function daysBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}
function ageOn(birthDate: string | null, currentDate: string): number | null {
  if (birthDate === null) return null;
  if (birthDate > currentDate) throw new Error('A player birth date cannot follow the current career date.');
  const years = Number(currentDate.slice(0, 4)) - Number(birthDate.slice(0, 4));
  const age = years - (currentDate.slice(5) < birthDate.slice(5) ? 1 : 0);
  if (age > 120) throw new Error('The player birth date is outside the supported negotiation range.');
  return age;
}

/** Version-1 original negotiation policy; a manager cannot declare a circumstance. */
export function assessCareerContractOffer(state: CareerFinanceState, input: CareerContractOffer, contextInput: CareerNegotiationContext): CareerContractOfferAssessment {
  const offer = offerSchema.parse(input);
  const context = negotiationContextSchema.parse(contextInput);
  const club = requireClub(state, offer.clubId);
  const contract = Object.hasOwn(state.contracts, offer.playerId) ? state.contracts[offer.playerId] : undefined;
  if (!contract || contract.clubId !== offer.clubId) throw new Error('Negotiate only with a player contracted to this club.');
  const ageYears = ageOn(context.birthDate, state.currentDate);
  const currentBill = weeklyWages(state, offer.clubId);
  const financialPressure = currentBill > 0 && BigInt(club.balanceMinor) < BigInt(currentBill) * 13n;
  const extensionDays = daysBetween(contract.endDate, offer.endDate);
  const ageConcession = ageYears !== null && ageYears >= 35 ? 20 : ageYears !== null && ageYears >= 32 ? 10 : 0;
  const concessionPercent = extensionDays >= 365 ? Math.max(ageConcession, financialPressure ? 10 : 0) : 0;
  const reference = Math.max(contract.weeklyWageMinor, contract.negotiation?.referenceWeeklyWageMinor ?? contract.weeklyWageMinor);
  const minimumWeeklyWageMinor = Number((BigInt(reference) * BigInt(100 - concessionPercent) + 99n) / 100n);
  const previousWage = active(contract, state.currentDate) ? contract.weeklyWageMinor : 0;
  const projectedWeeklyWagesMinor = safeAmount(currentBill - previousWage + offer.weeklyWageMinor);
  const shortfall = offer.weeklyWageMinor < contract.weeklyWageMinor ? Math.max(0, minimumWeeklyWageMinor - offer.weeklyWageMinor) : 0;
  const contractDays = Math.max(0, daysBetween(state.currentDate, offer.endDate) + 1);
  const requiredSigningBonusMinor = safeAmount(Number((BigInt(shortfall) * BigInt(contractDays) + 6n) / 7n));
  const result: CareerContractOfferAssessment = {
    accepted: false, explanation: '', ageYears, financialPressure, concessionPercent,
    minimumWeeklyWageMinor, requiredSigningBonusMinor, projectedWeeklyWagesMinor,
  };
  const refuse = (explanation: string): CareerContractOfferAssessment => ({ ...result, explanation });
  if (state.currentDate < contract.startDate) return refuse('A contract cannot be negotiated before its start date.');
  if (offer.endDate <= contract.endDate || offer.endDate <= state.currentDate) return refuse('The offer must extend the existing contract expiry.');
  if (offer.endDate > fiveYearsAfter(state.currentDate)) return refuse('The offered contract cannot extend beyond five years from today.');
  if (projectedWeeklyWagesMinor > club.weeklyWageBudgetMinor) return refuse('The offer exceeds the club\'s weekly wage budget.');
  if (offer.signingBonusMinor < requiredSigningBonusMinor) {
    const circumstances = concessionPercent > 0 ? `The available ${concessionPercent}% concession does not cover this wage reduction.` : 'No supported age or financial circumstance permits an uncompensated wage reduction.';
    return refuse(`Player declined. ${circumstances} Increase the weekly wage or fund the guaranteed signing bonus shown for the full offered term.`);
  }
  safeAmount(getClubFinancialSummary(state, offer.clubId).totalSpendingMinor + offer.signingBonusMinor);
  if (BigInt(club.balanceMinor) - BigInt(offer.signingBonusMinor) < BigInt(projectedWeeklyWagesMinor)) return refuse('The club cannot fund the signing bonus and one full week of the proposed wage commitments.');
  const reason = offer.weeklyWageMinor < contract.weeklyWageMinor
    ? requiredSigningBonusMinor > 0 ? 'the guaranteed signing bonus compensates the remaining wage reduction over the full offered term'
      : ageConcession >= concessionPercent && ageConcession > 0 ? `the known player age supports up to a ${concessionPercent}% concession in exchange for at least one extra contract year`
        : 'the club has less than thirteen weeks of payroll in cash and the extra contract year supports a limited concession'
    : 'the proposed guaranteed terms meet the player and club requirements';
  return { ...result, accepted: true, explanation: `Player accepts: ${reason}.` };
}

/** Apply an accepted offer and its real upfront cost atomically as one transition. */
export function negotiateCareerContract(state: CareerFinanceState, input: CareerContractOffer, context: CareerNegotiationContext): CareerFinanceState {
  const offer = offerSchema.parse(input);
  const assessment = assessCareerContractOffer(state, offer, context);
  if (!assessment.accepted) throw new Error(assessment.explanation);
  const club = requireClub(state, offer.clubId);
  const contract = state.contracts[offer.playerId]!;
  const sequence = (contract.negotiation?.sequence ?? 0) + 1;
  if (!Number.isSafeInteger(sequence)) throw new Error('The contract negotiation sequence exceeds the supported range.');
  const referenceWeeklyWageMinor = Math.max(contract.weeklyWageMinor, contract.negotiation?.referenceWeeklyWageMinor ?? 0, offer.weeklyWageMinor);
  const balanceMinor = safeAmount(club.balanceMinor - offer.signingBonusMinor);
  const id = `signing-bonus:${offer.clubId}:${offer.playerId}:${sequence}`;
  if (offer.signingBonusMinor > 0 && state.ledger.some(entry => entry.id === id)) throw new Error('This contract negotiation already has a signing-bonus receipt.');
  return {
    ...state,
    contracts: { ...state.contracts, [offer.playerId]: { ...contract, weeklyWageMinor: offer.weeklyWageMinor, endDate: offer.endDate, negotiation: { referenceWeeklyWageMinor, sequence } } },
    clubs: offer.signingBonusMinor > 0 ? { ...state.clubs, [offer.clubId]: { ...club, balanceMinor } } : state.clubs,
    ledger: offer.signingBonusMinor > 0 ? [...state.ledger, { id, date: state.currentDate, clubId: offer.clubId, kind: 'signing-bonus', amountMinor: -offer.signingBonusMinor, balanceAfterMinor: balanceMinor, fixtureId: null, playerId: offer.playerId }] : state.ledger,
  };
}

/** Credit one configured home-fixture receipt, after that fixture is committed. */
export function recordCareerMatchdayIncome(state: CareerFinanceState, input: CareerMatchdayIncome): CareerFinanceState {
  const receipt = z.object({ clubId: identifier, fixtureId: identifier, date }).strict().parse(input);
  const club = requireClub(state, receipt.clubId);
  if (receipt.date !== state.currentDate) throw new Error('Matchday income must be recorded on the current career date.');
  const previous = Object.hasOwn(state.processedFixtures, receipt.fixtureId) ? state.processedFixtures[receipt.fixtureId] : undefined;
  if (previous) {
    if (previous.clubId !== receipt.clubId || previous.date !== receipt.date || previous.amountMinor !== club.matchdayIncomeMinor) throw new Error('This fixture already has a different matchday receipt.');
    return structuredClone(state);
  }
  const amount = club.matchdayIncomeMinor;
  const balance = safeAmount(club.balanceMinor + amount);
  const income = safeAmount(club.incomeReceivedMinor + amount);
  return {
    ...state,
    clubs: { ...state.clubs, [club.clubId]: { ...club, balanceMinor: balance, incomeReceivedMinor: income } },
    ledger: [...state.ledger, { id: `matchday:${receipt.fixtureId}`, date: receipt.date, clubId: club.clubId, kind: 'matchday-income', amountMinor: amount, balanceAfterMinor: balance, fixtureId: receipt.fixtureId }],
    processedFixtures: { ...state.processedFixtures, [receipt.fixtureId]: { clubId: club.clubId, date: receipt.date, amountMinor: amount } },
  };
}

export function getClubFinancialSummary(state: CareerFinanceState, clubId: string): ClubFinancialSummary {
  const club = requireClub(state, clubId);
  const wages = weeklyWages(state, clubId);
  const totalBonusesMinor = state.ledger.reduce((total, entry) => entry.clubId === clubId && entry.kind === 'signing-bonus' ? safeAmount(total - entry.amountMinor) : total, 0);
  return {
    clubId, currency: state.currency, balanceMinor: club.balanceMinor, transferBudgetMinor: club.transferBudgetMinor,
    weeklyWageBudgetMinor: club.weeklyWageBudgetMinor, weeklyWagesMinor: wages,
    remainingWageBudgetMinor: safeAmount(club.weeklyWageBudgetMinor - wages),
    totalIncomeMinor: club.incomeReceivedMinor, totalSpendingMinor: safeAmount(club.wagesPaidMinor + totalBonusesMinor), totalBonusesMinor,
    accruedWagesMinor: Math.floor(club.accruedWageNumerator / 7), nextPayDate: state.nextPayDate,
  };
}
