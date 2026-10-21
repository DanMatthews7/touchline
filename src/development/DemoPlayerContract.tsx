import { useEffect, useState, type FormEvent } from 'react';
import { getClubFinancialSummary, type CareerFinanceState } from '../simulation/career';
import { readableDate } from '../ui/formatters';
import { addContractYears, dayAfter, demoMoneyInputValue, formatDemoMoney, parseDemoMoneyInput, type DemoContractRenewalInput } from './finance-format';
import styles from './DemoFinances.module.css';

export function DemoPlayerContract({ finances, playerId, busy, onRenewContract }: {
  finances: CareerFinanceState;
  playerId: string;
  busy: boolean;
  onRenewContract?: (input: DemoContractRenewalInput) => void | Promise<void>;
}) {
  const contract = finances.contracts[playerId];
  const maximumExpiry = addContractYears(finances.currentDate, 5);
  const [wage, setWage] = useState(contract ? demoMoneyInputValue(contract.weeklyWageMinor) : '');
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setWage(contract ? demoMoneyInputValue(contract.weeklyWageMinor) : '');
    const proposed = contract ? addContractYears(contract.endDate, 1) : '';
    setExpiry(proposed > maximumExpiry ? maximumExpiry : proposed);
    setError(null);
  }, [playerId, contract?.weeklyWageMinor, contract?.endDate, maximumExpiry]);
  if (!contract) return <section className={styles.panel}><header className={styles.panelHead}><h3>Contract</h3><span>Demo terms</span></header><p className={styles.empty}>No contract is recorded for this demo player.</p></section>;
  const summary = getClubFinancialSummary(finances, contract.clubId);
  const status = contract.startDate > finances.currentDate ? 'Not started' : contract.endDate < finances.currentDate ? 'Expired' : 'Active';
  const canExtend = contract.endDate < maximumExpiry && status === 'Active';
  let projectedWages: number | null = null;
  let wageChange: number | null = null;
  try {
    const offeredWage = parseDemoMoneyInput(wage);
    const amount = summary.weeklyWagesMinor - contract.weeklyWageMinor + offeredWage;
    if (Number.isSafeInteger(amount)) {
      projectedWages = amount;
      wageChange = offeredWage - contract.weeklyWageMinor;
    }
  } catch { /* A partially typed amount has no valid preview yet. */ }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || !onRenewContract || !contract) return;
    setError(null);
    try {
      const weeklyWageMinor = parseDemoMoneyInput(wage);
      await onRenewContract({ playerId, weeklyWageMinor, endDate: expiry });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The contract could not be renewed.'); }
  }
  return <section className={styles.panel} aria-labelledby="demo-player-contract-title">
    <header className={styles.panelHead}><h3 id="demo-player-contract-title">Contract</h3><span>Original demo terms · GBP</span></header>
    <div className={`${styles.body} ${styles.contractGrid}`}>
      <div><dl className={styles.facts}>
        <div><dt>Weekly wage</dt><dd aria-label="Weekly wage">{formatDemoMoney(contract.weeklyWageMinor)} / week</dd></div>
        <div><dt>Contract start</dt><dd aria-label="Contract start">{readableDate(contract.startDate)}</dd></div>
        <div><dt>Contract expiry</dt><dd aria-label="Contract expiry">{readableDate(contract.endDate)}</dd></div>
        <div><dt>Contract status</dt><dd aria-label="Contract status">{status}</dd></div>
      </dl><p className={styles.note}>These wages and dates are model inputs for this generic demo player. There are no appearance fees, bonuses or agent fees in this slice.</p></div>
      {onRenewContract && canExtend ? <form className={styles.form} aria-label="Renew player contract" onSubmit={event => { void submit(event); }}>
        <h4>Renew this contract</h4><div className={styles.formFields}>
          <label className={styles.field}>New weekly wage (£)<input type="text" inputMode="decimal" maxLength={18} required value={wage} disabled={busy} onChange={event => setWage(event.target.value)} /></label>
          <label className={styles.field}>New contract expiry<input type="date" min={dayAfter(contract.endDate)} max={maximumExpiry} required value={expiry} disabled={busy} onChange={event => setExpiry(event.target.value)} /></label>
        </div>
        <p className={styles.preview}>Club weekly wage budget: <strong>{formatDemoMoney(summary.weeklyWageBudgetMinor)}</strong><br />{projectedWages !== null && wageChange !== null ? <>Weekly wage change: <strong className={wageChange < 0 ? styles.negative : ''}>{wageChange > 0 ? '+' : ''}{formatDemoMoney(wageChange)}</strong><br />Weekly commitments after renewal: <strong className={projectedWages > summary.weeklyWageBudgetMinor ? styles.negative : ''}>{formatDemoMoney(projectedWages)}</strong></> : 'Enter a weekly wage in pounds, with at most two decimal places.'}</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={`${styles.button} ${styles.primary}`} type="submit" disabled={busy}>Renew contract</button>
        <p className={styles.note}>Extend the expiry without reducing the wage, up to five years from the current date. The new weekly total must fit the club’s wage budget and available cash. Agreed terms apply from the current date; no signing payment is charged.</p>
      </form> : <p className={styles.note}>{status === 'Expired' ? 'This contract has expired. Expiry and transfer lifecycle handling will be expanded in a later slice.' : !canExtend ? 'This contract already reaches the maximum renewal period.' : 'Contract renewal is unavailable in this view.'}</p>}
    </div>
  </section>;
}
