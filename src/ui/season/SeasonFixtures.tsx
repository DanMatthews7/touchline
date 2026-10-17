import { useEffect, useState } from 'react';
import type { SeasonFixture, SeasonResult, SeasonState } from '../../simulation/season';
import { readableDate } from '../formatters';
import { SeasonStats } from './SeasonStats';
import styles from './SeasonWorkspace.module.css';

export function SeasonFixtures({ season, busy, onOpenMatchday }: { season: SeasonState; busy: boolean; onOpenMatchday?: () => void }) {
  const [tab, setTab] = useState<'schedule' | 'results' | 'calendar'>('schedule');
  const [round, setRound] = useState(Math.min(38, season.roundIndex + 1));
  const [managedOnly, setManagedOnly] = useState(false);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  useEffect(() => { setRound(Math.min(38, season.roundIndex + 1)); }, [season.roundIndex]);
  const managedId = season.config.managedClubId;
  const clubNames = new Map(season.config.teams.map(team => [team.id, team.name]));
  const resultByFixture = new Map(season.results.map(result => [result.fixtureId, result]));
  const currentRound = season.roundIndex + 1;
  const stagedIds = new Set(season.pendingResults.map(result => result.fixtureId));
  useEffect(() => { setSelectedResult(null); }, [round, tab]);
  const fixtures = season.fixtures.filter(fixture => fixture.round === round && (!managedOnly || fixture.homeClubId === managedId || fixture.awayClubId === managedId));
  const displayed = tab === 'results' ? fixtures.filter(fixture => resultByFixture.has(fixture.id)) : fixtures;
  const detail = selectedResult ? season.results.find(result => result.fixtureId === selectedResult) : undefined;
  const detailFixture = detail ? season.fixtures.find(fixture => fixture.id === detail.fixtureId) : undefined;
  function resultText(result: SeasonResult | undefined): string { return result ? `${result.summary.score.home} – ${result.summary.score.away}` : '—'; }
  function fixtureState(fixture: SeasonFixture): string {
    if (resultByFixture.has(fixture.id)) return 'Full time';
    if (season.blockedFixtureId === fixture.id) return 'Abandoned · review';
    if (stagedIds.has(fixture.id) || (season.lastManagedMatch?.fixtureId === fixture.id && season.lastManagedMatch.state.status === 'finished')) return 'Awaiting round commit';
    if (season.activeMatch?.fixtureId === fixture.id) return season.activeMatch.state.status === 'finished' ? 'Awaiting round commit' : `${season.activeMatch.state.minute}′ · in progress`;
    return 'Scheduled';
  }
  return <>
    <div className={styles.tabs} role="group" aria-label="Fixture views">{(['schedule', 'results', 'calendar'] as const).map(item => <button key={item} className={`${styles.tab} ${tab === item ? styles.tabActive : ''}`} aria-pressed={tab === item} onClick={() => { setTab(item); if (item === 'results' && round > season.roundIndex && season.roundIndex > 0) setRound(season.roundIndex); }}>{item === 'schedule' ? 'Schedule' : item === 'results' ? 'Results' : 'Calendar'}</button>)}</div>
    <section className={styles.panel} aria-labelledby="season-fixtures-title">
      <header className={styles.panelHead}><h2 id="season-fixtures-title">{tab === 'calendar' ? 'Your season calendar' : tab === 'results' ? 'Committed results' : 'League fixtures'}</h2><span>{season.fixtures.length} scheduled · {season.results.length} completed</span></header>
      {tab !== 'calendar' && <div className={styles.toolbar}><div className={styles.actions}><label className={styles.inlineLabel}>Matchweek<select className={styles.select} aria-label="Fixture round" value={round} onChange={event => setRound(Number(event.target.value))}>{Array.from({ length: 38 }, (_, index) => <option key={index} value={index + 1}>Round {index + 1} · {readableDate(season.fixtures.find(fixture => fixture.round === index + 1)?.date ?? season.currentDate)}</option>)}</select></label><label className={styles.check}><input type="checkbox" checked={managedOnly} onChange={event => setManagedOnly(event.target.checked)} />Managed club only</label></div><span className={styles.chip}>{displayed.length} fixture{displayed.length === 1 ? '' : 's'}</span></div>}
      <div className={styles.tableWrap} role="region" aria-label="Fixture and calendar table" tabIndex={0}>{tab === 'calendar' ? <table className={styles.table}><caption className={styles.hidden}>All 38 weekly fixtures for the managed club</caption><thead><tr><th scope="col">Round</th><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">Venue</th><th scope="col" className={styles.numeric}>Score H–A</th><th scope="col">Status</th></tr></thead><tbody>{season.fixtures.filter(fixture => fixture.homeClubId === managedId || fixture.awayClubId === managedId).sort((a, b) => a.round - b.round).map(fixture => <tr key={fixture.id} className={fixture.round === currentRound && season.status !== 'finished' ? styles.managedRow : ''}><td>{fixture.round}</td><td>{readableDate(fixture.date)}</td><td>{clubNames.get(fixture.homeClubId === managedId ? fixture.awayClubId : fixture.homeClubId)}</td><td>{fixture.homeClubId === managedId ? 'Home' : 'Away'}</td><td className={styles.scoreCell}>{resultText(resultByFixture.get(fixture.id))}</td><td>{fixtureState(fixture)}</td></tr>)}</tbody></table> : <table className={styles.table}><caption className={styles.hidden}>{tab === 'results' ? 'Completed results' : 'Scheduled matches'} for round {round}</caption><thead><tr><th scope="col">Date</th><th scope="col" className={styles.fixtureHome}>Home</th><th scope="col" className={styles.numeric}>Score</th><th scope="col">Away</th><th scope="col">Status</th><th scope="col">Review</th></tr></thead><tbody>{displayed.map(fixture => {
        const managed = fixture.homeClubId === managedId || fixture.awayClubId === managedId;
        const result = resultByFixture.get(fixture.id);
        return <tr key={fixture.id} className={managed ? styles.managedRow : ''}><td>{readableDate(fixture.date)}</td><td className={styles.fixtureHome}>{clubNames.get(fixture.homeClubId)}</td><td className={styles.scoreCell}>{resultText(result)}</td><td>{clubNames.get(fixture.awayClubId)}</td><td>{fixtureState(fixture)}</td><td>{result ? <button className={styles.textButton} onClick={() => setSelectedResult(previous => previous === fixture.id ? null : fixture.id)}>Result details</button> : managed && fixture.round === currentRound && onOpenMatchday ? <button className={styles.textButton} disabled={busy} onClick={onOpenMatchday}>Open Matchday</button> : '—'}</td></tr>;
      })}</tbody></table>}</div>
      {tab !== 'calendar' && displayed.length === 0 && <div className={styles.empty}>No committed results match this view yet. Complete the round in Matchday to record its ten full-time results together.</div>}
      <footer className={styles.tableFooter}>Scores shown here are committed full-time results. Your live managed match remains separate until the whole round can be committed.</footer>
    </section>
    {detail && detailFixture && <section className={`${styles.panel} ${styles.sectionGap}`} aria-label="Selected fixture result details"><header className={styles.panelHead}><h2>{clubNames.get(detailFixture.homeClubId)} {resultText(detail)} {clubNames.get(detailFixture.awayClubId)}</h2><button className={styles.button} onClick={() => setSelectedResult(null)}>Close result details</button></header><SeasonStats summary={detail.summary} /><footer className={styles.tableFooter}>Round {detail.round} · {readableDate(detailFixture.date)} · Statistics from this fixture’s authoritative event summary.</footer></section>}
  </>;
}
