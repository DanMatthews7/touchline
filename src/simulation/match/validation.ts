import { ATTRIBUTE_KEYS, type AttributeGroup } from '../../domain/attributes';
import { FORMATIONS, POSITIONS, type Formation, type PlayerRole, type Position } from '../../domain/models';
import { ROLE_DEFINITIONS } from '../../domain/ratings';
import { MATCH_ENGINE_VERSION, type MatchCommand, type MatchConfig, type MatchPlayer, type MatchTeam } from './types';

/** Positions describe the initial XI. Subsequent dismissals may leave a reduced shape. */
export const FORMATION_POSITIONS: Readonly<Record<Formation, readonly Position[]>> = {
  '4-4-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'RM', 'CM', 'CM', 'LM', 'ST', 'ST'],
  '4-3-3': ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'CM', 'CM', 'RW', 'LW', 'ST'],
  '4-2-3-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'DM', 'AM', 'RW', 'LW', 'ST'],
  '4-1-4-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'DM', 'RM', 'CM', 'CM', 'LM', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'RM', 'DM', 'CM', 'CM', 'LM', 'ST', 'ST'],
};

export interface MatchValidationIssue { path: string; message: string }

export class MatchValidationError extends Error {
  constructor(public readonly issues: MatchValidationIssue[]) {
    super(issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'MatchValidationError';
  }
}

type RecordValue = Record<string, unknown>;
const playerKeys = ['id', 'name', 'attributes', 'positions', 'initialCondition', 'initialMorale'];
const teamKeys = ['id', 'name', 'players', 'lineup', 'benchIds', 'formation', 'instructions'];
const instructionChoices = {
  mentality: ['defensive', 'balanced', 'attacking'],
  tempo: ['slow', 'standard', 'fast'],
  width: ['narrow', 'standard', 'wide'],
  pressingIntensity: ['low', 'standard', 'high'],
  defensiveLine: ['deep', 'standard', 'high'],
} as const;

/** Read descriptors so an untrusted getter cannot run while validating a record. */
function record(value: unknown, path: string, keys: readonly string[], issues: MatchValidationIssue[]): RecordValue | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    issues.push({ path, message: 'Expected a plain record.' });
    return;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    issues.push({ path, message: 'Custom prototypes and inherited fields are not allowed.' });
    return;
  }
  const values: RecordValue = Object.create(null) as RecordValue;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !keys.includes(key)) {
      issues.push({ path: `${path}.${String(key)}`, message: 'Unrecognized field.' });
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      issues.push({ path: `${path}.${key}`, message: 'Expected an enumerable data field.' });
      continue;
    }
    values[key] = descriptor.value as unknown;
  }
  for (const key of keys) {
    if (!Object.hasOwn(values, key)) issues.push({ path: `${path}.${key}`, message: 'Required field is missing.' });
  }
  return values;
}

function array(value: unknown, path: string, min: number, max: number, issues: MatchValidationIssue[]): unknown[] | undefined {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    issues.push({ path, message: 'Expected a plain array.' });
    return;
  }
  const length: number = Object.getOwnPropertyDescriptor(value, 'length')!.value as number;
  if (length < min || length > max) {
    issues.push({ path, message: `Expected ${min === max ? min : `${min}–${max}`} entries.` });
    return;
  }
  const items: unknown[] = [];
  for (const key of Reflect.ownKeys(value)) {
    if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) {
      issues.push({ path: `${path}.${String(key)}`, message: 'Unrecognized array field.' });
    }
  }
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      issues.push({ path: `${path}[${index}]`, message: 'Expected a present data entry.' });
      items.push(undefined);
    } else items.push(descriptor.value as unknown);
  }
  return items;
}

function identifier(value: unknown, path: string, issues: MatchValidationIssue[]): void {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    issues.push({ path, message: 'Expected a stable identifier of 1–128 letters, digits, dots, colons, underscores or hyphens.' });
  }
}

function name(value: unknown, path: string, issues: MatchValidationIssue[]): void {
  if (typeof value !== 'string' || value.length > 240 || !/\S/.test(value) || /[\u0000-\u001f\u007f]/.test(value)) {
    issues.push({ path, message: 'Expected nonblank text of at most 240 characters, without control characters.' });
  }
}

function number(value: unknown, path: string, min: number, max: number, issues: MatchValidationIssue[], integer = false): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    issues.push({ path, message: `Expected a finite ${integer ? 'integer ' : ''}number from ${min} to ${max}.` });
  }
}

function choice(value: unknown, path: string, choices: readonly string[], issues: MatchValidationIssue[]): void {
  if (typeof value !== 'string' || !choices.includes(value)) issues.push({ path, message: `Expected one of: ${choices.join(', ')}.` });
}

function attributes(value: unknown, path: string, issues: MatchValidationIssue[]): RecordValue | undefined {
  const groups = record(value, path, Object.keys(ATTRIBUTE_KEYS), issues);
  if (!groups) return;
  for (const group of Object.keys(ATTRIBUTE_KEYS) as AttributeGroup[]) {
    const values = record(groups[group], `${path}.${group}`, ATTRIBUTE_KEYS[group], issues);
    if (!values) continue;
    for (const key of ATTRIBUTE_KEYS[group]) number(values[key], `${path}.${group}.${key}`, 1, 20, issues, true);
    groups[group] = values;
  }
  return groups;
}

function player(value: unknown, path: string, issues: MatchValidationIssue[]): RecordValue | undefined {
  const fields = record(value, path, playerKeys, issues);
  if (!fields) return;
  identifier(fields.id, `${path}.id`, issues);
  name(fields.name, `${path}.name`, issues);
  fields.attributes = attributes(fields.attributes, `${path}.attributes`, issues);
  const positions = array(fields.positions, `${path}.positions`, 0, POSITIONS.length, issues);
  positions?.forEach((position, index) => choice(position, `${path}.positions[${index}]`, POSITIONS, issues));
  if (positions && new Set(positions).size !== positions.length) issues.push({ path: `${path}.positions`, message: 'Positions must be unique.' });
  number(fields.initialCondition, `${path}.initialCondition`, 0, 100, issues);
  number(fields.initialMorale, `${path}.initialMorale`, 0, 100, issues);
  fields.positions = positions;
  return fields;
}

function lineup(value: unknown, path: string, initial: boolean, issues: MatchValidationIssue[]): (RecordValue | undefined)[] | undefined {
  return array(value, path, initial ? 11 : 7, 11, issues)?.map((value, index) => {
    const slotPath = `${path}[${index}]`;
    const slot = record(value, slotPath, ['playerId', 'position', 'role'], issues);
    if (!slot) return;
    identifier(slot.playerId, `${slotPath}.playerId`, issues);
    choice(slot.position, `${slotPath}.position`, POSITIONS, issues);
    choice(slot.role, `${slotPath}.role`, Object.keys(ROLE_DEFINITIONS), issues);
    if (typeof slot.role === 'string' && Object.hasOwn(ROLE_DEFINITIONS, slot.role) && typeof slot.position === 'string'
      && !ROLE_DEFINITIONS[slot.role as PlayerRole].positions.includes(slot.position as Position)) {
      issues.push({ path: `${slotPath}.role`, message: 'Role is incompatible with the assigned position.' });
    }
    return slot;
  });
}

function instructions(value: unknown, path: string, issues: MatchValidationIssue[]): RecordValue | undefined {
  const fields = record(value, path, Object.keys(instructionChoices), issues);
  if (fields) {
    for (const key of Object.keys(instructionChoices) as (keyof typeof instructionChoices)[]) {
      choice(fields[key], `${path}.${key}`, instructionChoices[key], issues);
    }
  }
  return fields;
}

function team(value: unknown, path: string, issues: MatchValidationIssue[]): RecordValue | undefined {
  const fields = record(value, path, teamKeys, issues);
  if (!fields) return;
  identifier(fields.id, `${path}.id`, issues);
  name(fields.name, `${path}.name`, issues);
  choice(fields.formation, `${path}.formation`, FORMATIONS, issues);
  fields.players = array(fields.players, `${path}.players`, 11, 20, issues)?.map((value, index) => player(value, `${path}.players[${index}]`, issues));
  const bench = array(fields.benchIds, `${path}.benchIds`, 0, 9, issues);
  bench?.forEach((value, index) => identifier(value, `${path}.benchIds[${index}]`, issues));
  fields.benchIds = bench;
  fields.lineup = lineup(fields.lineup, `${path}.lineup`, true, issues);
  fields.instructions = instructions(fields.instructions, `${path}.instructions`, issues);
  return fields;
}

function relationships(config: MatchConfig, issues: MatchValidationIssue[]): void {
  if (config.home.id === config.away.id) issues.push({ path: 'away.id', message: 'Teams must have distinct identifiers.' });
  const allIds = new Set<string>();
  for (const side of ['home', 'away'] as const) {
    const value = config[side];
    const players = new Map<string, MatchPlayer>();
    for (const [index, valuePlayer] of value.players.entries()) {
      if (allIds.has(valuePlayer.id)) issues.push({ path: `${side}.players[${index}].id`, message: 'Player identifiers must be unique across both teams.' });
      allIds.add(valuePlayer.id);
      players.set(valuePlayer.id, valuePlayer);
    }
    const selectedIds = [...value.lineup.map(slot => slot.playerId), ...value.benchIds];
    if (new Set(selectedIds).size !== selectedIds.length) issues.push({ path: `${side}.lineup`, message: 'A player may appear only once in the XI and bench combined.' });
    selectedIds.forEach((id, index) => {
      if (!players.has(id)) issues.push({ path: index < 11 ? `${side}.lineup[${index}].playerId` : `${side}.benchIds[${index - 11}]`, message: 'Selected player is absent from the team player list.' });
    });
    if (value.players.some(valuePlayer => !selectedIds.includes(valuePlayer.id))) issues.push({ path: `${side}.players`, message: 'The player list must contain exactly the XI and bench.' });
    value.lineup.forEach((slot, index) => {
      if (players.get(slot.playerId)?.initialCondition === 0) issues.push({ path: `${side}.lineup[${index}].playerId`, message: 'A starter must have positive initial condition.' });
    });
    if (value.lineup.filter(slot => slot.position === 'GK').length !== 1) issues.push({ path: `${side}.lineup`, message: 'The XI must contain exactly one goalkeeper.' });
    const positions = value.lineup.map(slot => slot.position).sort();
    if (positions.join(',') !== [...FORMATION_POSITIONS[value.formation]].sort().join(',')) issues.push({ path: `${side}.lineup`, message: `Positions must match the ${value.formation} formation.` });
  }
}

function inspectConfig(input: unknown): { issues: MatchValidationIssue[]; config?: MatchConfig } {
  const issues: MatchValidationIssue[] = [];
  try {
    const fields = record(input, 'config', ['engineVersion', 'id', 'seed', 'home', 'away', 'homeAdvantage', 'assessmentMode'], issues);
    if (!fields) return { issues };
    if (fields.engineVersion !== MATCH_ENGINE_VERSION) issues.push({ path: 'engineVersion', message: `Unsupported engine version; expected ${MATCH_ENGINE_VERSION}.` });
    identifier(fields.id, 'id', issues);
    number(fields.seed, 'seed', 0, 0xffff_ffff, issues, true);
    number(fields.homeAdvantage, 'homeAdvantage', 0, 0.2, issues);
    choice(fields.assessmentMode, 'assessmentMode', ['recorded-attributes', 'uniform-missing-10'], issues);
    fields.home = team(fields.home, 'home', issues);
    fields.away = team(fields.away, 'away', issues);
    // Use descriptor snapshots throughout; never reread an untrusted object after validation.
    const config = fields as unknown as MatchConfig;
    if (issues.length === 0) relationships(config, issues);
    return { issues, config };
  } catch {
    issues.push({ path: 'config', message: 'Input could not be inspected as plain data.' });
  }
  return { issues };
}

/** Validate even callers whose TypeScript assertion concealed malformed runtime data. */
export function validateMatchConfig(config: MatchConfig): MatchValidationIssue[] {
  return inspectConfig(config).issues;
}

function cloneTeam(team: MatchTeam): MatchTeam {
  return {
    ...team,
    players: team.players.map(player => ({ ...player, positions: [...player.positions], attributes: {
      technical: { ...player.attributes.technical }, mental: { ...player.attributes.mental },
      physical: { ...player.attributes.physical }, goalkeeping: { ...player.attributes.goalkeeping },
    } })),
    lineup: team.lineup.map(slot => ({ ...slot })), benchIds: [...team.benchIds], instructions: { ...team.instructions },
  };
}

/** Reject unsupported, incomplete or unsafe scenarios before simulation; never impute ratings. */
export function parseMatchConfig(input: unknown): MatchConfig {
  const { issues, config } = inspectConfig(input);
  if (issues.length > 0) throw new MatchValidationError(issues);
  return { ...config!, home: cloneTeam(config!.home), away: cloneTeam(config!.away) };
}

/** Strict shape validation precedes state-specific eligibility checks in the engine. */
export function parseMatchCommand(input: unknown): MatchCommand {
  const issues: MatchValidationIssue[] = [];
  let parsed: RecordValue | undefined;
  try {
    const typeDescriptor = typeof input === 'object' && input !== null ? Object.getOwnPropertyDescriptor(input, 'type') : undefined;
    const type: unknown = typeDescriptor && 'value' in typeDescriptor ? typeDescriptor.value as unknown : undefined;
    const keys = type === 'ADVANCE' ? ['type'] : type === 'SUBSTITUTE'
      ? ['type', 'team', 'playerOutId', 'playerInId'] : ['type', 'team', 'formation', 'instructions', 'lineup'];
    parsed = record(input, 'command', keys, issues);
    if (parsed) {
      choice(parsed.type, 'command.type', ['ADVANCE', 'SUBSTITUTE', 'CHANGE_TACTICS'], issues);
      if (type !== 'ADVANCE') choice(parsed.team, 'command.team', ['home', 'away'], issues);
      if (type === 'SUBSTITUTE') {
        identifier(parsed.playerOutId, 'command.playerOutId', issues);
        identifier(parsed.playerInId, 'command.playerInId', issues);
      } else if (type === 'CHANGE_TACTICS') {
        choice(parsed.formation, 'command.formation', FORMATIONS, issues);
        parsed.instructions = instructions(parsed.instructions, 'command.instructions', issues);
        parsed.lineup = lineup(parsed.lineup, 'command.lineup', false, issues);
      }
    }
  } catch {
    issues.push({ path: 'command', message: 'Command could not be inspected as plain data.' });
  }
  if (issues.length > 0) throw new MatchValidationError(issues);
  const command = parsed as unknown as MatchCommand;
  if (command.type === 'CHANGE_TACTICS') return { ...command, instructions: { ...command.instructions }, lineup: command.lineup.map(slot => ({ ...slot })) };
  return { ...command };
}
