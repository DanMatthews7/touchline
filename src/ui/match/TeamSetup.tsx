import type { Formation, Player, TeamInstructions } from '../../domain/models';
import { FORMATIONS } from '../../domain/models';
import { FORMATION_SLOTS } from '../../match/prepare';
import styles from './MatchCentre.module.css';

const instructionFields: { key: keyof TeamInstructions; label: string; options: readonly string[] }[] = [
  { key: 'mentality', label: 'Mentality', options: ['defensive', 'balanced', 'attacking'] },
  { key: 'tempo', label: 'Tempo', options: ['slow', 'standard', 'fast'] },
  { key: 'width', label: 'Width', options: ['narrow', 'standard', 'wide'] },
  { key: 'pressingIntensity', label: 'Pressing', options: ['low', 'standard', 'high'] },
  { key: 'defensiveLine', label: 'Defensive line', options: ['deep', 'standard', 'high'] },
];

export function InstructionsForm({ prefix, formation, instructions, onFormation, onInstructions, disabled = false, formationDisabled = false }: {
  prefix: string;
  formation: Formation;
  instructions: TeamInstructions;
  onFormation: (formation: Formation) => void;
  onInstructions: (instructions: TeamInstructions) => void;
  disabled?: boolean;
  formationDisabled?: boolean;
}) {
  return <div className={styles.instructions}>
    <label className={styles.field}>Formation<select aria-label={`${prefix} formation`} value={formation} onChange={event => onFormation(event.target.value as Formation)} disabled={disabled || formationDisabled}>{FORMATIONS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    {instructionFields.map(field => <label className={styles.field} key={field.key}>{field.label}<select aria-label={`${prefix} ${field.label.toLowerCase()}`} value={instructions[field.key]} disabled={disabled} onChange={event => onInstructions({ ...instructions, [field.key]: event.target.value } as TeamInstructions)}>{field.options.map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}
  </div>;
}

export function TeamSetup({ side, catalogue, playerIds, otherPlayerIds, formation, instructions, onPlayers, onFormation, onInstructions, disabled }: {
  side: 'Home' | 'Away';
  catalogue: Player[];
  playerIds: string[];
  otherPlayerIds: string[];
  formation: Formation;
  instructions: TeamInstructions;
  onPlayers: (ids: string[]) => void;
  onFormation: (formation: Formation) => void;
  onInstructions: (instructions: TeamInstructions) => void;
  disabled: boolean;
}) {
  const usedIds = new Set([...playerIds, ...otherPlayerIds]);
  return <section className={styles.panel} aria-label={`${side} exhibition setup`}>
    <header className={styles.panelHead}><h2>{side} selection</h2><span>Temporary exhibition team</span></header>
    <div className={styles.body}>
      <InstructionsForm prefix={`${side} setup`} formation={formation} instructions={instructions} onFormation={onFormation} onInstructions={onInstructions} disabled={disabled} />
      <details className={styles.roster} open>
        <summary>Starting XI & bench · {playerIds.length} players</summary>
        <div className={styles.rosterGrid}>{playerIds.map((playerId, index) => {
          const position = FORMATION_SLOTS[formation][index]?.position;
          const label = index < 11 ? `${side} starting slot ${index + 1} (${position ?? 'unknown'})` : `${side} bench ${index - 10}`;
          return <label className={styles.rosterRow} key={index}><span className={styles.slot}>{index < 11 ? position : `B${index - 10}`}</span><select className={styles.control} aria-label={label} value={playerId} disabled={disabled} onChange={event => onPlayers(playerIds.map((id, slot) => slot === index ? event.target.value : id))}>
            {catalogue.map(player => <option key={player.id} value={player.id} disabled={usedIds.has(player.id) && player.id !== playerId}>{player.name} · {player.positions.join('/') || 'position unrecorded'}</option>)}
          </select></label>;
        })}</div>
      </details>
      <p className={styles.small}>Slot labels are your tactical assignments. Recorded preferred positions appear beside the names; unfamiliar or unrecorded positions reduce role familiarity.</p>
    </div>
  </section>;
}
