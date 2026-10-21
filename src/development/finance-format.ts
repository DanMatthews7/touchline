export interface DemoContractRenewalInput {
  playerId: string;
  weeklyWageMinor: number;
  endDate: string;
  signingBonusMinor: number;
}

const poundsFormatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Formatting only: accounting always retains the original integer pennies. */
export function formatDemoMoney(amountMinor: number): string {
  const absolute = BigInt(Math.abs(amountMinor));
  return `${amountMinor < 0 ? '-' : ''}${poundsFormatter.format(absolute / 100n)}.${String(absolute % 100n).padStart(2, '0')}`;
}

/** Parse typed pounds without floating-point multiplication or permissive exponents. */
export function parseDemoMoneyInput(input: string, field: 'weekly wage' | 'signing bonus' = 'weekly wage'): number {
  const value = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(`Enter a ${field} in pounds, with at most two decimal places.`);
  const [pounds, pennies = ''] = value.split('.');
  const amount = BigInt(pounds!) * 100n + BigInt(pennies.padEnd(2, '0'));
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`This ${field} is too large.`);
  return Number(amount);
}

export function demoMoneyInputValue(amountMinor: number): string {
  return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, '0')}`;
}

export function addContractYears(date: string, years: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const targetYear = year! + years;
  const lastDay = new Date(Date.UTC(targetYear, month!, 0)).getUTCDate();
  return `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(day!, lastDay)).padStart(2, '0')}`;
}

export function dayAfter(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
