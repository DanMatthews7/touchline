import { getAttributeValue, type AttributeGroup, type AttributePath } from '../../domain/attributes';
import { FORMATIONS, POSITIONS, type Formation, type TeamInstructions } from '../../domain/models';
import { ROLE_DEFINITIONS } from '../../domain/ratings';
import { initialRandomState, nextRandom } from '../random';
import { FORMATION_POSITIONS, parseMatchCommand, parseMatchConfig } from './validation';
import { MATCH_ENGINE_VERSION, type MatchCommand, type MatchCommandResult, type MatchConfig, type MatchEvent, type MatchLineupSlot, type MatchPlayer, type MatchSide, type MatchState, type MatchTeamState } from './types';

export const MATCH_RULES = { durationMinutes: 90, checkpointMinutes: 15, maxSubstitutions: 5, maxSubstitutionWindows: 3, maxBench: 9 } as const;

/** Original v1 design parameters: action-level inputs, independent of the display role score. */
export const ACTION_WEIGHTS = {
  passing: { 'technical.passing': 5, 'technical.firstTouch': 2, 'mental.decisions': 3, 'mental.teamwork': 2, 'technical.technique': 1 },
  creation: { 'mental.vision': 4, 'technical.dribbling': 3, 'technical.passing': 3, 'technical.crossing': 2, 'mental.offTheBall': 3, 'technical.technique': 2, 'mental.flair': 1 },
  shooting: { 'technical.finishing': 5, 'mental.composure': 4, 'technical.technique': 2, 'mental.anticipation': 2, 'technical.heading': 1, 'physical.balance': 1 },
  defending: { 'technical.tackling': 5, 'technical.marking': 3, 'mental.positioning': 4, 'mental.anticipation': 3, 'mental.concentration': 2, 'physical.strength': 2, 'physical.pace': 1 },
  goalkeeping: { 'goalkeeping.reflexes': 5, 'goalkeeping.handling': 3, 'goalkeeping.oneOnOnes': 3, 'goalkeeping.aerialReach': 2, 'goalkeeping.commandOfArea': 2, 'mental.positioning': 2, 'physical.agility': 2 },
} as const satisfies Record<string, Partial<Record<AttributePath, number>>>;
type Action = keyof typeof ACTION_WEIGHTS;
type CompiledWeight = readonly [group: AttributeGroup, key: string, weight: number];
function compileWeights(weights: Readonly<Partial<Record<AttributePath, number>>>): CompiledWeight[] {
  return (Object.entries(weights) as [AttributePath, number][]).map(([path, weight]) => {
    const [group, key] = path.split('.') as [AttributeGroup, string];
    return [group, key, weight];
  });
}
const COMPILED_ACTION_WEIGHTS = Object.fromEntries(Object.entries(ACTION_WEIGHTS).map(([action, weights]) => [action, compileWeights(weights)])) as Record<Action, CompiledWeight[]>;
const COMPILED_ROLE_WEIGHTS = Object.fromEntries(Object.entries(ROLE_DEFINITIONS).map(([role, definition]) => [role, compileWeights(definition.weights)])) as Record<MatchLineupSlot['role'], CompiledWeight[]>;

/** Each formation allocates emphasis: no formation receives an unconditional total bonus. */
export const FORMATION_EFFECTS: Record<Formation, { attack: number; control: number; defense: number; width: number }> = {
  '4-4-2': { attack: .02, control: -.04, defense: .02, width: 0 },
  '4-3-3': { attack: .08, control: -.02, defense: -.06, width: .08 },
  '4-2-3-1': { attack: .02, control: .04, defense: -.06, width: .03 },
  '4-1-4-1': { attack: -.10, control: .04, defense: .06, width: .02 },
  '3-5-2': { attack: .02, control: .08, defense: -.10, width: -.08 },
};

interface TacticalEffects { attack: number; control: number; defense: number; passing: number; fatigue: number; fouls: number; press: number; spaceBehind: number }
export const TACTICAL_EFFECTS = {
  mentality: {
    defensive: { attack: -.16, control: -.02, defense: .13 }, balanced: { attack: 0, control: 0, defense: 0 }, attacking: { attack: .16, control: .02, defense: -.13 },
  },
  tempo: {
    slow: { passing: .045, attack: -.08, fatigue: .88 }, standard: { passing: 0, attack: 0, fatigue: 1 }, fast: { passing: -.045, attack: .10, fatigue: 1.18 },
  },
  width: {
    narrow: { passing: .025, attack: -.025, defense: .025 }, standard: { passing: 0, attack: 0, defense: 0 }, wide: { passing: -.025, attack: .055, defense: -.045 },
  },
  pressingIntensity: {
    low: { press: -.07, control: -.045, fatigue: .80, fouls: .76 }, standard: { press: 0, control: 0, fatigue: 1, fouls: 1 }, high: { press: .08, control: .045, fatigue: 1.30, fouls: 1.40 },
  },
  defensiveLine: {
    deep: { defense: .045, control: -.045, attack: -.025, spaceBehind: -.06 }, standard: { defense: 0, control: 0, attack: 0, spaceBehind: 0 }, high: { defense: -.025, control: .06, attack: .025, spaceBehind: .10 },
  },
} as const;

function tactics(team: MatchTeamState): TacticalEffects {
  const instructions = team.instructions;
  const mentality = TACTICAL_EFFECTS.mentality[instructions.mentality];
  const tempo = TACTICAL_EFFECTS.tempo[instructions.tempo];
  const width = TACTICAL_EFFECTS.width[instructions.width];
  const pressing = TACTICAL_EFFECTS.pressingIntensity[instructions.pressingIntensity];
  const line = TACTICAL_EFFECTS.defensiveLine[instructions.defensiveLine];
  const formation = FORMATION_EFFECTS[team.formation];
  return {
    attack: 1 + mentality.attack + tempo.attack + width.attack + line.attack + formation.attack,
    control: 1 + mentality.control + pressing.control + line.control + formation.control,
    defense: 1 + mentality.defense + width.defense + line.defense + formation.defense,
    passing: tempo.passing + width.passing,
    fatigue: tempo.fatigue * pressing.fatigue,
    fouls: pressing.fouls,
    press: pressing.press,
    spaceBehind: line.spaceBehind,
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const opposite = (side: MatchSide): MatchSide => side === 'home' ? 'away' : 'home';
const isAbandoned = (state: MatchState): boolean => state.status === 'abandoned';
type EventInput = MatchEvent extends infer E ? E extends MatchEvent ? Omit<E, 'id' | 'minute'> : never : never;

function emit(state: MatchState, event: EventInput): void {
  state.events.push({ ...event, id: state.events.length, minute: state.minute } as MatchEvent);
}
function draw(state: MatchState): number {
  const result = nextRandom(state.randomState);
  state.randomState = result.state;
  return result.value;
}
function record(state: MatchState, side: MatchSide, playerId: string): MatchPlayer {
  return state.config[side].players.find(player => player.id === playerId)!;
}
function attribute(player: MatchPlayer, path: AttributePath): number {
  // Config validation establishes all 45 numbers. No average fallback is allowed.
  return getAttributeValue(player.attributes, path)!;
}

/** Explicit conservative model assumptions, not assertions about an unknown real player's position. */
export function positionalFamiliarity(player: Pick<MatchPlayer, 'positions'>, position: MatchLineupSlot['position']): number {
  if (player.positions.includes(position)) return 1;
  if (player.positions.length === 0) return .85;
  if (position === 'GK' || player.positions.includes('GK')) return .45;
  const families = [['RB', 'LB'], ['CB', 'DM'], ['DM', 'CM', 'AM'], ['RM', 'LM', 'RW', 'LW'], ['AM', 'ST']];
  if (families.some(family => family.includes(position) && player.positions.some(preferred => family.includes(preferred)))) return .90;
  return .72;
}

function skill(state: MatchState, side: MatchSide, slot: MatchLineupSlot, action: Action): number {
  const player = record(state, side, slot.playerId);
  const runtime = state.teams[side].players[slot.playerId]!;
  let total = 0;
  let weight = 0;
  for (const [group, key, importance] of COMPILED_ACTION_WEIGHTS[action]) {
    total += (player.attributes[group] as Record<string, number>)[key]! * importance;
    weight += importance;
  }
  let roleTotal = 0;
  let roleWeight = 0;
  for (const [group, key, importance] of COMPILED_ROLE_WEIGHTS[slot.role]) {
    roleTotal += (player.attributes[group] as Record<string, number>)[key]! * importance;
    roleWeight += importance;
  }
  const roleFit = .85 + .15 * roleTotal / roleWeight / 20;
  const familiarity = positionalFamiliarity(player, slot.position);
  const condition = .45 + .55 * runtime.condition / 100;
  const morale = .85 + .30 * runtime.morale / 100;
  const home = side === 'home' ? 1 + state.config.homeAdvantage : 1;
  // Professional-level baseline competence compresses the input scale before
  // independent possession, creation, shooting and saving contests compound it.
  // The same explicit floor applies to both sides; attributes still set 75% of
  // action competence, before condition, role, familiarity, morale and venue.
  const actionCompetence = .25 + .75 * total / weight / 20;
  return actionCompetence * roleFit * familiarity * condition * morale * home;
}

function teamMetric(state: MatchState, side: MatchSide, action: 'passing' | 'creation' | 'defending'): number {
  const lineup = state.teams[side].lineup.filter(slot => slot.position !== 'GK');
  if (!lineup.length) return 0;
  let total = 0;
  let weights = 0;
  for (const slot of lineup) {
    const positionWeight = action === 'creation' ? attackingWeight(slot.position) : action === 'defending' ? defensiveWeight(slot.position) : ['DM', 'CM', 'AM'].includes(slot.position) ? 2 : 1;
    total += skill(state, side, slot, action) * positionWeight;
    weights += positionWeight;
  }
  const effects = tactics(state.teams[side]);
  const manpower = state.teams[side].lineup.length / 11;
  return total / weights * (action === 'creation' ? effects.attack * manpower : action === 'defending' ? effects.defense * Math.sqrt(manpower) : effects.control * manpower);
}
function attackingWeight(position: MatchLineupSlot['position']): number {
  if (position === 'ST') return 6;
  if (['RW', 'LW', 'AM'].includes(position)) return 4;
  if (['RM', 'LM', 'CM'].includes(position)) return 1.4;
  if (position === 'DM') return .6;
  return position === 'GK' ? .02 : .3;
}
function defensiveWeight(position: MatchLineupSlot['position']): number {
  return ['CB', 'DM'].includes(position) ? 4 : ['RB', 'LB', 'CM'].includes(position) ? 3 : position === 'GK' ? .02 : 1;
}
function pickSlot(state: MatchState, side: MatchSide, purpose: 'pass' | 'attack' | 'defend', excludedId?: string): MatchLineupSlot {
  const candidates = state.teams[side].lineup.filter(slot => slot.playerId !== excludedId);
  const weights = candidates.map(slot => purpose === 'attack' ? attackingWeight(slot.position) : purpose === 'defend' ? defensiveWeight(slot.position) : slot.position === 'GK' ? .15 : ['DM', 'CM', 'AM'].includes(slot.position) ? 3 : 1.5);
  let selection = draw(state) * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < candidates.length; index++) {
    selection -= weights[index]!;
    if (selection <= 0) return candidates[index]!;
  }
  return candidates[candidates.length - 1]!;
}

function dismiss(state: MatchState, side: MatchSide, playerId: string): void {
  state.teams[side].players[playerId]!.dismissed = true;
  state.teams[side].lineup = state.teams[side].lineup.filter(slot => slot.playerId !== playerId);
  if (state.teams[side].lineup.length < 7) {
    state.status = 'abandoned';
    emit(state, { type: 'ABANDONED', team: side, reason: 'fewer-than-seven' });
  }
}
function foul(state: MatchState, defending: MatchSide, defender: MatchLineupSlot, fouledPlayerId: string): void {
  emit(state, { type: 'FOUL', team: defending, playerId: defender.playerId, fouledPlayerId });
  const player = record(state, defending, defender.playerId);
  const aggression = attribute(player, 'mental.aggression') / 20;
  const decisions = attribute(player, 'mental.decisions') / 20;
  if (draw(state) < .002 + aggression * .002) {
    emit(state, { type: 'CARD', team: defending, playerId: defender.playerId, card: 'red' });
    dismiss(state, defending, defender.playerId);
  } else if (draw(state) < .075 + aggression * .075 + (1 - decisions) * .015) {
    const runtime = state.teams[defending].players[defender.playerId]!;
    runtime.yellowCards++;
    const second = runtime.yellowCards === 2;
    emit(state, { type: 'CARD', team: defending, playerId: defender.playerId, card: second ? 'second-yellow' : 'yellow' });
    if (second) dismiss(state, defending, defender.playerId);
  }
}

function shoot(state: MatchState, attacking: MatchSide, creator: MatchLineupSlot, setPiece = false): void {
  const defending = opposite(attacking);
  const shooter = pickSlot(state, attacking, 'attack');
  const keeper = state.teams[defending].lineup.find(slot => slot.position === 'GK') ?? state.teams[defending].lineup[0]!;
  const attack = teamMetric(state, attacking, 'creation');
  const defense = teamMetric(state, defending, 'defending');
  const attackEffects = tactics(state.teams[attacking]);
  const defenseEffects = tactics(state.teams[defending]);
  const pace = attribute(record(state, attacking, shooter.playerId), 'physical.pace') / 20;
  const quality = clamp(.10 + draw(state) * .18 + .20 * (skill(state, attacking, creator, 'creation') - defense) + defenseEffects.spaceBehind * pace + (attackEffects.attack - 1) * .035 + (setPiece ? -.025 : 0), .035, .55);
  emit(state, { type: 'CHANCE', team: attacking, playerId: shooter.playerId, quality });
  const finishing = skill(state, attacking, shooter, 'shooting');
  const goalkeeping = skill(state, defending, keeper, 'goalkeeping') * (keeper.position === 'GK' ? 1 : .45);
  const onTargetProbability = clamp(.35 + .24 * (finishing - .45) + quality * .30, .16, .76);
  const goalProbability = clamp(.205 + quality * .55 + .30 * (finishing - goalkeeping) + .04 * (attack - defense), .06, .78);
  const onTarget = draw(state) < onTargetProbability;
  emit(state, { type: 'SHOT', team: attacking, playerId: shooter.playerId, onTarget, expectedGoals: onTargetProbability * goalProbability });
  if (onTarget) {
    if (draw(state) < goalProbability) {
      emit(state, { type: 'GOAL', team: attacking, playerId: shooter.playerId });
      state.possession = defending;
    } else {
      emit(state, { type: 'SAVE', team: defending, playerId: keeper.playerId, shooterId: shooter.playerId });
      state.possession = defending;
    }
  } else state.possession = defending;
}

function phase(state: MatchState): void {
  // A low-frequency midfield contest prevents unrealistic endless pass chains.
  if (draw(state) < .11) {
    const homeControl = teamMetric(state, 'home', 'passing');
    const awayControl = teamMetric(state, 'away', 'passing');
    state.possession = draw(state) < homeControl / (homeControl + awayControl) ? 'home' : 'away';
  }
  const attacking = state.possession;
  const defending = opposite(attacking);
  emit(state, { type: 'POSSESSION', team: attacking });
  const passer = pickSlot(state, attacking, 'pass');
  const defender = pickSlot(state, defending, 'defend');
  const attackingEffects = tactics(state.teams[attacking]);
  const defendingEffects = tactics(state.teams[defending]);
  const defenderRecord = record(state, defending, defender.playerId);
  const decisions = attribute(defenderRecord, 'mental.decisions') / 20;
  const booked = state.teams[defending].players[defender.playerId]!.yellowCards > 0;
  // A booked player moderates challenges: fewer fouls, with a small duel cost.
  // Lower decisions weaken that caution; a second booking remains possible.
  const caution = booked ? .72 + .20 * (1 - decisions) : 1;
  const foulProbability = .028 * defendingEffects.fouls * (.80 + attribute(defenderRecord, 'mental.aggression') / 40) * (1.1 - decisions / 5) * caution;
  if (draw(state) < foulProbability) {
    foul(state, defending, defender, passer.playerId);
    if (state.status !== 'abandoned' && draw(state) < .11) shoot(state, attacking, passer, true);
    return;
  }
  const recipient = pickSlot(state, attacking, 'pass', passer.playerId);
  const passing = skill(state, attacking, passer, 'passing');
  const defense = skill(state, defending, defender, 'defending');
  const completed = draw(state) < clamp(.78 + .20 * (passing - .45) - .10 * (defense - .45) + attackingEffects.passing - defendingEffects.press * .4, .36, .94);
  emit(state, { type: 'PASS', team: attacking, playerId: passer.playerId, recipientId: recipient.playerId, completed });
  if (!completed) {
    // A misplaced/intercepted pass changes possession without inventing a tackle.
    state.possession = defending;
    return;
  }
  if (draw(state) < .12) {
    const won = draw(state) < clamp(.26 + .42 * (defense - skill(state, attacking, recipient, 'creation')) + defendingEffects.press - (booked ? .025 : 0), .08, .65);
    emit(state, { type: 'TACKLE', team: defending, playerId: defender.playerId, opponentId: recipient.playerId, won });
    if (won) { state.possession = defending; return; }
  }
  const attack = teamMetric(state, attacking, 'creation');
  const defenseMetric = teamMetric(state, defending, 'defending');
  const wideMismatch = Math.max(0, FORMATION_EFFECTS[state.teams[attacking].formation].width - FORMATION_EFFECTS[state.teams[defending].formation].width);
  const chance = clamp(.034 * (.60 + .60 * attack / (defenseMetric + .15)) * (1 + wideMismatch), .008, .105);
  if (draw(state) < chance) shoot(state, attacking, recipient);
}

function fatigue(state: MatchState): void {
  for (const side of ['home', 'away'] as const) {
    const effects = tactics(state.teams[side]);
    for (const slot of state.teams[side].lineup) {
      const player = record(state, side, slot.playerId);
      const runtime = state.teams[side].players[slot.playerId]!;
      const stamina = attribute(player, 'physical.stamina') / 20;
      const fitness = attribute(player, 'physical.naturalFitness') / 20;
      const workRate = attribute(player, 'mental.workRate') / 20;
      const load = (.105 + .13 * (1 - stamina) + .015 * workRate - .015 * fitness) * effects.fatigue * (slot.position === 'GK' ? .4 : 1);
      runtime.condition = Math.max(0, runtime.condition - load);
      emit(state, { type: 'FATIGUE', team: side, playerId: player.id, condition: runtime.condition });
    }
  }
}

function teamState(config: MatchConfig, side: MatchSide): MatchTeamState {
  const team = config[side];
  return {
    lineup: team.lineup.map(slot => ({ ...slot })), benchIds: [...team.benchIds], formation: team.formation, instructions: { ...team.instructions },
    players: Object.fromEntries(team.players.map(player => [player.id, { condition: player.initialCondition, morale: player.initialMorale, yellowCards: 0, dismissed: false }])),
    substitutionsUsed: 0, substitutionWindowsUsed: 0, lastSubstitutionMinute: null,
  };
}
function cloneState(state: MatchState): MatchState {
  const cloneTeam = (team: MatchTeamState): MatchTeamState => ({ ...team, lineup: team.lineup.map(slot => ({ ...slot })), benchIds: [...team.benchIds], instructions: { ...team.instructions }, players: Object.fromEntries(Object.entries(team.players).map(([id, runtime]) => [id, { ...runtime }])) });
  return { ...state, teams: { home: cloneTeam(state.teams.home), away: cloneTeam(state.teams.away) }, events: [...state.events], commands: [...state.commands] };
}

export function createMatch(input: MatchConfig): MatchState {
  const config = parseMatchConfig(input);
  const state: MatchState = { engineVersion: MATCH_ENGINE_VERSION, config, minute: 0, status: 'ready', randomState: initialRandomState(config.seed), possession: 'home', teams: { home: teamState(config, 'home'), away: teamState(config, 'away') }, events: [], commands: [] };
  state.possession = draw(state) < .5 ? 'home' : 'away';
  emit(state, { type: 'KICKOFF', team: state.possession });
  return state;
}

function validInstructions(value: TeamInstructions): boolean {
  return typeof value === 'object' && value !== null && Object.keys(value).length === 5 && Object.entries(TACTICAL_EFFECTS).every(([key, options]) => Object.prototype.hasOwnProperty.call(options, value[key as keyof TeamInstructions]));
}
function validateTacticalLineup(state: MatchState, side: MatchSide, formation: Formation, lineup: MatchLineupSlot[]): string | null {
  const current = state.teams[side].lineup;
  if (!Array.isArray(lineup) || lineup.length !== current.length || new Set(lineup.map(slot => slot.playerId)).size !== current.length || lineup.some(slot => !current.some(active => active.playerId === slot.playerId))) return 'Tactical changes must preserve the current active players; use a substitution command to change personnel.';
  if (lineup.filter(slot => slot.position === 'GK').length !== 1) return 'Nominate exactly one goalkeeper, including an emergency goalkeeper after a dismissal.';
  const available = [...FORMATION_POSITIONS[formation]];
  for (const slot of lineup) {
    if (!slot || !POSITIONS.includes(slot.position) || !Object.prototype.hasOwnProperty.call(ROLE_DEFINITIONS, slot.role) || !ROLE_DEFINITIONS[slot.role].positions.includes(slot.position)) return 'Each slot needs a valid position and compatible role.';
    const index = available.indexOf(slot.position);
    if (index < 0) return 'Positions must fit the selected formation, with missing slots allowed after dismissals.';
    available.splice(index, 1);
  }
  return null;
}

export function applyMatchCommand(state: MatchState, command: MatchCommand): MatchCommandResult {
  const fail = (code: string, message: string): MatchCommandResult => ({ ok: false, state, error: { code, message } });
  if (state.engineVersion !== MATCH_ENGINE_VERSION) return fail('VERSION', 'Unsupported match engine version.');
  if (state.status === 'finished' || state.status === 'abandoned') return fail('MATCH_ENDED', 'This match has ended.');
  try { command = parseMatchCommand(command); }
  catch (error) { return fail('INVALID_COMMAND', error instanceof Error ? error.message : 'Invalid match command.'); }
  if (state.minute % MATCH_RULES.checkpointMinutes !== 0) return fail('NOT_CHECKPOINT', 'Changes are allowed only at a match checkpoint.');
  if (command.type !== 'ADVANCE' && !['home', 'away'].includes(command.team)) return fail('INVALID_TEAM', 'Choose home or away.');
  const next = cloneState(state);
  if (command.type === 'ADVANCE') {
    next.commands.push({ type: 'ADVANCE' });
    next.status = 'paused';
    const target = Math.min(MATCH_RULES.durationMinutes, next.minute + MATCH_RULES.checkpointMinutes);
    while (next.minute < target && !isAbandoned(next)) {
      next.minute++;
      for (let index = 0; index < 8 && !isAbandoned(next); index++) phase(next);
      if (!isAbandoned(next)) fatigue(next);
    }
    if (!isAbandoned(next)) {
      if (next.minute === MATCH_RULES.durationMinutes) { next.status = 'finished'; emit(next, { type: 'FULL_TIME' }); }
      else emit(next, { type: 'CHECKPOINT' });
    }
    return { ok: true, state: next };
  }
  const team = next.teams[command.team];
  if (command.type === 'SUBSTITUTE') {
    const outgoing = team.lineup.find(slot => slot.playerId === command.playerOutId);
    if (!outgoing || team.players[command.playerOutId]?.dismissed) return fail('INVALID_OUTGOING', 'Only an active player can be substituted; dismissed players cannot be replaced.');
    if (!team.benchIds.includes(command.playerInId) || team.players[command.playerInId]?.dismissed) return fail('INVALID_INCOMING', 'Choose an unused, eligible substitute.');
    if (team.players[command.playerInId]!.condition <= 0) return fail('UNFIT_SUBSTITUTE', 'A player with zero condition cannot enter the match.');
    if (team.substitutionsUsed >= MATCH_RULES.maxSubstitutions) return fail('SUBSTITUTION_LIMIT', 'At most five players may be substituted.');
    const freeWindow = next.minute === 0 || next.minute === 45;
    const newWindow = !freeWindow && team.lastSubstitutionMinute !== next.minute;
    if (newWindow && team.substitutionWindowsUsed >= MATCH_RULES.maxSubstitutionWindows) return fail('SUBSTITUTION_WINDOWS', 'At most three in-play substitution windows are allowed.');
    outgoing.playerId = command.playerInId;
    team.benchIds = team.benchIds.filter(id => id !== command.playerInId);
    team.substitutionsUsed++;
    if (newWindow) team.substitutionWindowsUsed++;
    team.lastSubstitutionMinute = next.minute;
    next.commands.push({ ...command });
    emit(next, { type: 'SUBSTITUTION', team: command.team, playerOutId: command.playerOutId, playerInId: command.playerInId });
    return { ok: true, state: next };
  }
  if (!FORMATIONS.includes(command.formation) || !validInstructions(command.instructions)) return fail('INVALID_TACTICS', 'Choose a supported formation and all five valid team instructions.');
  const lineupError = validateTacticalLineup(next, command.team, command.formation, command.lineup);
  if (lineupError) return fail('INVALID_LINEUP', lineupError);
  team.formation = command.formation;
  team.instructions = { ...command.instructions };
  team.lineup = command.lineup.map(slot => ({ ...slot }));
  next.commands.push({ ...command, instructions: { ...command.instructions }, lineup: command.lineup.map(slot => ({ ...slot })) });
  emit(next, { type: 'TACTICS_CHANGED', team: command.team, formation: command.formation, instructions: { ...command.instructions } });
  return { ok: true, state: next };
}

export function replayMatch(config: MatchConfig, commands: readonly MatchCommand[]): MatchState {
  let state = createMatch(config);
  for (const command of commands) {
    const result = applyMatchCommand(state, command);
    if (!result.ok) throw new Error(`Cannot replay ${command.type}: ${result.error.code}: ${result.error.message}`);
    state = result.state;
  }
  return state;
}
