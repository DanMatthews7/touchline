import { useState } from 'react';
import { ALL_ATTRIBUTE_PATHS, ATTRIBUTE_LABELS } from '../domain/attributes';
import type { DatabaseSnapshot, PlayerRole, VisiblePlayer } from '../domain/models';
import { ROLE_DEFINITIONS, calculateRoleRating, rolesForPlayer } from '../domain/ratings';
import { AttributePanels } from './AttributePanel';
import { ageOnDate, assessedCount, initials, readableDate } from './formatters';
import { Icon } from './Icon';
import styles from './GameShell.module.css';

interface Props {
  player: VisiblePlayer;
  snapshot: DatabaseSnapshot;
  currentDate: string;
  onBack: () => void;
  onEditPlayer?: (playerId: string) => void;
}

export function PlayerProfile({ player, snapshot, currentDate, onBack, onEditPlayer }: Props) {
  const possibleRoles = rolesForPlayer(player);
  const [selectedRole, setSelectedRole] = useState<PlayerRole | null>(null);
  const role = selectedRole ?? possibleRoles[0] ?? 'centralMidfielder';
  const rating = calculateRoleRating(player, role);
  const known = assessedCount(player);
  const assessmentPaths = ALL_ATTRIBUTE_PATHS.filter(path => player.attributeAssessments[path] !== undefined);
  const club = snapshot.clubs.find(item => item.id === player.clubId);
  const age = ageOnDate(player.dateOfBirth, currentDate);
  const ratingExplanation = rating.status === 'assessed'
    ? 'Calculated from original game estimates with position-specific weighting. This is an attribute summary, not a verified real-world rating.'
    : rating.reason === 'unfamiliar-position'
      ? 'This role does not match a recorded preferred position. Role suitability remains unassessed.'
      : `${rating.missingAttributes.length} required attributes are unassessed. A role rating appears only when every required attribute and a matching position are available.`;
  return <>
    <div className={styles.pageHeader}>
      <div className={styles.profileIdentity}>
        <div className={styles.playerPortrait} aria-hidden="true">{initials(player.name)}</div>
        <div><span className={styles.eyebrow}>Player profile / {club?.shortName ?? 'Reference directory'}</span><h1 className={styles.pageTitle}>{player.name}</h1>
          <div className={styles.profileFacts}>
            <span>Position<strong>{player.positions.join(', ') || 'Unknown'}</strong></span>
            <span>Age<strong>{age ?? 'Unknown'}</strong></span>
            <span>Nationality<strong>{player.nationality.join(', ') || 'Unknown'}</strong></span>
            <span>Foot<strong>{player.preferredFoot === 'unknown' ? 'Unknown' : player.preferredFoot}</strong></span>
          </div>
        </div>
      </div>
      <div className={styles.pageActions}>
        <button className={styles.button} onClick={onBack}>Back to squad</button>
        {onEditPlayer && <button className={`${styles.button} ${styles.primaryButton}`} onClick={() => onEditPlayer(player.id)}>Assess attributes</button>}
      </div>
    </div>
    <div className={styles.profileStrip}>
      <label><span className={styles.smallLabel}>Role suitability</span><select className={styles.select} aria-label="Player role" value={role} onChange={event => setSelectedRole(event.target.value as PlayerRole)}>{(Object.keys(ROLE_DEFINITIONS) as PlayerRole[]).map(key => <option key={key} value={key}>{ROLE_DEFINITIONS[key].label}</option>)}</select></label>
      <div className={styles.profileRating} aria-label={rating.rating === null ? 'Role rating unassessed' : `Role rating ${rating.rating} out of 100`}>{rating.rating ?? '—'}{rating.rating !== null && <small>/100</small>}</div>
      <div className={styles.profileStripText}><strong>{known ? 'Original game estimates' : 'Attributes unassessed'}</strong><br />{ratingExplanation}</div>
      <span className={`${styles.chip} ${known === 0 ? styles.mutedChip : ''}`}>{known}/45 assessed</span>
    </div>
    <AttributePanels attributes={player.attributes} />
    <p className={styles.profileFootnote}><strong>Reading the attributes:</strong> 1 is lowest, 20 is highest. — means unassessed; it never becomes an average. Numeric values are original game estimates, separate from sourced biography. Hidden personality and potential remain private.</p>
    {assessmentPaths.length > 0 && <details className={`${styles.panel} ${styles.assessmentDetails} ${styles.sectionGap}`}>
      <summary>Review assessment notes ({assessmentPaths.length})</summary>
      <div className={styles.assessmentNotes}>{assessmentPaths.map(path => {
        const assessment = player.attributeAssessments[path]!;
        return <article key={path} className={styles.assessmentNote}>
          <div className={styles.assessmentNoteHeader}><strong>{ATTRIBUTE_LABELS[path]}</strong><span className={styles.chip}>{assessment.confidence} confidence</span></div>
          <p>{assessment.method}</p>
          <span>{assessment.status === 'editorial-override' ? 'Editorial override' : 'Original estimate'} · Assessed {readableDate(assessment.assessedAt)} · Evidence: {assessment.evidenceSourceIds.length ? assessment.evidenceSourceIds.join(', ') : 'No linked source evidence'}</span>
        </article>;
      })}</div>
    </details>}
    <section className={`${styles.panel} ${styles.sectionGap}`} aria-label="Player provenance">
      <header className={styles.panelHead}><h2 className={styles.panelTitle}>Record & provenance</h2><span className={`${styles.chip} ${styles.mutedChip}`}>{player.dataStatus.completeness === 'complete' ? 'Complete record' : 'Partial reference data'}</span></header>
      <div className={styles.sourceDetails}>
        <span>Club assignment: <strong>{club?.name ?? 'Unknown · no current squad assignment'}</strong><br />Date of birth: {player.dateOfBirth ? readableDate(player.dateOfBirth) : 'Unknown'} · Age calculated on {readableDate(currentDate)}</span>
        <span>{player.provenance.map((source, index) => <span key={`${source.sourceId}-${index}`}>{index > 0 && <br />}<a href={source.url} target="_blank" rel="noreferrer">{source.sourceName} ↗</a> · {source.license.name}<br />Source date: {source.sourceDate ? readableDate(source.sourceDate) : 'Not supplied'} · Accessed {readableDate(source.accessedAt)}</span>)}</span>
      </div>
    </section>
    {player.dataStatus.notes.length > 0 && <p className={styles.profileFootnote}><Icon name="info" className={styles.noticeIcon} style={{ verticalAlign: 'middle', marginRight: 5 }} />{player.dataStatus.notes.join(' ')}</p>}
  </>;
}
