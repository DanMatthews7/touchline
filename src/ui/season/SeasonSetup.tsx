import { useEffect, useRef, useState } from 'react';
import type { SeasonSetupOptions } from '../../season/prepare';
import type { SeasonRosterReadinessDTO } from '../../season/rosters';
import { readableDate } from '../formatters';
import styles from './SeasonWorkspace.module.css';

function nextWeek(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + 7);
  const result = parsed.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : date;
}

export function SeasonSetup({ readiness, managedClubId, currentDate, busy, onCreate, onImportSquads }: {
  readiness: SeasonRosterReadinessDTO;
  managedClubId: string;
  currentDate: string;
  busy: boolean;
  onCreate: (options: SeasonSetupOptions) => void | Promise<void>;
  onImportSquads?: (file: File) => void | Promise<void>;
}) {
  const importInput = useRef<HTMLInputElement>(null);
  const effectiveStart = currentDate > (readiness.asOfDate ?? currentDate) ? currentDate : (readiness.asOfDate ?? currentDate);
  const [options, setOptions] = useState(() => ({ name: 'League season', firstMatchDate: nextWeek(effectiveStart), seed: 777, useUniformEstimates: false, initialCondition: 100, initialMorale: 70, homeAdvantage: true }));
  useEffect(() => {
    setOptions(previous => previous.firstMatchDate < effectiveStart ? { ...previous, firstMatchDate: nextWeek(effectiveStart) } : previous);
  }, [effectiveStart]);
  const readyClubs = readiness.clubs.filter(club => club.status === 'verified').length;
  const managedPresent = readiness.clubs.some(club => club.clubId === managedClubId);
  const canCreate = readiness.status === 'ready' && readiness.clubs.length === 20 && managedPresent;
  return <>
    <section className={styles.panel} aria-labelledby="season-readiness-title">
      <header className={styles.panelHead}><h2 id="season-readiness-title">Verified roster readiness</h2><span>{readyClubs} / 20 squads ready · {readiness.season}{readiness.asOfDate ? ` · As of ${readableDate(readiness.asOfDate)}` : ''}</span></header>
      <div className={styles.body}>
        {onImportSquads && <div className={styles.actions} style={{ marginBottom: 12 }}><button className={styles.button} type="button" disabled={busy} onClick={() => importInput.current?.click()}>Import squad dataset</button><input className={styles.hidden} ref={importInput} tabIndex={-1} type="file" accept=".json,application/json" aria-label="Import squad dataset file" onChange={event => { const file = event.target.files?.[0]; if (file) void onImportSquads(file); event.target.value = ''; }} /></div>}
        <p className={styles.small} style={{ marginTop: 0 }}>Season creation requires verified current club squads. Club membership and player identities must be sourced before matches can begin; ability estimates remain separate from those facts. Imported verification relies on the supplied source evidence and attestation; the app does not live-check source pages.</p>
        <div className={`${styles.notice} ${styles.sectionGap}`} role="status"><strong>{readiness.status === 'ready' ? 'Roster evidence and validation requirements are satisfied.' : readiness.status === 'checking' ? 'Checking current squad sources…' : 'Verified current rosters are required.'}</strong>{readiness.notes.map((note, index) => <div key={index}>{note}</div>)}{!managedPresent && <div>Your managed club must be included in the verified 20-club database.</div>}</div>
      </div>
      {readiness.clubs.length > 0 ? <div className={styles.tableWrap} role="region" aria-label="Squad readiness table" tabIndex={0}><table className={styles.table}><caption className={styles.hidden}>Current season squad verification status</caption><thead><tr><th scope="col">Club</th><th scope="col" className={styles.numeric}>Verified players</th><th scope="col" className={styles.numeric}>Goalkeepers</th><th scope="col">Source date</th><th scope="col">Readiness</th></tr></thead><tbody>{readiness.clubs.map(club => <tr key={club.clubId} className={club.clubId === managedClubId ? styles.managedRow : ''}><td>{club.clubId === managedClubId && <span className={styles.managedMark} role="img" aria-label="Managed club" />}{club.name}</td><td className={styles.numeric}>{club.verifiedPlayers}</td><td className={styles.numeric}>{club.goalkeepers}</td><td>{club.sourceDate ? readableDate(club.sourceDate) : '—'}</td><td><span className={styles.chip}>{club.status === 'verified' ? 'Verified' : club.status === 'needs-review' ? 'Needs review' : 'Missing roster'}</span>{club.notes.length > 0 && <div className={styles.small}>{club.notes.join(' ')}</div>}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>No verified squad database is loaded. Use Import database to load appropriately sourced current club assignments and their provenance records.</p>}
    </section>
    <form className={`${styles.panel} ${styles.sectionGap}`} onSubmit={event => { event.preventDefault(); if (canCreate && !busy) void onCreate({ ...options, clubIds: readiness.clubs.map(club => club.clubId) }); }}>
      <header className={styles.panelHead}><h2>Season settings</h2><span>20 clubs · 38 matchweeks · 380 fixtures</span></header>
      <div className={styles.body}>
        <div className={styles.fields}>
          <label className={`${styles.field} ${styles.nameField}`}>League name<input aria-label="League name" value={options.name} required maxLength={100} disabled={busy || !canCreate} onChange={event => setOptions(previous => ({ ...previous, name: event.target.value }))} /></label>
          <label className={styles.field}>First matchweek date<input aria-label="First matchweek date" type="date" min={effectiveStart} value={options.firstMatchDate} required disabled={busy || !canCreate} onChange={event => setOptions(previous => ({ ...previous, firstMatchDate: event.target.value }))} /></label>
          <label className={styles.field}>Season seed<input aria-label="Season seed" type="number" min={0} max={4294967295} step={1} required value={options.seed} disabled={busy || !canCreate} onChange={event => setOptions(previous => ({ ...previous, seed: Number(event.target.value) }))} /></label>
          <label className={styles.field}>Condition /100<input aria-label="Season starting condition" type="number" min={0} max={100} step={1} required value={options.initialCondition} disabled={busy || !canCreate} onChange={event => setOptions(previous => ({ ...previous, initialCondition: Number(event.target.value) }))} /></label>
          <label className={styles.field}>Morale /100<input aria-label="Season starting morale" type="number" min={0} max={100} step={1} required value={options.initialMorale} disabled={busy || !canCreate} onChange={event => setOptions(previous => ({ ...previous, initialMorale: Number(event.target.value) }))} /></label>
        </div>
        <label className={`${styles.check} ${styles.assumption}`}><input type="checkbox" checked={options.useUniformEstimates} disabled={busy || !canCreate} onChange={event => setOptions(previous => ({ ...previous, useUniformEstimates: event.target.checked }))} /><span><strong>Use uniform 10/20 estimates for missing ability attributes</strong><br />This opt-in affects original game ratings only. Existing assessments are preserved; squad membership and player identities must already be verified.</span></label>
        <label className={`${styles.check} ${styles.assumption}`}><input type="checkbox" checked={options.homeAdvantage} disabled={busy || !canCreate} onChange={event => setOptions(previous => ({ ...previous, homeAdvantage: event.target.checked }))} />Apply 4% home action advantage</label>
        <p className={styles.small}>Condition, morale, fixtures and results are game state. Calendar progression uses weekly matchdays; each club plays every opponent home and away.</p>
      </div>
      <footer className={styles.setupFooter}><p>{canCreate ? 'The validated roster database will be preserved with this season.' : 'Season creation stays unavailable until verified current roster requirements are met.'}</p><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy || !canCreate}>Create league season</button></footer>
    </form>
  </>;
}
