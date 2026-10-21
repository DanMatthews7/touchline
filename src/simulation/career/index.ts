import { z } from 'zod';
import { isDateOnly } from '../commands';

export const CAREER_FINANCE_ENGINE_VERSION = 1 as const;
export const MAX_CAREER_MONEY_MINOR = 1_000_000_000_000_000;
export const MAX_WEEKLY_WAGE_MINOR = 1_000_000_000;
export const MAX_FINANCE_ADVANCE_DAYS = 3_653;

export interface CareerContract {
  playerId: string;
  clubId: string;
  startDate: string;
  endDate: string;
  weeklyWageMinor: number;
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
  kind: 'wages' | 'matchday-income';
  amountMinor: number;
  balanceAfterMinor: number;
  fixtureId: string | null;
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
  return { ...state, contracts: { ...state.contracts, [renewal.playerId]: { ...contract, weeklyWageMinor: renewal.weeklyWageMinor, endDate: renewal.endDate } } };
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
  return {
    clubId, currency: state.currency, balanceMinor: club.balanceMinor, transferBudgetMinor: club.transferBudgetMinor,
    weeklyWageBudgetMinor: club.weeklyWageBudgetMinor, weeklyWagesMinor: wages,
    remainingWageBudgetMinor: safeAmount(club.weeklyWageBudgetMinor - wages),
    totalIncomeMinor: club.incomeReceivedMinor, totalSpendingMinor: club.wagesPaidMinor,
    accruedWagesMinor: Math.floor(club.accruedWageNumerator / 7), nextPayDate: state.nextPayDate,
  };
}
