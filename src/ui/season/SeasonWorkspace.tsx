import { useRef } from 'react';
import type { Club } from '../../domain/models';
import type { SeasonSetupOptions } from '../../season/prepare';
import type { SeasonRosterReadinessDTO } from '../../season/rosters';
import type { SeasonCommand, SeasonState } from '../../simulation/season';
import { readableDate } from '../formatters';
import { SeasonFixtures } from './SeasonFixtures';
import { SeasonMatchday } from './SeasonMatchday';
import { SeasonSetup } from './SeasonSetup';
import { SeasonStandings } from './SeasonStandings';
import styles from './SeasonWorkspace.module.css';

export interface SeasonWorkspaceProps {
  view: 'fixtures' | 'competitions' | 'matchday';
  season: SeasonState | null;
  clubs: Club[];
  managedClubId: string;
  currentDate: string;
  readiness: SeasonRosterReadinessDTO;
  opening: boolean;
  busy: boolean;
  notice?: { kind: 'success' | 'error' | 'info'; text: string } | null;
  onCreate: (options: SeasonSetupOptions) => void | Promise<void>;
  onCommand: (command: SeasonCommand) => void | Promise<void>;
  onExport: () => void | Promise<void>;
  onImport: (file: File) => void | Promise<void>;
  onRestore: () => void | Promise<void>;
  onImportSquads?: (file: File) => void | Promise<void>;
  onOpenMatchday?: () => void;
}

/** A presentation of one shared season controller; this view owns no season repository or engine state. */
export function SeasonWorkspace({ view, season, managedClubId, currentDate, readiness, opening, busy, notice, onCreate, onCommand, onExport, onImport, onRestore, onImportSquads, onOpenMatchday }: SeasonWorkspaceProps) {
  const input = useRef<HTMLInputElement>(null);
  const disabled = opening || busy;
  const title = !season ? 'Season preparation' : view === 'competitions' ? 'Competitions' : view === 'fixtures' ? 'Fixtures & results' : 'League Matchday';
  const managedName = season?.config.teams.find(team => team.id === season.config.managedClubId)?.name;
  return <section className={styles.workspace} aria-label="League season workspace">
    <div className={styles.heading}><div><span className={styles.eyebrow}>Milestone 03 / league & calendar</span><h1 className={styles.title}>{title}</h1><p className={styles.subtitle}>{season ? `${season.config.name} · ${managedName ?? 'Managed club'}` : 'Verified current squads are the foundation of a playable season.'}</p></div><div className={styles.actions}>
      <button className={styles.button} disabled={disabled} onClick={() => input.current?.click()}>Import season backup</button><input className={styles.hidden} ref={input} tabIndex={-1} type="file" accept=".json,application/json" aria-label="Import season backup file" onChange={event => { const file = event.target.files?.[0]; if (file) void onImport(file); event.target.value = ''; }} />
      <button className={styles.button} disabled={disabled} onClick={() => void onRestore()}>Restore season</button>
      {season && <button className={styles.button} disabled={disabled} onClick={() => void onExport()}>Export season backup</button>}
    </div></div>
    {notice && <div className={`${styles.notice} ${notice.kind === 'error' ? styles.error : notice.kind === 'success' ? styles.success : ''}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</div>}
    {opening ? <p className={styles.empty} role="status">Opening the season workspace…</p> : !season ? <SeasonSetup readiness={readiness} managedClubId={managedClubId} currentDate={currentDate} busy={disabled} onCreate={onCreate} onImportSquads={onImportSquads} /> : <>
      <div className={styles.summaryStrip} aria-label="Season progress"><div className={styles.summaryCell}><span className={styles.summaryLabel}>Calendar date</span><strong className={styles.summaryValue}>{readableDate(season.currentDate)}</strong></div><div className={styles.summaryCell}><span className={styles.summaryLabel}>Rounds committed</span><strong className={styles.summaryValue}>{season.roundIndex} / 38</strong></div><div className={styles.summaryCell}><span className={styles.summaryLabel}>Full-time results</span><strong className={styles.summaryValue}>{season.results.length} / {season.fixtures.length}</strong></div><div className={styles.summaryCell}><span className={styles.summaryLabel}>Game ability inputs</span><strong className={styles.summaryValue}>{season.config.assessmentMode === 'uniform-missing-10' ? 'Missing values: 10/20' : 'Recorded assessments'}</strong></div></div>
      {view === 'competitions' ? <SeasonStandings season={season} /> : view === 'fixtures' ? <SeasonFixtures season={season} busy={disabled} onOpenMatchday={onOpenMatchday} /> : <SeasonMatchday season={season} busy={disabled} onCommand={onCommand} />}
      <p className={styles.small}>The league schedule and results are simulated game records. Season backups retain the roster snapshot, initial conditions and accepted commands; your separate exhibition archive remains available.</p>
    </>}
  </section>;
}

export default SeasonWorkspace;
