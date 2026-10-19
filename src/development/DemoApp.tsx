import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SeasonCommand } from '../simulation/season';
import { readableDate } from '../ui/formatters';
import { SeasonFixtures } from '../ui/season/SeasonFixtures';
import { SeasonMatchday } from '../ui/season/SeasonMatchday';
import { SeasonStandings } from '../ui/season/SeasonStandings';
import type { DemoSession } from './archive';
import { DemoRepository } from './repository';
import { defaultDemoScenario, DEMO_CLUBS, type DemoScenario } from './scenario';
import styles from './DemoApp.module.css';

type View = 'fixtures' | 'table' | 'matchday';
type Notice = { kind: 'success' | 'error' | 'info'; text: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation could not be completed.';
}

function downloadBackup(serialized: string, date: string): void {
  const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `touchline-demo-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  // Keep the object URL alive long enough for browsers to begin the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

class DemoErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className={styles.main} aria-label="Development demo workspace"><h1>Development demo</h1><div className={`${styles.notice} ${styles.error}`} role="alert">The demo could not display this screen. Reload to restore the last saved checkpoint. Your main game and its saves are separate.</div><button className={styles.button} onClick={() => window.location.reload()}>Reload saved demo</button></main>;
    return this.props.children;
  }
}

export default function DemoApp() {
  return <DemoErrorBoundary><DemoWorkspace /></DemoErrorBoundary>;
}

/** Separate development-only controller. It never opens a career or exhibition repository. */
function DemoWorkspace() {
  const repository = useRef<DemoRepository | null>(null);
  const operationRunning = useRef(false);
  const sessionRef = useRef<DemoSession | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [opening, setOpening] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [view, setView] = useState<View>('fixtures');
  const [showSetup, setShowSetup] = useState(true);
  const [replacementRequired, setReplacementRequired] = useState(false);
  const [replacementConfirmed, setReplacementConfirmed] = useState(false);
  const [scenario, setScenario] = useState<DemoScenario>(defaultDemoScenario);

  useEffect(() => {
    const current = new DemoRepository();
    repository.current = current;
    let cancelled = false;
    void current.load().then(saved => {
      if (cancelled) return;
      sessionRef.current = saved ?? null;
      setSession(saved ?? null);
      setShowSetup(!saved);
      setReplacementRequired(Boolean(saved));
      if (saved) setNotice({ kind: 'info', text: 'Your saved demo season is ready to continue.' });
    }).catch(error => {
      if (cancelled) return;
      setReplacementRequired(true);
      setNotice({ kind: 'error', text: `The saved demo could not be restored. ${errorMessage(error)} Import a valid demo backup, or explicitly replace this saved demo below.` });
    }).finally(() => {
      if (!cancelled) setOpening(false);
    });
    return () => {
      cancelled = true;
      if (repository.current === current) repository.current = null;
      current.close();
    };
  }, []);

  function acceptSession(next: DemoSession): void {
    sessionRef.current = next;
    setSession(next);
    setReplacementRequired(true);
  }

  async function operate(action: (current: DemoRepository) => Promise<void>): Promise<void> {
    const current = repository.current;
    if (!current || opening || operationRunning.current) return;
    operationRunning.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await action(current);
    } catch (error) {
      if (repository.current === current) setNotice({ kind: 'error', text: `${errorMessage(error)} Your previous saved demo has been kept.` });
    } finally {
      operationRunning.current = false;
      if (repository.current === current) setBusy(false);
    }
  }

  async function startDemo(): Promise<void> {
    if (replacementRequired && !replacementConfirmed) return;
    await operate(async current => {
      const next = await current.start(scenario, new Date().toISOString());
      if (repository.current !== current) return;
      acceptSession(next);
      setShowSetup(false);
      setReplacementConfirmed(false);
      setView('fixtures');
      setNotice({ kind: 'success', text: 'Demo season started. Open Matchday to play your first fixture.' });
    });
  }

  async function command(command: SeasonCommand): Promise<void> {
    await operate(async current => {
      const previous = sessionRef.current;
      if (!previous) throw new Error('Start or import a demo season first.');
      const next = await current.commit(command, new Date().toISOString(), previous.state.commands);
      if (repository.current !== current) return;
      acceptSession(next);
    });
  }

  async function importBackup(file: File): Promise<void> {
    await operate(async current => {
      if (file.size > 16 * 1024 * 1024) throw new Error('Demo backups must be no larger than 16 MiB.');
      const next = await current.import(await file.text());
      if (repository.current !== current) return;
      acceptSession(next);
      setShowSetup(false);
      setReplacementConfirmed(false);
      setView('fixtures');
      setNotice({ kind: 'success', text: 'Demo backup restored. Its saved progress is ready to continue.' });
    });
  }

  async function exportBackup(): Promise<void> {
    await operate(async current => {
      const serialized = await current.export();
      if (repository.current !== current) return;
      downloadBackup(serialized, sessionRef.current?.state.currentDate ?? 'backup');
      setNotice({ kind: 'success', text: 'Demo backup downloaded. Keep it before replacing a demo or clearing browser storage.' });
    });
  }

  function openNewDemo(): void {
    if (opening || operationRunning.current) return;
    setScenario(defaultDemoScenario());
    setReplacementConfirmed(false);
    setShowSetup(true);
    setNotice(null);
  }

  const disabled = opening || busy;
  const season = session?.state ?? null;
  const managedName = season?.config.teams.find(team => team.id === season.config.managedClubId)?.name;
  const nextFixture = season?.fixtures.find(fixture => fixture.round === season.roundIndex + 1 && (fixture.homeClubId === season.config.managedClubId || fixture.awayClubId === season.config.managedClubId));
  const nextOpponentId = nextFixture?.homeClubId === season?.config.managedClubId ? nextFixture?.awayClubId : nextFixture?.homeClubId;
  const nextOpponent = season?.config.teams.find(team => team.id === nextOpponentId)?.name;

  return <div className={styles.app}>
    <a className={styles.skipLink} href="#demo-content">Skip to demo workspace</a>
    <header className={styles.topbar}>
      <div className={styles.brand}><span className={styles.brandMark} aria-hidden="true">T</span><div><strong>TOUCHLINE</strong><span>Football management / development build</span></div></div>
      <span className={styles.buildLabel}>Season &amp; match systems</span>
    </header>
    <main className={styles.main} id="demo-content" tabIndex={-1} aria-label="Development demo workspace">
      <div className={styles.heading}>
        <div><span className={styles.eyebrow}>Play and review while the database is deferred</span><h1>Development demo</h1><p>{season ? `${season.config.name} · Managing ${managedName}` : 'A separate practice season for exploring fixtures, tactics and match progression.'}</p></div>
        <div className={styles.actions}>
          <button className={styles.button} disabled={disabled} onClick={() => importInput.current?.click()}>Import demo backup</button>
          <input ref={importInput} className={styles.hidden} tabIndex={-1} type="file" accept=".json,application/json" aria-label="Import demo backup file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void importBackup(file); }} />
          {season && <><button className={styles.button} disabled={disabled} onClick={() => void exportBackup()}>Export demo backup</button><button className={styles.button} disabled={disabled || showSetup} onClick={openNewDemo}>New demo season</button></>}
        </div>
      </div>

      <aside className={styles.banner} aria-label="Development demo data notice">
        <span className={styles.demoBadge}>Development demo</span>
        <div><strong>Generic clubs and players · Uniform ability 10/20 · Real database deferred</strong><p>This practice league contains no real club squads or player facts. Its fixtures and results are simulated. Your main game and its saves stay separate.</p></div>
      </aside>

      {notice && <div className={`${styles.notice} ${notice.kind === 'error' ? styles.error : notice.kind === 'success' ? styles.success : ''}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
      {busy && <p className={styles.saving} role="status">Saving demo progress…</p>}

      {opening ? <p className={styles.loading} role="status">Opening your saved demo…</p> : <>
        {showSetup && <section className={styles.panel} aria-labelledby="demo-setup-title">
          <header className={styles.panelHead}><h2 id="demo-setup-title">Start a demo season</h2><span>20 demo clubs · 38 matchweeks · 380 fixtures</span></header>
          <form onSubmit={event => { event.preventDefault(); void startDemo(); }}>
            <div className={styles.setupBody}>
              <p className={styles.setupIntro}>Choose a club and starting conditions. Every demo player begins with the same ability inputs; position, tactics, condition and match events still affect play.</p>
              <div className={styles.fields}>
                <label className={`${styles.field} ${styles.clubField}`}>Managed demo club<select value={scenario.managedClubId} disabled={disabled} onChange={event => setScenario(previous => ({ ...previous, managedClubId: event.target.value }))}>{DEMO_CLUBS.map(club => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
                <label className={styles.field}>Demo seed<input type="number" required min={0} max={4294967295} step={1} value={scenario.seed} disabled={disabled} onChange={event => setScenario(previous => ({ ...previous, seed: Number(event.target.value) }))} /></label>
                <label className={styles.field}>Demo start date<input type="date" required value={scenario.startDate} disabled={disabled} onChange={event => setScenario(previous => ({ ...previous, startDate: event.target.value, firstMatchDate: previous.firstMatchDate < event.target.value ? event.target.value : previous.firstMatchDate }))} /></label>
                <label className={styles.field}>First demo matchday<input type="date" required min={scenario.startDate} value={scenario.firstMatchDate} disabled={disabled} onChange={event => setScenario(previous => ({ ...previous, firstMatchDate: event.target.value }))} /></label>
                <label className={styles.field}>Starting condition<input type="number" required min={1} max={100} step={1} value={scenario.initialCondition} disabled={disabled} onChange={event => setScenario(previous => ({ ...previous, initialCondition: Number(event.target.value) }))} /></label>
                <label className={styles.field}>Starting morale<input type="number" required min={0} max={100} step={1} value={scenario.initialMorale} disabled={disabled} onChange={event => setScenario(previous => ({ ...previous, initialMorale: Number(event.target.value) }))} /></label>
              </div>
              <label className={styles.check}><input type="checkbox" disabled={disabled} checked={scenario.homeAdvantage > 0} onChange={event => setScenario(previous => ({ ...previous, homeAdvantage: event.target.checked ? 0.04 : 0 }))} />Apply 4% home action advantage</label>
              <p className={styles.small}>Condition and morale are starting inputs for each match. The schedule is an original weekly league, with every club playing each opponent home and away.</p>
              {replacementRequired && <div className={styles.replaceNotice}><strong>Keep a backup of the current demo if you want to return to it.</strong><label className={styles.check}><input type="checkbox" required checked={replacementConfirmed} disabled={disabled} onChange={event => setReplacementConfirmed(event.target.checked)} />Replace this saved demo when I start the new season</label><p className={styles.small}>Your current demo stays saved until the new settings are accepted.</p></div>}
            </div>
            <footer className={styles.setupFooter}><p>Demo progress saves automatically on this browser.</p><div className={styles.actions}>{season && <button className={styles.button} type="button" disabled={disabled} onClick={() => { setShowSetup(false); setReplacementConfirmed(false); }}>Keep current demo</button>}<button className={`${styles.button} ${styles.primary}`} type="submit" disabled={disabled || (replacementRequired && !replacementConfirmed)}>Start demo season</button></div></footer>
          </form>
        </section>}

        {season && <section className={styles.season} aria-label="Saved demo season">
          <div className={styles.summary} aria-label="Demo season progress">
            <div><span>Calendar date</span><strong>{readableDate(season.currentDate)}</strong></div>
            <div><span>Rounds complete</span><strong>{season.roundIndex} / 38</strong></div>
            <div><span>Results committed</span><strong>{season.results.length} / 380</strong></div>
            <div><span>{season.status === 'finished' ? 'Season status' : 'Next opponent'}</span><strong>{season.status === 'finished' ? 'Complete' : nextOpponent ?? 'Round in progress'}</strong></div>
          </div>
          <nav className={styles.navigation} aria-label="Demo workspace views">{([['fixtures', 'Fixtures'], ['table', 'League table'], ['matchday', 'Matchday']] as const).map(([item, label]) => <button key={item} className={`${styles.navButton} ${view === item ? styles.navActive : ''}`} aria-pressed={view === item} onClick={() => setView(item)}>{label}</button>)}<span>{season.status === 'finished' ? '38 matchweeks completed' : `Matchweek ${season.roundIndex + 1} / 38`}</span></nav>
          <div className={styles.workspace} aria-busy={busy}>
            {view === 'fixtures' ? <SeasonFixtures key={season.config.id} season={season} busy={disabled || showSetup} onOpenMatchday={() => setView('matchday')} /> : view === 'table' ? <SeasonStandings season={season} /> : <SeasonMatchday season={season} busy={disabled || showSetup} onCommand={command} context="demo" />}
          </div>
        </section>}
      </>}
      <footer className={styles.footer}>Demo progress is saved on this device. Export a demo backup before clearing browser storage or moving to another browser. Real-player database research can resume later.</footer>
    </main>
  </div>;
}
