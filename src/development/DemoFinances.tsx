import type { CareerFinanceState } from '../simulation/career';
import { getClubFinancialSummary } from '../simulation/career';
import type { SeasonState } from '../simulation/season';
import { readableDate } from '../ui/formatters';
import { formatDemoMoney } from './finance-format';
import styles from './DemoFinances.module.css';

export function EnableCareerManagement({ busy, onEnableCareer, currentDate }: {
  busy: boolean;
  onEnableCareer: () => void | Promise<void>;
  currentDate: string;
}) {
  return <section className={styles.panel} aria-labelledby="enable-career-title">
    <header className={styles.panelHead}><h3 id="enable-career-title">Career management is not enabled</h3><span>Existing demo season</span></header>
    <div className={styles.body}><p className={styles.intro}>Add demo contracts and club finances from {readableDate(currentDate)}. Your match progress stays as it is, and earlier wages or match income are not charged or credited.</p><button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => void onEnableCareer()}>Enable career management</button><p className={styles.note}>This adds original financial model inputs for the generic demo clubs and players. Keep a demo backup before updating your season.</p></div>
  </section>;
}

export function DemoFinances({ season, finances, busy, onEnableCareer }: {
  season: SeasonState;
  finances: CareerFinanceState | null;
  busy: boolean;
  onEnableCareer: () => void | Promise<void>;
}) {
  const clubId = season.config.managedClubId;
  const club = season.config.teams.find(team => team.id === clubId)!;
  if (!finances) return <section className={styles.view} aria-label="Demo club finances"><header className={styles.heading}><div><span className={styles.eyebrow}>{club.name}</span><h2>Club finances</h2><p>Contracts, wages and budgets for your demo club.</p></div></header><EnableCareerManagement busy={busy} onEnableCareer={onEnableCareer} currentDate={season.currentDate} /></section>;
  const summary = getClubFinancialSummary(finances, clubId);
  const ledger = finances.ledger.filter(entry => entry.clubId === clubId).slice().reverse();
  return <section className={styles.view} aria-label="Demo club finances">
    <header className={styles.heading}><div><span className={styles.eyebrow}>{club.name} · Career management</span><h2>Club finances</h2><p>Cash movements and player commitments as of {readableDate(finances.currentDate)}.</p></div></header>
    <div className={styles.notice}><strong>Demo finances · GBP.</strong> Balances, wages, budgets and home-match income are original inputs for this practice league. The same financial rules apply to every demo club.</div>
    <dl className={styles.metrics} aria-label="Club finance summary">
      <div><dt>Club balance</dt><dd aria-label="Club balance" className={summary.balanceMinor < 0 ? styles.negative : ''}>{formatDemoMoney(summary.balanceMinor)}</dd></div>
      <div><dt>Transfer budget</dt><dd aria-label="Transfer budget">{formatDemoMoney(summary.transferBudgetMinor)}</dd></div>
      <div><dt>Weekly wage commitments</dt><dd aria-label="Weekly wage commitments">{formatDemoMoney(summary.weeklyWagesMinor)}</dd></div>
      <div><dt>Wage budget remaining</dt><dd aria-label="Wage budget remaining" className={summary.remainingWageBudgetMinor < 0 ? styles.negative : ''}>{formatDemoMoney(summary.remainingWageBudgetMinor)}</dd></div>
    </dl>
    {summary.balanceMinor < 0 && <p className={`${styles.notice} ${styles.warning}`} role="status">The club is overdrawn. Wage payments remain recorded; a contract renewal must be affordable before it can be agreed.</p>}
    <div className={styles.grid}>
      <section className={styles.panel} aria-labelledby="wage-commitments-title"><header className={styles.panelHead}><h3 id="wage-commitments-title">Wage commitments</h3><span>Weekly payments</span></header><div className={styles.body}><dl className={styles.facts}>
        <div><dt>Weekly wage budget</dt><dd aria-label="Weekly wage budget">{formatDemoMoney(summary.weeklyWageBudgetMinor)}</dd></div>
        <div><dt>Accrued wages</dt><dd aria-label="Accrued wages">{formatDemoMoney(summary.accruedWagesMinor)}</dd></div>
        <div><dt>Next wage payment</dt><dd aria-label="Next wage payment">{readableDate(summary.nextPayDate)}</dd></div>
      </dl><p className={styles.note}>Wages accrue as the calendar advances and are paid every seven days. A renewal changes future commitments from the current date. Open a player profile to review or renew their contract.</p></div></section>
      <section className={styles.panel} aria-labelledby="finance-movements-title"><header className={styles.panelHead}><h3 id="finance-movements-title">Income and spending</h3><span>Since {readableDate(finances.startDate)}</span></header><div className={styles.body}><dl className={styles.facts}>
        <div><dt>Income received</dt><dd aria-label="Income received">{formatDemoMoney(summary.totalIncomeMinor)}</dd></div>
        <div><dt>Spending paid</dt><dd aria-label="Spending paid">{formatDemoMoney(summary.totalSpendingMinor)}</dd></div>
        <div><dt>Home match income</dt><dd>{formatDemoMoney(finances.clubs[clubId]!.matchdayIncomeMinor)} per fixture</dd></div>
      </dl><p className={styles.note}>Home-match income is credited once a completed round is recorded. The transfer budget is a spending limit within club cash, not a separate cash account. Transfers are planned for a later slice.</p></div></section>
    </div>
    <section className={styles.panel} aria-labelledby="finance-ledger-title"><header className={styles.panelHead}><h3 id="finance-ledger-title">Transaction history</h3><span>{ledger.length} recorded movements</span></header>
      {ledger.length ? <div className={styles.tableWrap} role="region" aria-label="Financial transaction table" tabIndex={0}><table className={styles.table}><caption className={styles.hidden}>Managed club transaction history</caption><thead><tr><th scope="col">Date</th><th scope="col">Transaction</th><th scope="col" className={styles.numeric}>Amount</th><th scope="col" className={styles.numeric}>Balance</th></tr></thead><tbody>{ledger.map(entry => <tr key={entry.id}><td>{readableDate(entry.date)}</td><td>{entry.kind === 'wages' ? 'Wage payment' : 'Home match income'}</td><td className={styles.numeric}>{entry.amountMinor > 0 ? '+' : ''}{formatDemoMoney(entry.amountMinor)}</td><td className={styles.numeric}>{formatDemoMoney(entry.balanceAfterMinor)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>No cash movements yet. Wage payments and completed home fixtures will appear here as the season progresses.</p>}
      <footer className={styles.footer}>Balances and history are saved with your demo decisions. Export a demo backup to keep the contracts, finances and season together.</footer>
    </section>
  </section>;
}
