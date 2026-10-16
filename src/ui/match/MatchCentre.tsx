import { useEffect, useMemo, useRef, useState } from 'react';
import type { Player } from '../../domain/models';
import { ALL_ATTRIBUTE_PATHS, getAttributeValue } from '../../domain/attributes';
import { DEFAULT_INSTRUCTIONS, defaultExhibitionSelection, prepareExhibition, type ExhibitionOptions } from '../../match/prepare';
import { createMatchArchive, exportMatchArchive, MAX_MATCH_ARCHIVE_BYTES, MatchSessionRepository, type MatchArchive } from '../../persistence/match';
import { applyMatchCommand, commentaryForEvent, createMatch, getMatchSummary, MATCH_RULES } from '../../simulation/match';
import type { MatchCommand, MatchEvent, MatchState } from '../../simulation/match';
import { MatchTeamPanel } from './MatchTeamPanel';
import { TeamSetup } from './TeamSetup';
import styles from './MatchCentre.module.css';

type Session = { archive: MatchArchive; state: MatchState };
type Notice = { kind: 'info' | 'error' | 'success'; text: string };
const highlightedTypes = new Set<MatchEvent['type']>(['KICKOFF', 'GOAL', 'SAVE', 'CARD', 'SUBSTITUTION', 'TACTICS_CHANGED', 'CHECKPOINT', 'FULL_TIME', 'ABANDONED']);
function messageFor(cause: unknown): string { return cause instanceof Error ? cause.message : 'The match operation could not be completed.'; }
function exportDownload(archive: MatchArchive) {
  const url = URL.createObjectURL(new Blob([exportMatchArchive(archive)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `touchline-exhibition-${archive.id}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exhibition state is isolated from the career database and advances only through engine commands. */
export function MatchCentre({ catalogue }: { catalogue: Player[] }) {
  const [repository] = useState(() => new MatchSessionRepository());
  const selection = useMemo(() => {
    try { return { ...defaultExhibitionSelection(catalogue), error: null }; }
    catch (cause) { return { homePlayerIds: [] as string[], awayPlayerIds: [] as string[], error: messageFor(cause) }; }
  }, [catalogue]);
  const [options, setOptions] = useState<ExhibitionOptions>(() => ({
    id: '', seed: 777, homePlayerIds: selection.homePlayerIds, awayPlayerIds: selection.awayPlayerIds,
    homeFormation: '4-3-3', awayFormation: '4-3-3', homeInstructions: { ...DEFAULT_INSTRUCTIONS }, awayInstructions: { ...DEFAULT_INSTRUCTIONS },
    initialCondition: 100, initialMorale: 70, useUniformEstimates: false, homeAdvantage: false,
  }));
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(true);
  const [logFilter, setLogFilter] = useState<'highlights' | 'all'>('highlights');
  const [eventLimit, setEventLimit] = useState(120);
  const running = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void repository.loadLatest().then(restored => {
      if (active && restored) {
        setSession(restored);
        setNotice({ kind: 'info', text: `Restored the latest local exhibition at ${restored.state.minute}′. Career saves are separate.` });
      }
    }).catch(cause => { if (active) setNotice({ kind: 'error', text: `Exhibition storage could not be opened. ${messageFor(cause)}` }); })
      .finally(() => { if (active) setOpening(false); });
    return () => { active = false; };
  }, [repository]);

  useEffect(() => { setEventLimit(120); }, [logFilter, session?.archive.id]);

  async function run(operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try { await operation(); }
    catch (cause) { setNotice({ kind: 'error', text: messageFor(cause) }); }
    finally { running.current = false; setBusy(false); }
  }
  async function prepare() {
    await run(async () => {
      const config = prepareExhibition(catalogue, { ...options, id: crypto.randomUUID() });
      const state = createMatch(config);
      const archive = createMatchArchive(config.id, config, [], new Date().toISOString());
      await repository.save(archive);
      setSession({ archive, state });
      setNotice({ kind: 'success', text: 'Exhibition prepared and saved. Advance in 15-minute checkpoints; changes are saved before the report updates.' });
    });
  }
  async function command(input: MatchCommand) {
    if (!session) return;
    await run(async () => {
      const result = applyMatchCommand(session.state, input);
      if (!result.ok) throw new Error(result.error.message);
      const archive = createMatchArchive(session.archive.id, result.state.config, result.state.commands, new Date().toISOString());
      await repository.save(archive);
      setSession({ archive, state: result.state });
      setNotice({ kind: 'success', text: input.type === 'ADVANCE' ? `Saved the ${result.state.minute}′ checkpoint. The report and commentary come from the authoritative event log.` : input.type === 'SUBSTITUTE' ? 'Substitution applied and saved.' : 'Tactical change applied and saved.' });
    });
  }
  async function restoreLatest() {
    await run(async () => {
      const restored = await repository.loadLatest();
      if (!restored) throw new Error('No local exhibition archives are available yet.');
      setSession(restored);
      setNotice({ kind: 'success', text: `Restored the latest exhibition at ${restored.state.minute}′ by replaying its saved commands.` });
    });
  }
  async function importArchive(file: File) {
    await run(async () => {
      if (file.size > MAX_MATCH_ARCHIVE_BYTES) throw new Error('Exhibition archive exceeds the 16 MiB limit.');
      const restored = await repository.import(await file.text());
      setSession(restored);
      setNotice({ kind: 'success', text: 'Exhibition archive validated, replayed and saved. Its original seed, assumptions and commands are preserved.' });
    });
  }

  const chosen = new Set([...options.homePlayerIds, ...options.awayPlayerIds]);
  const missingAttributes = catalogue.filter(player => chosen.has(player.id)).some(player => ALL_ATTRIBUTE_PATHS.some(path => getAttributeValue(player.attributes, path) === null));
  const summary = session ? getMatchSummary(session.state) : null;
  const filteredEvents = session?.state.events.filter(event => logFilter === 'all' || highlightedTypes.has(event.type)) ?? [];
  const visibleEvents = filteredEvents.slice(-eventLimit).reverse();
  const ended = session?.state.status === 'finished' || session?.state.status === 'abandoned';
  const nextMinute = session ? Math.min(MATCH_RULES.durationMinutes, session.state.minute + MATCH_RULES.checkpointMinutes) : 15;
  const disabled = busy || opening;
  const stats = summary ? [
    ['Possession', `${summary.stats.home.possession.toFixed(1)}%`, `${summary.stats.away.possession.toFixed(1)}%`],
    ['Shots / on target', `${summary.stats.home.shots} / ${summary.stats.home.shotsOnTarget}`, `${summary.stats.away.shots} / ${summary.stats.away.shotsOnTarget}`],
    ['Expected goals', summary.stats.home.expectedGoals.toFixed(2), summary.stats.away.expectedGoals.toFixed(2)],
    ['Chances', summary.stats.home.chances, summary.stats.away.chances],
    ['Passes completed / attempted', `${summary.stats.home.passesCompleted} / ${summary.stats.home.passesAttempted}`, `${summary.stats.away.passesCompleted} / ${summary.stats.away.passesAttempted}`],
    ['Tackles won / attempted', `${summary.stats.home.tacklesWon} / ${summary.stats.home.tacklesAttempted}`, `${summary.stats.away.tacklesWon} / ${summary.stats.away.tacklesAttempted}`],
    ['Saves', summary.stats.home.saves, summary.stats.away.saves],
    ['Fouls', summary.stats.home.fouls, summary.stats.away.fouls],
    ['Yellow / red cards', `${summary.stats.home.yellowCards} / ${summary.stats.home.redCards}`, `${summary.stats.away.yellowCards} / ${summary.stats.away.redCards}`],
  ] : [];

  return <section className={styles.centre} aria-label="Exhibition Match Centre">
    <div className={styles.heading}><div><span className={styles.eyebrow}>Milestone 02 / exhibition football</span><h1 className={styles.title}>Match Centre</h1><p className={styles.subtitle}>Two temporary selections. One seeded match. Every result has a football event behind it.</p></div><div className={styles.actions}>
      <button className={styles.button} disabled={disabled} onClick={() => inputRef.current?.click()}>Import match archive</button>
      <input ref={inputRef} className={styles.hidden} tabIndex={-1} aria-label="Import match archive file" type="file" accept=".json,application/json" onChange={event => { const file = event.target.files?.[0]; if (file) void importArchive(file); event.target.value = ''; }} />
      <button className={styles.button} disabled={disabled} onClick={() => void restoreLatest()}>Restore latest match</button>
      {session && <button className={styles.button} disabled={disabled} onClick={() => void run(async () => { exportDownload(session.archive); setNotice({ kind: 'success', text: 'Exhibition archive exported with its configuration, seed and commands. Career saves are unchanged.' }); })}>Export match archive</button>}
    </div></div>
    <div className={styles.notice}><strong>Exhibition selections • not real club squads.</strong> The bundled catalogue provides sourced identities for temporary teams. Imported archives are model scenarios and do not verify player identities or facts. Attribute estimates, condition, morale and tactical assignments are game assumptions; this match does not advance a career or season.</div>
    {notice && <div role={notice.kind === 'error' ? 'alert' : 'status'} className={`${styles.notice} ${notice.kind === 'error' ? styles.error : notice.kind === 'success' ? styles.success : ''}`}>{notice.text}</div>}
    {opening ? <p className={styles.empty} aria-live="polite">Opening local exhibition archives…</p> : !session ? <form onSubmit={event => { event.preventDefault(); void prepare(); }}>
      <section className={styles.panel} style={{ marginBottom: 16 }}><header className={styles.panelHead}><h2>Set the match assumptions</h2><span>{catalogue.length} catalogue identities available</span></header><div className={styles.body}>
        <div className={styles.assumptions}>
          <label className={styles.field}>Match seed<input aria-label="Match seed" type="number" min={0} max={4294967295} step={1} required value={options.seed} disabled={disabled} onChange={event => setOptions(previous => ({ ...previous, seed: Number(event.target.value) }))} /></label>
          <label className={styles.field}>Starting condition /100<input aria-label="Starting condition" type="number" min={0} max={100} step={1} required value={options.initialCondition} disabled={disabled} onChange={event => setOptions(previous => ({ ...previous, initialCondition: Number(event.target.value) }))} /></label>
          <label className={styles.field}>Starting morale /100<input aria-label="Starting morale" type="number" min={0} max={100} step={1} required value={options.initialMorale} disabled={disabled} onChange={event => setOptions(previous => ({ ...previous, initialMorale: Number(event.target.value) }))} /></label>
          <label className={styles.check}><input type="checkbox" checked={options.homeAdvantage} disabled={disabled} onChange={event => setOptions(previous => ({ ...previous, homeAdvantage: event.target.checked }))} />Home action advantage (4%)</label>
        </div>
        <label className={`${styles.check} ${styles.assumptionCheck}`}><input type="checkbox" checked={options.useUniformEstimates} disabled={disabled} onChange={event => setOptions(previous => ({ ...previous, useUniformEstimates: event.target.checked }))} /><span><strong>Use uniform 10/20 exhibition estimates</strong><br />Fill missing visible attributes with the same original comparison assumption. Existing editorial assessments are preserved. These estimates do not represent verified player ability and are never written to the career database.</span></label>
        {missingAttributes && !options.useUniformEstimates && <p className={styles.small}>Selected records contain unassessed attributes. Explicitly opt into the uniform estimates before preparing this exhibition, or import complete original game assessments for the selected records.</p>}
        {selection.error && <p className={styles.error} role="alert">Exhibition selection is not ready: {selection.error}</p>}
      </div></section>
      <div className={styles.grid}><TeamSetup side="Home" catalogue={catalogue} playerIds={options.homePlayerIds} otherPlayerIds={options.awayPlayerIds} formation={options.homeFormation} instructions={options.homeInstructions} onPlayers={ids => setOptions(previous => ({ ...previous, homePlayerIds: ids }))} onFormation={formation => setOptions(previous => ({ ...previous, homeFormation: formation }))} onInstructions={instructions => setOptions(previous => ({ ...previous, homeInstructions: instructions }))} disabled={disabled} /><TeamSetup side="Away" catalogue={catalogue} playerIds={options.awayPlayerIds} otherPlayerIds={options.homePlayerIds} formation={options.awayFormation} instructions={options.awayInstructions} onPlayers={ids => setOptions(previous => ({ ...previous, awayPlayerIds: ids }))} onFormation={formation => setOptions(previous => ({ ...previous, awayFormation: formation }))} onInstructions={instructions => setOptions(previous => ({ ...previous, awayInstructions: instructions }))} disabled={disabled} /></div>
      <div className={`${styles.panel} ${styles.setupFooter}`}><p>Defaults distribute sourced identities for comparison, not player quality.<br />The same inputs, seed and commands reproduce the same match.</p><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={disabled || Boolean(selection.error) || (missingAttributes && !options.useUniformEstimates)}>Prepare exhibition match</button></div>
    </form> : summary && <>
      <div className={styles.scoreboard} aria-label="Authoritative match score">
        <div><div className={styles.teamName}>{session.state.config.home.name}</div><div className={styles.teamMeta}>{session.state.teams.home.formation} · {session.state.teams.home.instructions.mentality}</div></div>
        <div><div className={styles.score} aria-label={`Score ${summary.score.home} to ${summary.score.away}`}>{summary.score.home} – {summary.score.away}</div><div className={styles.clock} aria-live="polite">{session.state.minute}′ · {session.state.status === 'finished' ? 'Full time' : session.state.status === 'abandoned' ? 'Abandoned' : session.state.minute === 0 ? 'Ready for kick-off' : session.state.minute === 45 ? 'Half-time' : 'Touchline checkpoint'}</div><div className={styles.progress} aria-hidden="true"><div className={styles.progressFill} style={{ width: `${session.state.minute / MATCH_RULES.durationMinutes * 100}%` }} /></div></div>
        <div><div className={styles.teamName}>{session.state.config.away.name}</div><div className={styles.teamMeta}>{session.state.teams.away.formation} · {session.state.teams.away.instructions.mentality}</div></div>
      </div>
      <div className={styles.matchActions}><div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} disabled={disabled || ended} onClick={() => void command({ type: 'ADVANCE' })}>{ended ? 'Match complete' : session.state.minute === 0 ? 'Kick off · advance to 15′' : `Advance to ${nextMinute}′`}</button><button className={styles.button} disabled={disabled} onClick={() => { setSession(null); setNotice({ kind: 'info', text: 'Set up another exhibition. Previous match archives remain saved locally.' }); }}>New exhibition</button></div><div className={styles.actions}><span className={styles.chip}>Seed {session.state.config.seed}</span><span className={styles.chip}>Engine v{session.state.engineVersion}</span><span className={styles.chip}>{session.state.config.assessmentMode === 'uniform-missing-10' ? 'Missing attributes: uniform 10/20' : 'Recorded game assessments'}</span></div></div>
      <div className={styles.grid}>
        <section className={styles.panel}><header className={styles.panelHead}><h2>Match statistics</h2><span>Home / away</span></header><table className={styles.stats}><caption className={styles.hidden}>Statistics derived from the authoritative match event log</caption><tbody>{stats.map(([label, home, away]) => <tr key={label}><td>{home}</td><td>{label}</td><td>{away}</td></tr>)}</tbody></table></section>
        <section className={styles.panel}><header className={styles.panelHead}><h2>Match commentary</h2><select className={styles.control} aria-label="Commentary event filter" value={logFilter} onChange={event => setLogFilter(event.target.value as 'highlights' | 'all')}><option value="highlights">Key events</option><option value="all">All events</option></select></header>{visibleEvents.length ? <ol className={styles.log} aria-label="Authoritative match events">{visibleEvents.map(event => <li key={event.id} className={event.type === 'GOAL' ? styles.logGoal : ''}><span className={styles.logMinute}>{event.minute}′</span><div className={styles.logEvent}><span className={styles.logType}>{event.type.replaceAll('_', ' ')}</span>{commentaryForEvent(session.state, event)}</div></li>)}</ol> : <div className={styles.empty}>The teams are ready. Kick off to generate the first passage of play.</div>}<footer className={styles.logFooter}><span>Latest {visibleEvents.length} of {filteredEvents.length} matching events · {session.state.events.length} total · newest first</span>{visibleEvents.length < filteredEvents.length && <button className={styles.button} onClick={() => setEventLimit(previous => previous + 120)}>Show 120 earlier events</button>}</footer></section>
      </div>
      <div className={styles.grid}><MatchTeamPanel key={`${session.archive.id}-${session.state.commands.length}-home`} state={session.state} side="home" busy={disabled} onCommand={command} /><MatchTeamPanel key={`${session.archive.id}-${session.state.commands.length}-away`} state={session.state} side="away" busy={disabled} onCommand={command} /></div>
      <p className={styles.small}>Match archives contain only the starting exhibition configuration and accepted commands. Restoring replays the same event engine; scores, statistics and commentary are not saved as competing results. Last saved: {session.archive.updatedAt}</p>
    </>}
  </section>;
}

export default MatchCentre;
