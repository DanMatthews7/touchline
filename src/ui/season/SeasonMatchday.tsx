import { useEffect, useState } from 'react';
import { commentaryForEvent, getMatchSummary, MATCH_RULES, type MatchCommand, type MatchEvent, type MatchState } from '../../simulation/match';
import { getManagedSeasonFixture, MAX_SEASON_ABANDONMENT_RETRIES, type SeasonCommand, type SeasonState } from '../../simulation/season';
import { readableDate } from '../formatters';
import { MatchTeamPanel } from '../match/MatchTeamPanel';
import { SeasonStats } from './SeasonStats';
import styles from './SeasonWorkspace.module.css';

const keyEvents = new Set<MatchEvent['type']>(['KICKOFF', 'GOAL', 'SAVE', 'CARD', 'SUBSTITUTION', 'TACTICS_CHANGED', 'CHECKPOINT', 'FULL_TIME', 'ABANDONED']);

function MatchReport({ state }: { state: MatchState }) {
  const [filter, setFilter] = useState<'key' | 'all'>('key');
  const [limit, setLimit] = useState(120);
  useEffect(() => { setLimit(120); }, [filter, state.config.id]);
  const events = state.events.filter(event => filter === 'all' || keyEvents.has(event.type));
  const visible = events.slice(-limit).reverse();
  const summary = getMatchSummary(state);
  return <div className={styles.grid}>
    <section className={styles.panel}><header className={styles.panelHead}><h2>Match statistics</h2><span>Home / away</span></header><SeasonStats summary={summary} /></section>
    <section className={styles.panel}><header className={styles.panelHead}><h2>Match commentary</h2><select className={styles.select} aria-label="League commentary filter" value={filter} onChange={event => setFilter(event.target.value as 'key' | 'all')}><option value="key">Key events</option><option value="all">All events</option></select></header>{visible.length > 0 ? <ol className={styles.log} aria-label="League match events" tabIndex={0}>{visible.map(event => <li key={event.id} className={event.type === 'GOAL' ? styles.goal : ''}><span className={styles.minute}>{event.minute}′</span><div><span className={styles.eventType}>{event.type.replaceAll('_', ' ')}</span>{commentaryForEvent(state, event)}</div></li>)}</ol> : <div className={styles.empty}>The teams are ready for kick-off. Advance the match to generate football events.</div>}<footer className={styles.logFooter}><span>Latest {visible.length} / {events.length} matching events · newest first</span>{visible.length < events.length && <button className={styles.button} onClick={() => setLimit(previous => previous + 120)}>Show 120 earlier league events</button>}</footer></section>
  </div>;
}

function Scoreboard({ state, round, date }: { state: MatchState; round: number; date: string }) {
  const summary = getMatchSummary(state);
  const status = state.status === 'finished' ? 'Full time' : state.status === 'abandoned' ? 'Abandoned' : state.minute === 0 ? 'Ready for kick-off' : state.minute === 45 ? 'Half-time' : 'Touchline checkpoint';
  return <div className={styles.fixtureHero} aria-label="League match score"><div className={styles.heroClubs}><span className={styles.heroTeam}>{state.config.home.name}</span><span className={styles.heroScore} aria-label={`League score ${summary.score.home} to ${summary.score.away}`}>{summary.score.home} – {summary.score.away}</span><span className={styles.heroTeam}>{state.config.away.name}</span></div><div className={styles.heroMeta} aria-live="polite">{state.minute}′ · {status} · Round {round} · {readableDate(date)}</div></div>;
}

export function SeasonMatchday({ season, busy, onCommand }: { season: SeasonState; busy: boolean; onCommand: (command: SeasonCommand) => void | Promise<void> }) {
  const fixture = season.status === 'finished' ? null : getManagedSeasonFixture(season);
  const active = season.activeMatch;
  const names = new Map(season.config.teams.map(team => [team.id, team.name]));
  const activeFixture = active ? season.fixtures.find(item => item.id === active.fixtureId) : undefined;
  const activeManaged = active?.state.config.home.id === season.config.managedClubId || active?.state.config.away.id === season.config.managedClubId;
  const managedSide = active?.state.config.home.id === season.config.managedClubId ? 'home' : 'away';
  const activeTerminal = active?.state.status === 'finished' || active?.state.status === 'abandoned';
  const attempts = season.blockedFixtureId ? season.fixtureAttempts[season.blockedFixtureId] ?? 0 : 0;
  const nextMinute = active ? Math.min(MATCH_RULES.durationMinutes, active.state.minute + MATCH_RULES.checkpointMinutes) : 15;
  async function matchCommand(command: MatchCommand) { await onCommand({ type: 'MATCH_COMMAND', command }); }
  return <>
    {season.status === 'finished' && <div className={`${styles.notice} ${styles.success}`} role="status"><strong>Season complete.</strong> All 38 rounds and 380 fixtures have been committed. Review the final table in Competitions and export a season backup.</div>}
    {season.status === 'blocked' && <div className={`${styles.notice} ${styles.error}`} role="alert"><strong>An abandoned fixture has paused this round.</strong> No score has been awarded and staged results have not entered the table. {attempts < MAX_SEASON_ABANDONMENT_RETRIES ? 'You may replay the abandoned fixture with the next recorded deterministic attempt.' : 'All three replay attempts are exhausted. Export the season for review.'}<div className={`${styles.actions} ${styles.sectionGap}`}><button className={styles.button} disabled={busy || attempts >= MAX_SEASON_ABANDONMENT_RETRIES} onClick={() => void onCommand({ type: 'REPLAY_ABANDONED' })}>Replay abandoned fixture</button><span>Replay attempts: {attempts} / {MAX_SEASON_ABANDONMENT_RETRIES} · {season.pendingResults.length} results staged</span></div></div>}
    {!active && fixture && <>
      <div className={styles.fixtureHero}><span className={styles.eyebrow}>Your next league fixture</span><div className={styles.heroClubs}><span className={styles.heroTeam}>{names.get(fixture.homeClubId)}</span><span className={styles.heroScore}>v</span><span className={styles.heroTeam}>{names.get(fixture.awayClubId)}</span></div><div className={styles.heroMeta}>Round {fixture.round} / 38 · {readableDate(fixture.date)} · {fixture.homeClubId === season.config.managedClubId ? 'Home fixture' : 'Away fixture'}</div></div>
      <div className={styles.matchActions}><div className={styles.actions}>{season.status === 'between-rounds' && <button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => void onCommand({ type: 'ADVANCE_CALENDAR' })}>Advance calendar to matchday</button>}{season.status === 'matchday' && <button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => void onCommand({ type: 'START_MATCH' })}>Start league match</button>}</div><span className={styles.chip}>Current date: {readableDate(season.currentDate)}</span></div>
      <div className={styles.notice}>{season.status === 'between-rounds' ? `Advance the calendar to ${readableDate(fixture.date)} before starting the fixture. Match results are generated when football is played.` : 'The fixture date has arrived. Start your managed match, then make decisions at 15-minute checkpoints.'}</div>
    </>}
    {active && activeFixture && <>
      <Scoreboard state={active.state} round={activeFixture.round} date={activeFixture.date} />
      <div className={styles.matchActions}><div className={styles.actions}>{season.status === 'playing' && <button className={`${styles.button} ${styles.primary}`} disabled={busy || activeTerminal} onClick={() => void matchCommand({ type: 'ADVANCE' })}>{active.state.minute === 0 ? 'Kick off league match · advance to 15′' : `Advance league match to ${nextMinute}′`}</button>}{season.status === 'round-ready' && <button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => void onCommand({ type: 'COMPLETE_ROUND' })}>Complete round & advance league</button>}</div><div className={styles.actions}><span className={styles.chip}>Match seed {active.state.config.seed}</span><span className={styles.chip}>Attempt {active.attempt + 1}</span><span className={styles.chip}>{active.state.config.assessmentMode === 'uniform-missing-10' ? 'Missing ability: 10/20 estimates' : 'Recorded game assessments'}</span></div></div>
      {season.status === 'round-ready' && <div className={styles.notice}>Your match has reached full time. Complete the round to simulate the other nine fixtures with the same engine and commit all ten results together. Calendar advancement to the following matchweek is a separate action.</div>}
      <MatchReport state={active.state} />
      {activeManaged && <MatchTeamPanel key={`${season.config.id}-${active.fixtureId}-${active.attempt}-${active.state.commands.length}`} state={active.state} side={managedSide} busy={busy || season.status !== 'playing'} onCommand={matchCommand} />}
      {!activeManaged && <p className={styles.small}>This is an opposition fixture from the same round. Its abandonment is visible for review; you can control only your managed club.</p>}
    </>}
    {!active && season.lastManagedMatch && (() => {
      const previous = season.lastManagedMatch;
      const previousFixture = season.fixtures.find(item => item.id === previous.fixtureId);
      return previousFixture ? <details className={`${styles.panel} ${styles.report}`}><summary>Review previous managed fixture · Round {previousFixture.round}</summary><div className={styles.recentReport}><Scoreboard state={previous.state} round={previousFixture.round} date={previousFixture.date} /><MatchReport state={previous.state} /></div></details> : null;
    })()}
    <p className={styles.small}>Only your own team can receive tactical changes or substitutions. Committed results feed the league table once; exhibition matches and their archives remain separate.</p>
  </>;
}
