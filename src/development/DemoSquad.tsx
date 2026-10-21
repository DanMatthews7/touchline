import { useState } from 'react';
import { POSITIONS } from '../domain/models';
import type { SeasonState } from '../simulation/season';
import type { CareerFinanceState } from '../simulation/career';
import { readableDate } from '../ui/formatters';
import { formatDemoMoney } from './finance-format';
import { getDemoClubView } from './club-view';
import styles from './DemoPlayers.module.css';

export function DemoSquad({ season, onOpenPlayer, finances = null }: { season: SeasonState; onOpenPlayer: (playerId: string) => void; finances?: CareerFinanceState | null }) {
  const { team, players, basis, matchMinute } = getDemoClubView(season);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('all');
  const visible = players.filter(row => row.player.name.toLowerCase().includes(query.trim().toLowerCase()) && (position === 'all' || row.player.positions.some(item => item === position)));
  return <section className={styles.view} aria-label="Managed demo squad">
    <header className={styles.viewHeading}><div><span className={styles.eyebrow}>{team.name}</span><h2>My squad</h2><p>Select a player to open their profile and attributes.</p></div><span className={styles.chip}>{basis}{matchMinute !== null ? ` · ${matchMinute}′` : ''}</span></header>
    <section className={styles.panel} aria-labelledby="demo-squad-title"><header className={styles.panelHead}><h3 id="demo-squad-title">Managed squad</h3><span>Demo ability: uniform 10/20</span></header>
      <div className={styles.toolbar}><label className={styles.searchLabel}>Find a player<input type="search" aria-label="Filter demo players" placeholder="Player name…" value={query} onChange={event => setQuery(event.target.value)} /></label><label className={styles.searchLabel}>Position<select aria-label="Demo squad position" value={position} onChange={event => setPosition(event.target.value)}><option value="all">All positions</option>{POSITIONS.map(item => <option key={item} value={item}>{item}</option>)}</select></label><span className={styles.results} aria-live="polite">{visible.length} of {players.length} players</span></div>
      <div className={styles.tableWrap} role="region" aria-label="Demo squad player table" tabIndex={0}><table className={styles.table}><caption className={styles.hidden}>Managed demo club squad</caption><thead><tr><th scope="col">Player</th><th scope="col">Preferred positions</th><th scope="col">Match slot</th><th scope="col">Selection</th><th scope="col" className={styles.numeric}>Condition</th><th scope="col" className={styles.numeric}>Morale</th>{finances && <><th scope="col" className={styles.numeric}>Weekly wage</th><th scope="col">Contract expiry</th></>}</tr></thead><tbody>{visible.map(row => <tr key={row.player.id}>
        <td><button className={styles.playerName} onClick={() => onOpenPlayer(row.player.id)}>{row.player.name}</button></td><td>{row.player.positions.join(', ')}</td><td>{row.assignment?.position ?? '—'}</td><td>{row.status}{row.yellowCards ? ` · YC ${row.yellowCards}` : ''}</td><td className={styles.numeric}>{row.condition.toFixed(1)}</td><td className={styles.numeric}>{row.morale.toFixed(1)}</td>
        {finances && <><td className={styles.numeric}>{finances.contracts[row.player.id] ? formatDemoMoney(finances.contracts[row.player.id]!.weeklyWageMinor) : '—'}</td><td>{finances.contracts[row.player.id] ? readableDate(finances.contracts[row.player.id]!.endDate) : '—'}</td></>}
      </tr>)}</tbody></table></div>
      {visible.length === 0 && <p className={styles.empty}>No demo players match these filters.</p>}
      <footer className={styles.tableFooter}>Condition and morale are scenario values out of 100. {matchMinute === null ? 'They reset to configured starting inputs for the next fixture; coaching selections carry forward.' : 'They match your managed fixture report, including fatigue, substitutions and cards.'}</footer>
    </section>
  </section>;
}
