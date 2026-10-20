import type { SeasonState } from '../simulation/season';
import { readableDate } from '../ui/formatters';
import { getDemoClubView } from './club-view';
import styles from './DemoPlayers.module.css';

export function DemoClub({ season, onOpenSquad, onOpenMatchday }: {
  season: SeasonState;
  onOpenSquad: () => void;
  onOpenMatchday: () => void;
}) {
  const { team, players, selection, standing, nextFixture, basis } = getDemoClubView(season);
  const opponentId = nextFixture?.homeClubId === team.id ? nextFixture.awayClubId : nextFixture?.homeClubId;
  const opponent = season.config.teams.find(club => club.id === opponentId);
  return <section aria-label="Demo club overview" className={styles.view}>
    <header className={styles.viewHeading}><div><span className={styles.eyebrow}>Managed demo club</span><h2>My club</h2><p>{team.name} · Development Demo League</p></div><button className={styles.button} onClick={onOpenSquad}>Open squad</button></header>
    <div className={styles.metrics} aria-label="Managed demo club statistics">
      <div><span>League position</span><strong>{standing.position} / 20</strong></div>
      <div><span>Matches played</span><strong>{standing.played}</strong></div>
      <div><span>Points</span><strong>{standing.points}</strong></div>
      <div><span>Demo players</span><strong>{players.length}</strong></div>
    </div>
    <div className={styles.clubGrid}>
      <section className={styles.panel} aria-labelledby="demo-club-selection-title"><header className={styles.panelHead}><h3 id="demo-club-selection-title">Your squad</h3><span>{basis}</span></header><div className={styles.panelBody}>
        <dl className={styles.facts}><div><dt>Formation</dt><dd>{selection.formation}</dd></div><div><dt>Mentality</dt><dd className={styles.capitalize}>{selection.instructions.mentality}</dd></div><div><dt>Starting XI</dt><dd>{selection.lineup.length} players</dd></div><div><dt>Unused substitutes</dt><dd>{selection.benchIds.length} players</dd></div><div><dt>Goalkeepers in squad</dt><dd>{players.filter(row => row.player.positions.includes('GK')).length}</dd></div></dl>
        <p className={styles.note}>Open a player from Squad to inspect positions, match status and all 45 attributes. Every ability starts at the same 10/20 demo input.</p>
      </div></section>
      <section className={styles.panel} aria-labelledby="demo-club-fixture-title"><header className={styles.panelHead}><h3 id="demo-club-fixture-title">{season.status === 'finished' ? 'Season complete' : 'Current fixture'}</h3><span>{season.roundIndex} / 38 rounds committed</span></header><div className={styles.panelBody}>
        {nextFixture && opponent ? <><strong className={styles.opponent}>{opponent.name}</strong><dl className={styles.facts}><div><dt>Matchweek</dt><dd>{nextFixture.round}</dd></div><div><dt>Date</dt><dd>{readableDate(nextFixture.date)}</dd></div><div><dt>Venue</dt><dd>{nextFixture.homeClubId === team.id ? 'Home' : 'Away'}</dd></div></dl></> : <p className={styles.note}>All 38 rounds are complete. The final table and previous match report remain available.</p>}
        <button className={`${styles.button} ${styles.spaced}`} onClick={onOpenMatchday}>{season.status === 'finished' ? 'Review Matchday' : 'Open Matchday'}</button>
      </div></section>
    </div>
    <section className={styles.panel} aria-labelledby="demo-club-record-title"><header className={styles.panelHead}><h3 id="demo-club-record-title">League record</h3><span>Committed results only</span></header><div className={styles.record}><div><span>Won</span><strong>{standing.won}</strong></div><div><span>Drawn</span><strong>{standing.drawn}</strong></div><div><span>Lost</span><strong>{standing.lost}</strong></div><div><span>Goals for</span><strong>{standing.goalsFor}</strong></div><div><span>Goals against</span><strong>{standing.goalsAgainst}</strong></div><div><span>Goal difference</span><strong>{standing.goalDifference > 0 ? '+' : ''}{standing.goalDifference}</strong></div></div></section>
    <p className={styles.note}>Generic demo club. Fixtures, standings, positions and player values describe this practice scenario; no real club information or financial figures are supplied.</p>
  </section>;
}
