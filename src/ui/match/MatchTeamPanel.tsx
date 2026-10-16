import { useState } from 'react';
import { POSITIONS } from '../../domain/models';
import type { Formation, PlayerRole, Position } from '../../domain/models';
import { FORMATION_SLOTS } from '../../match/prepare';
import { MATCH_RULES } from '../../simulation/match';
import type { MatchCommand, MatchLineupSlot, MatchSide, MatchState } from '../../simulation/match';
import { InstructionsForm } from './TeamSetup';
import styles from './MatchCentre.module.css';

const roleForPosition: Record<Position, PlayerRole> = { GK: 'goalkeeper', RB: 'fullBack', CB: 'centreBack', LB: 'fullBack', DM: 'defensiveMidfielder', CM: 'centralMidfielder', RM: 'wideMidfielder', LM: 'wideMidfielder', AM: 'attackingMidfielder', RW: 'winger', LW: 'winger', ST: 'striker' };

export function MatchTeamPanel({ state, side, busy, onCommand }: { state: MatchState; side: MatchSide; busy: boolean; onCommand: (command: MatchCommand) => Promise<void> }) {
  const config = state.config[side];
  const runtime = state.teams[side];
  const label = side === 'home' ? 'Home' : 'Away';
  const playerById = new Map(config.players.map(player => [player.id, player]));
  const [outId, setOutId] = useState(runtime.lineup.find(slot => slot.position !== 'GK')?.playerId ?? runtime.lineup[0]?.playerId ?? '');
  const [inId, setInId] = useState(runtime.benchIds.find(id => !playerById.get(id)?.positions.includes('GK')) ?? runtime.benchIds[0] ?? '');
  const [formation, setFormation] = useState(runtime.formation);
  const [instructions, setInstructions] = useState(runtime.instructions);
  const [lineup, setLineup] = useState<MatchLineupSlot[]>(runtime.lineup.map(slot => ({ ...slot })));
  const ended = state.status === 'finished' || state.status === 'abandoned';
  const disabled = busy || ended;
  const listedIds = new Set([...runtime.lineup.map(slot => slot.playerId), ...runtime.benchIds]);
  const rows = [
    ...runtime.lineup.map(slot => ({ id: slot.playerId, position: slot.position, group: 'XI' })),
    ...runtime.benchIds.map(id => ({ id, position: '—', group: 'Bench' })),
    ...config.players.filter(player => !listedIds.has(player.id)).map(player => ({ id: player.id, position: '—', group: 'Off field' })),
  ];
  function changeFormation(next: Formation) {
    setFormation(next);
    if (lineup.length === 11) setLineup(previous => previous.map((slot, index) => ({ ...slot, ...FORMATION_SLOTS[next][index]! })));
  }
  function swapPlayer(index: number, playerId: string) {
    const other = lineup.findIndex(slot => slot.playerId === playerId);
    if (other < 0) return;
    setLineup(previous => previous.map((slot, slotIndex) => slotIndex === index ? { ...slot, playerId } : slotIndex === other ? { ...slot, playerId: previous[index]!.playerId } : slot));
  }
  return <section className={styles.panel} aria-label={`${label} match squad`}>
    <header className={styles.panelHead}><h2>{config.name}</h2><span>{runtime.formation} · {runtime.substitutionsUsed}/{MATCH_RULES.maxSubstitutions} subs</span></header>
    <div className={styles.tableWrap}><table className={styles.players}>
      <caption className={styles.hidden}>{label} selection condition, morale and match status</caption>
      <thead><tr><th scope="col">Slot</th><th scope="col">Player</th><th scope="col">Cond.</th><th scope="col">Morale</th><th scope="col">Status</th></tr></thead>
      <tbody>{rows.map(row => {
        const current = runtime.players[row.id]!;
        return <tr key={row.id} className={current.dismissed ? styles.dismissed : ''}><td>{row.position}</td><td>{playerById.get(row.id)?.name ?? row.id}</td><td><span className={styles.condition}><span className={styles.conditionTrack} aria-hidden="true"><span style={{ width: `${current.condition}%` }} /></span>{current.condition.toFixed(1)}</span></td><td>{current.morale.toFixed(1)}</td><td>{current.dismissed ? 'Dismissed' : current.yellowCards ? `${row.group} · YC ${current.yellowCards}` : row.group}</td></tr>;
      })}</tbody>
    </table></div>
    <details className={styles.management}>
      <summary>{label} touchline controls</summary>
      <p className={styles.small}>{ended ? 'This match has ended. Its report and archive remain available.' : `Changes are applied at this ${state.minute}′ checkpoint. ${runtime.substitutionWindowsUsed}/${MATCH_RULES.maxSubstitutionWindows} substitution windows used; before kick-off and half-time are free windows.`}</p>
      <div className={styles.managementSection}>
        <h3 className={styles.sectionTitle}>Make a substitution</h3>
        <div className={styles.substitution}>
          <label className={styles.field}>Player off<select value={outId} aria-label={`${label} player off`} onChange={event => setOutId(event.target.value)} disabled={disabled}>{runtime.lineup.map(slot => <option key={slot.playerId} value={slot.playerId}>{playerById.get(slot.playerId)?.name}</option>)}</select></label>
          <label className={styles.field}>Player on<select value={inId} aria-label={`${label} player on`} onChange={event => setInId(event.target.value)} disabled={disabled || runtime.benchIds.length === 0}>{runtime.benchIds.length ? runtime.benchIds.map(id => <option key={id} value={id}>{playerById.get(id)?.name}</option>) : <option value="">No unused substitutes</option>}</select></label>
          <button className={styles.button} disabled={disabled || !outId || !inId || runtime.substitutionsUsed >= MATCH_RULES.maxSubstitutions} onClick={() => void onCommand({ type: 'SUBSTITUTE', team: side, playerOutId: outId, playerInId: inId })}>Confirm {side} substitution</button>
        </div>
      </div>
      <div className={styles.managementSection}>
        <h3 className={styles.sectionTitle}>Tactical instructions</h3>
        <InstructionsForm prefix={`${label} live`} formation={formation} instructions={instructions} onFormation={changeFormation} onInstructions={setInstructions} disabled={disabled} formationDisabled={lineup.length < 11} />
        {lineup.length < 11 && <p className={styles.small}>A dismissal has reduced the XI. Keep the current shape and adjust assignments below, including an emergency goalkeeper if needed.</p>}
        <details className={styles.roster}><summary>Player assignments · {lineup.length} active</summary><div className={styles.rosterGrid}>{lineup.map((slot, index) => <div className={styles.rosterRow} key={index}>
          {lineup.length === 11 ? <span className={styles.slot}>{slot.position}</span> : <select className={styles.control} style={{ width: 58, flex: '0 0 58px' }} aria-label={`${label} live slot ${index + 1} position`} value={slot.position} disabled={disabled} onChange={event => { const position = event.target.value as Position; setLineup(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, position, role: roleForPosition[position] } : item)); }}>{POSITIONS.map(position => <option key={position} value={position}>{position}</option>)}</select>}
          <select className={styles.control} aria-label={`${label} live slot ${index + 1} player`} value={slot.playerId} disabled={disabled} onChange={event => swapPlayer(index, event.target.value)}>{runtime.lineup.map(item => <option key={item.playerId} value={item.playerId}>{playerById.get(item.playerId)?.name}</option>)}</select>
        </div>)}</div></details>
        <div className={styles.tacticsFooter}><span className={styles.small}>Only active players can be reassigned.</span><button className={`${styles.button} ${styles.primary}`} disabled={disabled} onClick={() => void onCommand({ type: 'CHANGE_TACTICS', team: side, formation, instructions, lineup })}>Apply {side} tactics</button></div>
      </div>
    </details>
  </section>;
}
