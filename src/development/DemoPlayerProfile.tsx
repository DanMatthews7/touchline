import { useEffect, useState } from 'react';
import type { PlayerRole } from '../domain/models';
import { calculateRoleRating, ROLE_DEFINITIONS, rolesForPlayer } from '../domain/ratings';
import type { SeasonState } from '../simulation/season';
import { AttributePanels } from '../ui/AttributePanel';
import { getDemoClubView } from './club-view';
import styles from './DemoPlayers.module.css';

export function DemoPlayerProfile({ season, playerId, onBack }: { season: SeasonState; playerId: string; onBack: () => void }) {
  const club = getDemoClubView(season);
  const row = club.players.find(candidate => candidate.player.id === playerId);
  const [selectedRole, setSelectedRole] = useState<PlayerRole | null>(null);
  useEffect(() => { setSelectedRole(null); }, [playerId]);
  if (!row) return <section className={styles.view}><header className={styles.viewHeading}><h2 tabIndex={-1}>Player unavailable</h2><button className={styles.button} onClick={onBack}>Back to squad</button></header><p className={styles.note}>This player is not in your managed demo squad. Open a player from the current squad.</p></section>;
  const role = selectedRole ?? rolesForPlayer(row.player)[0] ?? 'centralMidfielder';
  const rating = calculateRoleRating(row.player, role);
  return <section className={styles.view} aria-label="Demo player profile">
    <header className={styles.viewHeading}><div><span className={styles.eyebrow}>Demo player profile · {club.team.name}</span><h2 tabIndex={-1}>{row.player.name}</h2><p>Preferred positions: {row.player.positions.join(', ')} · {row.status}</p></div><button className={styles.button} onClick={onBack}>Back to squad</button></header>
    <section className={styles.panel} aria-labelledby="demo-player-status-title"><header className={styles.panelHead}><h3 id="demo-player-status-title">Player status</h3><span>{club.basis}{club.matchMinute !== null ? ` · ${club.matchMinute}′` : ''}</span></header><dl className={`${styles.facts} ${styles.playerFacts}`}>
      <div><dt>Club</dt><dd>{club.team.name}</dd></div><div><dt>Current match slot</dt><dd>{row.assignment?.position ?? '—'}</dd></div><div><dt>Condition</dt><dd aria-label="Player condition">{row.condition.toFixed(1)} / 100</dd></div><div><dt>Morale</dt><dd aria-label="Player morale">{row.morale.toFixed(1)} / 100</dd></div><div><dt>Selection</dt><dd>{row.status}{row.yellowCards ? ` · YC ${row.yellowCards}` : ''}</dd></div>
    </dl></section>
    <div className={styles.roleStrip}><label className={styles.searchLabel}>Role suitability<select aria-label="Demo player role" value={role} onChange={event => setSelectedRole(event.target.value as PlayerRole)}>{(Object.keys(ROLE_DEFINITIONS) as PlayerRole[]).map(key => <option key={key} value={key}>{ROLE_DEFINITIONS[key].label}</option>)}</select></label><strong className={styles.rating} aria-label={rating.rating === null ? 'Demo role rating unassessed' : `Demo role rating ${rating.rating} out of 100`}>{rating.rating ?? '—'}{rating.rating !== null && <small>/100</small>}</strong><p>{rating.status === 'assessed' ? 'Role summary from the same original attribute weights used by the game.' : 'This role does not match the demo player’s preferred positions.'}<br /><strong>Demo ability: uniform 10/20</strong></p></div>
    <AttributePanels attributes={row.player.attributes} />
    <p className={styles.note}>All 45 values are fixed demo model inputs on a 1–20 scale. Positions and roles describe this generic scenario; no real biography or football ability is asserted. Condition and morale describe {club.matchMinute === null ? 'the configured next-match starting values' : 'your managed match report'}.</p>
  </section>;
}
