import { useMemo, useState } from 'react';
import type { DatabaseSnapshot, PlayerRole, VisiblePlayer } from '../domain/models';
import { POSITIONS, visiblePlayer } from '../domain/models';
import { calculateRoleRating, rolesForPlayer } from '../domain/ratings';
import { assessedCount, ageOnDate, compareValues } from './formatters';
import { Icon } from './Icon';
import styles from './GameShell.module.css';

type SortKey = 'name' | 'position' | 'age' | 'nationality' | 'foot' | 'rating' | 'attributes';
const columns: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Player' }, { key: 'position', label: 'Position' }, { key: 'age', label: 'Age' },
  { key: 'nationality', label: 'Nationality' }, { key: 'foot', label: 'Foot' }, { key: 'rating', label: 'Role /100' }, { key: 'attributes', label: 'Assessed' },
];
function primaryRole(player: VisiblePlayer): PlayerRole | null { return rolesForPlayer(player)[0] ?? null; }
function playerRating(player: VisiblePlayer): number | null {
  const role = primaryRole(player);
  return role ? calculateRoleRating(player, role).rating : null;
}
function fieldValue(player: VisiblePlayer, key: SortKey, date: string): string | number | null {
  switch (key) {
    case 'name': return player.name;
    case 'position': return player.positions.join(', ') || null;
    case 'age': return ageOnDate(player.dateOfBirth, date);
    case 'nationality': return player.nationality.join(', ') || null;
    case 'foot': return player.preferredFoot === 'unknown' ? null : player.preferredFoot;
    case 'rating': return playerRating(player);
    case 'attributes': return assessedCount(player);
  }
}
interface Props {
  snapshot: DatabaseSnapshot;
  clubId: string | null;
  currentDate: string;
  onSelectPlayer: (id: string) => void;
}

export function SquadTable({ snapshot, clubId, currentDate, onSelectPlayer }: Props) {
  const clubPlayers = snapshot.players.filter(player => player.clubId === clubId && clubId !== null);
  const [scope, setScope] = useState<'reference' | 'club'>(clubPlayers.length > 0 ? 'club' : 'reference');
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const allInScope = scope === 'reference' ? snapshot.players : clubPlayers;
  const players = useMemo(() => allInScope
    .map(visiblePlayer)
    .filter(player => `${player.name} ${player.nationality.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()) && (position === 'all' || player.positions.some(item => item === position)))
    .map((player, index) => ({ player, index }))
    .sort((a, b) => compareValues(fieldValue(a.player, sort.key, currentDate), fieldValue(b.player, sort.key, currentDate), sort.direction) || a.index - b.index)
    .map(item => item.player), [allInScope, query, position, sort, currentDate]);
  function changeSort(key: SortKey) {
    setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }));
  }
  return <section className={styles.panel} aria-label="Sortable player directory">
    <header className={styles.panelHead}><h2 className={styles.panelTitle}>{scope === 'reference' ? 'Reference player directory' : 'Managed club squad'}</h2><span className={`${styles.chip} ${styles.mutedChip}`}>{scope === 'reference' ? 'No current squad claims' : 'Imported assignments'}</span></header>
    <div className={styles.toolbar}>
      <div className={styles.filterGroup}>
        <div className={styles.searchWrap}><Icon name="search" className={styles.searchIcon} /><input className={styles.searchInput} type="search" aria-label="Filter players by name or nationality" placeholder="Find a player…" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <select className={styles.select} aria-label="Filter by position" value={position} onChange={event => setPosition(event.target.value)}><option value="all">All positions</option>{POSITIONS.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <select className={styles.select} aria-label="Player directory scope" value={scope} onChange={event => setScope(event.target.value as 'reference' | 'club')}><option value="reference">All reference players</option><option value="club">Managed club squad ({clubPlayers.length})</option></select>
      </div>
      <span className={styles.results} aria-live="polite">{players.length} of {allInScope.length} players</span>
    </div>
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.fileInput}>Player directory. Select a player name to open their profile. Sort any column; unknown values remain last.</caption>
        <thead><tr>{columns.map(column => <th key={column.key} scope="col" aria-sort={sort.key === column.key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button className={`${styles.sortButton} ${sort.key === column.key ? styles.sortActive : ''}`} onClick={() => changeSort(column.key)}>{column.label}<span className={styles.sortArrow} aria-hidden="true">{sort.key === column.key ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button></th>)}</tr></thead>
        <tbody>{players.map(player => {
          const rating = playerRating(player);
          const age = ageOnDate(player.dateOfBirth, currentDate);
          return <tr key={player.id}>
            <td><button className={styles.playerName} onClick={() => onSelectPlayer(player.id)}>{player.name}</button><span className={styles.nameSub}>{snapshot.clubs.find(club => club.id === player.clubId)?.shortName ?? 'Current club unverified'}</span></td>
            <td>{player.positions.length ? <span className={styles.chip}>{player.positions.join(', ')}</span> : <span className={styles.unknown} aria-label="Position unknown">—</span>}</td>
            <td className={styles.numberCell}>{age ?? <span className={styles.unknown}>—</span>}</td>
            <td>{player.nationality.join(', ') || <span className={styles.unknown}>—</span>}</td>
            <td>{player.preferredFoot === 'unknown' ? <span className={styles.unknown}>—</span> : player.preferredFoot}</td>
            <td className={styles.numberCell}>{rating === null ? <span className={styles.unknown} aria-label="Role unassessed">—</span> : <span className={styles.rating}>{rating}</span>}</td>
            <td className={styles.numberCell}>{assessedCount(player)}<span className={styles.unknown}> / 45</span></td>
          </tr>;
        })}</tbody>
      </table>
      {players.length === 0 && <div className={styles.empty}><h3>{scope === 'club' ? 'No verified squad assignments.' : 'No matching players.'}</h3><p>{scope === 'club' ? 'The reference database makes no claims about current squads. Switch to All reference players to inspect the real-player records, or import a licensed database with verified assignments.' : 'Try another name or position filter.'}</p>{scope === 'club' && <button className={styles.button} onClick={() => setScope('reference')}>View reference players</button>}</div>}
    </div>
    <footer className={styles.tableFooter}><span>{players.length} player{players.length === 1 ? '' : 's'} shown · Age as of {currentDate}</span><span>— Unassessed / unknown · Ratings are original game estimates</span></footer>
  </section>;
}
