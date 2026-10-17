import type { MatchSummary } from '../../simulation/match';
import styles from './SeasonWorkspace.module.css';

export function SeasonStats({ summary }: { summary: MatchSummary }) {
  const rows = [
    ['Possession', `${summary.stats.home.possession.toFixed(1)}%`, `${summary.stats.away.possession.toFixed(1)}%`],
    ['Shots / on target', `${summary.stats.home.shots} / ${summary.stats.home.shotsOnTarget}`, `${summary.stats.away.shots} / ${summary.stats.away.shotsOnTarget}`],
    ['Expected goals', summary.stats.home.expectedGoals.toFixed(2), summary.stats.away.expectedGoals.toFixed(2)],
    ['Chances', summary.stats.home.chances, summary.stats.away.chances],
    ['Passes completed / attempted', `${summary.stats.home.passesCompleted} / ${summary.stats.home.passesAttempted}`, `${summary.stats.away.passesCompleted} / ${summary.stats.away.passesAttempted}`],
    ['Tackles won / attempted', `${summary.stats.home.tacklesWon} / ${summary.stats.home.tacklesAttempted}`, `${summary.stats.away.tacklesWon} / ${summary.stats.away.tacklesAttempted}`],
    ['Saves', summary.stats.home.saves, summary.stats.away.saves],
    ['Fouls', summary.stats.home.fouls, summary.stats.away.fouls],
    ['Yellow / red cards', `${summary.stats.home.yellowCards} / ${summary.stats.home.redCards}`, `${summary.stats.away.yellowCards} / ${summary.stats.away.redCards}`],
  ];
  return <table className={styles.stats}><caption className={styles.hidden}>Home and away statistics from the match event summary</caption><tbody>{rows.map(([label, home, away]) => <tr key={label}><td>{home}</td><td>{label}</td><td>{away}</td></tr>)}</tbody></table>;
}
