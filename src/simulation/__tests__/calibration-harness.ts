/** SYNTHETIC AUTOMATED TESTS ONLY. CLI/test entry points only; never import into application UI. */
import { MATCH_ENGINE_VERSION, applyMatchCommand, createMatch, getMatchSummary, type MatchCommand, type MatchConfig, type MatchSide, type MatchState, type MatchStats, type MatchTeamState } from '../match';
import { estimateMean, estimateRate, pairedDifference, type AcceptanceOutcome, type MeanEstimate } from './calibration-statistics';
import { SYNTHETIC_FIXTURE_NOTICE, syntheticMatchConfig, type SyntheticTeamOptions } from './match-fixtures';

export const DEFAULT_CALIBRATION_MATCHES = 480;
export const DEFAULT_CALIBRATION_SEED_START = 1729;
export const CALIBRATION_SEED_MULTIPLIER = 0x9e3779b1;

/** Odd multiplication is a uint32 permutation; spread adjacent source indices across RNG states. */
export function calibrationSeed(sourceIndex: number): number {
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex > 0xffff_ffff) throw new Error('Seed source index must fit unsigned 32-bit integers.');
  return Math.imul(sourceIndex, CALIBRATION_SEED_MULTIPLIER) >>> 0;
}

interface Scenario {
  id: string;
  description: string;
  home?: SyntheticTeamOptions;
  away?: SyntheticTeamOptions;
  homeAdvantage?: number;
  substitute?: boolean;
}

/** Predeclared tactical hypotheses, before the spread-seed validation batch. */
const FORMATION_INTENTS: Record<string, { benefit: 'home-xg' | 'possession' | 'suppress-away-xg'; cost: 'away-xg' | 'suppress-home-xg'; description: string }> = {
  'formation-4-3-3': { benefit: 'home-xg', cost: 'away-xg', description: 'Higher home chance output at the cost of higher opposition chance output.' },
  'formation-4-2-3-1': { benefit: 'possession', cost: 'away-xg', description: 'More midfield control at the cost of higher opposition chance output.' },
  'formation-4-1-4-1': { benefit: 'suppress-away-xg', cost: 'suppress-home-xg', description: 'Suppress opposition chance output at the cost of suppressing own chance output.' },
  'formation-3-5-2': { benefit: 'possession', cost: 'away-xg', description: 'More midfield control at the cost of higher opposition chance output.' },
};

export const CALIBRATION_SCENARIOS: readonly Scenario[] = [
  { id: 'baseline', description: 'Equal original skill 12, condition 100, 4-4-2; explicit home advantage 0.04.' },
  { id: 'neutral', description: 'Identical baseline with home advantage disabled.', homeAdvantage: 0 },
  { id: 'strong-home', description: 'Skill 15 at home against skill 9; neutral venue.', home: { skill: 15 }, away: { skill: 9 }, homeAdvantage: 0 },
  { id: 'strong-away', description: 'Skill 15 away against skill 9; neutral venue.', home: { skill: 9 }, away: { skill: 15 }, homeAdvantage: 0 },
  { id: 'moderate-home', description: 'Moderate skill gap: 13 at home against 11; neutral venue.', home: { skill: 13 }, away: { skill: 11 }, homeAdvantage: 0 },
  { id: 'moderate-away', description: 'Moderate skill gap: 13 away against 11; neutral venue.', home: { skill: 11 }, away: { skill: 13 }, homeAdvantage: 0 },
  { id: 'fatigued', description: 'Home starters begin at condition 55; bench remains fresh.', home: { condition: 55 }, homeAdvantage: 0 },
  { id: 'low-stamina', description: 'Home stamina 6; all other ratings and initial condition unchanged.', home: { stamina: 6 }, homeAdvantage: 0 },
  { id: 'high-stamina', description: 'Home stamina 18; all other ratings and initial condition unchanged.', home: { stamina: 18 }, homeAdvantage: 0 },
  { id: 'low-press', description: 'Home pressing low; all other instructions unchanged.', home: { instructions: { pressingIntensity: 'low' } }, homeAdvantage: 0 },
  { id: 'high-press', description: 'Home pressing high; all other instructions unchanged.', home: { instructions: { pressingIntensity: 'high' } }, homeAdvantage: 0 },
  ...(['4-3-3', '4-2-3-1', '4-1-4-1', '3-5-2'] as const).map(formation => ({ id: `formation-${formation}`, description: `Home ${formation}; uniform skills and equal position familiarity isolate formation structure. ${FORMATION_INTENTS[`formation-${formation}`]!.description}`, home: { formation }, homeAdvantage: 0 })),
  { id: 'fresh-substitutes', description: 'Same condition-55 scenario; replace three eligible outfield starters at minute 60.', home: { condition: 55 }, homeAdvantage: 0, substitute: true },
];

interface SideObservation extends MatchStats {
  goals: number;
  activeOutfieldCondition: number;
  lateShots: number;
  lateExpectedGoals: number;
}
interface Observation {
  seed: number;
  home: SideObservation;
  away: SideObservation;
  substitutions: number;
  abandoned: boolean;
}
type Samples = Record<string, Observation[]>;

function command(state: MatchState, next: MatchCommand): MatchState {
  const result = applyMatchCommand(state, next);
  if (!result.ok) throw new Error(`Calibration command rejected (${result.error.code}): ${result.error.message}`);
  return result.state;
}

/** Prefer a defender, midfielder and forward; dismissals must not silently reduce the treatment size. */
export function selectSubstituteOutgoingPlayers(team: Pick<MatchTeamState, 'lineup' | 'players'>): string[] {
  const eligible = team.lineup.filter(slot => slot.position !== 'GK' && !team.players[slot.playerId]?.dismissed);
  const selected: string[] = [];
  for (const roles of [
    ['centreBack', 'fullBack'],
    ['centralMidfielder', 'defensiveMidfielder', 'wideMidfielder', 'attackingMidfielder', 'winger'],
    ['striker'],
  ]) {
    const slot = eligible.find(candidate => roles.includes(candidate.role) && !selected.includes(candidate.playerId));
    if (slot) selected.push(slot.playerId);
  }
  for (const slot of eligible) if (selected.length < 3 && !selected.includes(slot.playerId)) selected.push(slot.playerId);
  return selected;
}

export function substituteFreshPlayers(state: MatchState): MatchState {
  let current = state;
  const planned = selectSubstituteOutgoingPlayers(state.teams.home);
  for (const outgoing of planned) {
    const incoming = current.teams.home.benchIds.find(id => current.teams.home.players[id]!.condition > 0 && !current.teams.home.players[id]!.dismissed && current.config.home.players.find(player => player.id === id)?.positions.some(position => position !== 'GK'));
    if (incoming) current = command(current, { type: 'SUBSTITUTE', team: 'home', playerOutId: outgoing, playerInId: incoming });
  }
  return current;
}

function runOne(config: MatchConfig, substitute: boolean): Observation {
  let state = createMatch(config);
  while (state.status !== 'finished' && state.status !== 'abandoned') {
    if (substitute && state.minute === 60) state = substituteFreshPlayers(state);
    state = command(state, { type: 'ADVANCE' });
  }
  const summary = getMatchSummary(state);
  function sideObservation(side: MatchSide): SideObservation {
    const active = state.teams[side].lineup.filter(slot => slot.position !== 'GK' && !state.teams[side].players[slot.playerId]!.dismissed);
    const lateShots = state.events.filter(event => event.type === 'SHOT' && event.team === side && event.minute > 60);
    return {
      ...summary.stats[side],
      goals: summary.score[side],
      activeOutfieldCondition: active.reduce((sum, slot) => sum + state.teams[side].players[slot.playerId]!.condition, 0) / active.length,
      lateShots: lateShots.length,
      lateExpectedGoals: lateShots.reduce((sum, event) => sum + (event.type === 'SHOT' ? event.expectedGoals : 0), 0),
    };
  }
  return { seed: config.seed, home: sideObservation('home'), away: sideObservation('away'), substitutions: state.teams.home.substitutionsUsed, abandoned: state.status === 'abandoned' };
}

function metric(samples: readonly Observation[], read: (sample: Observation) => number): MeanEstimate {
  return estimateMean(samples.map(read));
}
function compare(samples: Samples, first: string, second: string, read: (sample: Observation) => number): MeanEstimate {
  const firstSamples = samples[first]!;
  const secondSamples = samples[second]!;
  if (firstSamples.some((sample, index) => sample.seed !== secondSamples[index]?.seed)) throw new Error('Scenario seeds are not aligned.');
  return pairedDifference(firstSamples.map(read), secondSamples.map(read));
}

function scenarioMetrics(samples: readonly Observation[]) {
  const homeWins = samples.filter(sample => sample.home.goals > sample.away.goals).length;
  const draws = samples.filter(sample => sample.home.goals === sample.away.goals).length;
  const histogram: Record<string, number> = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [String(index), 0]));
  histogram['7+'] = 0;
  for (const sample of samples) {
    const goals = sample.home.goals + sample.away.goals;
    const bucket = goals <= 6 ? String(goals) : '7+';
    histogram[bucket] = (histogram[bucket] ?? 0) + 1;
  }
  const sideMetrics = (side: MatchSide) => ({
    goals: metric(samples, sample => sample[side].goals),
    shots: metric(samples, sample => sample[side].shots),
    shotsOnTarget: metric(samples, sample => sample[side].shotsOnTarget),
    expectedGoals: metric(samples, sample => sample[side].expectedGoals),
    possession: metric(samples, sample => sample[side].possession),
    passesAttempted: metric(samples, sample => sample[side].passesAttempted),
    passesCompleted: metric(samples, sample => sample[side].passesCompleted),
    passCompletionRate: metric(samples, sample => sample[side].passesAttempted === 0 ? 0 : sample[side].passesCompleted / sample[side].passesAttempted),
    tacklesAttempted: metric(samples, sample => sample[side].tacklesAttempted),
    tacklesWon: metric(samples, sample => sample[side].tacklesWon),
    chances: metric(samples, sample => sample[side].chances),
    saves: metric(samples, sample => sample[side].saves),
    fouls: metric(samples, sample => sample[side].fouls),
    yellowCards: metric(samples, sample => sample[side].yellowCards),
    redCards: metric(samples, sample => sample[side].redCards),
    finalActiveOutfieldCondition: metric(samples, sample => sample[side].activeOutfieldCondition),
    lateShots: metric(samples, sample => sample[side].lateShots),
    lateExpectedGoals: metric(samples, sample => sample[side].lateExpectedGoals),
  });
  return {
    matches: samples.length,
    totalGoals: metric(samples, sample => sample.home.goals + sample.away.goals),
    totalGoalHistogram: histogram,
    goalsZeroThroughSix: estimateRate(samples.filter(sample => sample.home.goals + sample.away.goals <= 6).length, samples.length),
    homeWin: estimateRate(homeWins, samples.length), draw: estimateRate(draws, samples.length), awayWin: estimateRate(samples.length - homeWins - draws, samples.length),
    totalFouls: metric(samples, sample => sample.home.fouls + sample.away.fouls),
    totalYellowCards: metric(samples, sample => sample.home.yellowCards + sample.away.yellowCards),
    totalRedCards: metric(samples, sample => sample.home.redCards + sample.away.redCards),
    abandoned: estimateRate(samples.filter(sample => sample.abandoned).length, samples.length),
    substitutions: metric(samples, sample => sample.substitutions),
    home: sideMetrics('home'), away: sideMetrics('away'),
  };
}

function balancedStrength(samples: Samples, homeId: string, awayId: string) {
  const home = samples[homeId]!;
  const away = samples[awayId]!;
  const seedGoalMargins = home.map((sample, index) => (sample.home.goals - sample.away.goals + away[index]!.away.goals - away[index]!.home.goals) / 2);
  const seedWinRates = home.map((sample, index) => (Number(sample.home.goals > sample.away.goals) + Number(away[index]!.away.goals > away[index]!.home.goals)) / 2);
  const wins = estimateMean(seedWinRates);
  // Both orientations share a seed. Use one block per seed, rather than treating paired matches as independent trials.
  return {
    goalAdvantage: estimateMean(seedGoalMargins),
    win: { rate: wins.mean, occurrences: seedWinRates.reduce((sum, value) => sum + 2 * value, 0), matches: 2 * home.length, pairedSeedBlocks: home.length, standardError: wins.standardError, confidence95: { lower: Math.max(0, wins.confidence95.lower), upper: Math.min(1, wins.confidence95.upper) } },
  };
}

function assess(samples: Samples) {
  const baseline = scenarioMetrics(samples.baseline!);
  const neutral = samples.neutral!;
  const homeEdge = compare(samples, 'baseline', 'neutral', sample => sample.home.expectedGoals - sample.away.expectedGoals);
  const homeGoalEdge = compare(samples, 'baseline', 'neutral', sample => sample.home.goals - sample.away.goals);
  const strong = balancedStrength(samples, 'strong-home', 'strong-away');
  const strongGoalAdvantage = strong.goalAdvantage;
  const strongWin = strong.win;
  const moderate = balancedStrength(samples, 'moderate-home', 'moderate-away');
  const fatiguePenalty = compare(samples, 'neutral', 'fatigued', sample => sample.home.expectedGoals - sample.away.expectedGoals);
  const fatigueGoalPenalty = compare(samples, 'neutral', 'fatigued', sample => sample.home.goals - sample.away.goals);
  const staminaRetention = compare(samples, 'high-stamina', 'low-stamina', sample => sample.home.activeOutfieldCondition);
  const pressConditionCost = compare(samples, 'low-press', 'high-press', sample => sample.home.activeOutfieldCondition);
  const pressFoulCost = compare(samples, 'high-press', 'low-press', sample => sample.home.fouls);
  const pressTackles = compare(samples, 'high-press', 'low-press', sample => sample.home.tacklesWon);
  const pressPossession = compare(samples, 'high-press', 'low-press', sample => sample.home.possession);
  const substituteFreshness = compare(samples, 'fresh-substitutes', 'fatigued', sample => sample.home.activeOutfieldCondition);
  const substituteLateExpectedGoals = compare(samples, 'fresh-substitutes', 'fatigued', sample => sample.home.lateExpectedGoals - sample.away.lateExpectedGoals);
  const formationComparisons = CALIBRATION_SCENARIOS.filter(scenario => scenario.id.startsWith('formation-')).map(scenario => {
    const intent = FORMATION_INTENTS[scenario.id]!;
    const homeExpectedGoals = compare(samples, scenario.id, 'neutral', sample => sample.home.expectedGoals);
    const awayExpectedGoals = compare(samples, scenario.id, 'neutral', sample => sample.away.expectedGoals);
    const possession = compare(samples, scenario.id, 'neutral', sample => sample.home.possession);
    const benefit = intent.benefit === 'home-xg' ? homeExpectedGoals : intent.benefit === 'possession' ? possession : compare(samples, 'neutral', scenario.id, sample => sample.away.expectedGoals);
    const cost = intent.cost === 'away-xg' ? awayExpectedGoals : compare(samples, 'neutral', scenario.id, sample => sample.home.expectedGoals);
    return {
      id: scenario.id, intent, benefit, cost,
      shots: compare(samples, scenario.id, 'neutral', sample => sample.home.shots - sample.away.shots),
      expectedGoals: compare(samples, scenario.id, 'neutral', sample => sample.home.expectedGoals - sample.away.expectedGoals),
      homeShots: compare(samples, scenario.id, 'neutral', sample => sample.home.shots),
      awayShots: compare(samples, scenario.id, 'neutral', sample => sample.away.shots),
      totalShots: compare(samples, scenario.id, 'neutral', sample => sample.home.shots + sample.away.shots),
      homeExpectedGoals, awayExpectedGoals,
      totalExpectedGoals: compare(samples, scenario.id, 'neutral', sample => sample.home.expectedGoals + sample.away.expectedGoals),
      possession,
      win: estimateRate(samples[scenario.id]!.filter(sample => sample.home.goals > sample.away.goals).length, neutral.length),
      loss: estimateRate(samples[scenario.id]!.filter(sample => sample.home.goals < sample.away.goals).length, neutral.length),
    };
  });
  const outcomes: AcceptanceOutcome[] = [];
  const add = (id: string, passed: boolean, target: string, observed: Record<string, number>) => outcomes.push({ id, passed, target, observed });
  add('baseline-scoring', baseline.totalGoals.mean >= 2 && baseline.totalGoals.mean <= 4.5 && baseline.goalsZeroThroughSix.rate >= 0.85 && baseline.totalGoals.standardDeviation >= 1,
    'Mean total goals 2–4.5; at least 85% of matches total 0–6 goals; goal standard deviation at least 1. These are broad original design targets.',
    { meanGoals: baseline.totalGoals.mean, zeroThroughSix: baseline.goalsZeroThroughSix.rate, standardDeviation: baseline.totalGoals.standardDeviation });
  add('baseline-results-variety', baseline.draw.rate >= 0.1 && baseline.draw.rate <= 0.4 && baseline.homeWin.rate > 0.2 && baseline.awayWin.rate > 0.15,
    'Draw rate 10–40%; both home and away can win (home >20%, away >15%).', { drawRate: baseline.draw.rate, homeWinRate: baseline.homeWin.rate, awayWinRate: baseline.awayWin.rate });
  add('discipline', baseline.totalFouls.mean >= 5 && baseline.totalFouls.mean <= 40 && baseline.totalYellowCards.mean >= 0.2 && baseline.totalYellowCards.mean <= 8 && baseline.totalRedCards.mean <= 0.3 && baseline.abandoned.rate <= 0.005,
    'Mean total fouls 5–40, yellow cards 0.2–8, red cards ≤0.3; abandonments ≤0.5%.', { fouls: baseline.totalFouls.mean, yellows: baseline.totalYellowCards.mean, reds: baseline.totalRedCards.mean, abandonments: baseline.abandoned.rate });
  add('home-advantage', homeEdge.mean >= 0.05 && homeEdge.confidence95.lower > 0,
    'Enabling home advantage 0.04 increases the home expected-goal margin by at least 0.05; paired 95% interval excludes zero.', { expectedGoalMarginChange: homeEdge.mean, lower95: homeEdge.confidence95.lower, goalMarginChange: homeGoalEdge.mean });
  add('relative-strength', strongGoalAdvantage.mean >= 0.6 && strongGoalAdvantage.confidence95.lower > 0 && strongWin.rate >= 0.58 && strongWin.confidence95.lower > 0.5,
    'Skill 15 versus 9, balanced across home/away at a neutral venue: goal margin ≥0.6 and win rate ≥58%; seed-block 95% intervals exclude zero goal edge and 50% wins.', { goalAdvantage: strongGoalAdvantage.mean, goalLower95: strongGoalAdvantage.confidence95.lower, winRate: strongWin.rate, winLower95: strongWin.confidence95.lower });
  add('moderate-strength', moderate.goalAdvantage.mean >= 0.3 && moderate.goalAdvantage.confidence95.lower > 0 && moderate.win.rate >= 0.52 && moderate.win.confidence95.lower > 0.5,
    'Skill 13 versus 11, balanced across home/away at a neutral venue: goal margin ≥0.3 and win rate ≥52%; seed-block 95% intervals exclude zero goal edge and 50% wins.', { goalAdvantage: moderate.goalAdvantage.mean, goalLower95: moderate.goalAdvantage.confidence95.lower, winRate: moderate.win.rate, winLower95: moderate.win.confidence95.lower });
  add('condition-affects-performance', fatiguePenalty.mean >= 0.2 && fatiguePenalty.confidence95.lower > 0,
    'Starting condition 55 versus 100 reduces expected-goal margin by at least 0.2; paired 95% interval excludes zero.', { expectedGoalPenalty: fatiguePenalty.mean, lower95: fatiguePenalty.confidence95.lower, goalPenalty: fatigueGoalPenalty.mean });
  add('stamina-retains-condition', staminaRetention.mean >= 3 && staminaRetention.confidence95.lower >= 3,
    'Stamina 18 versus 6 retains at least three final outfield condition points; paired lower 95% bound ≥3.', { conditionRetained: staminaRetention.mean, lower95: staminaRetention.confidence95.lower });
  add('pressing-tradeoff', pressConditionCost.mean >= 2 && pressConditionCost.confidence95.lower > 0 && pressFoulCost.mean >= 0.3 && pressFoulCost.confidence95.lower > 0 && ((pressTackles.mean >= 0.5 && pressTackles.confidence95.lower > 0) || (pressPossession.mean >= 1 && pressPossession.confidence95.lower > 0)),
    'High versus low press costs ≥2 condition and ≥0.3 fouls, with increased tackles won (≥0.5) or possession (≥1 percentage point); paired 95% intervals exclude zero.',
    { conditionCost: pressConditionCost.mean, conditionLower95: pressConditionCost.confidence95.lower, foulCost: pressFoulCost.mean, foulLower95: pressFoulCost.confidence95.lower, tacklesWonChange: pressTackles.mean, possessionChange: pressPossession.mean });
  for (const formation of formationComparisons) {
    // Both sides and totals matter: a defensive shape can reduce both teams' chances without changing the margin.
    const excludesZero = (estimate: MeanEstimate) => estimate.confidence95.lower * estimate.confidence95.upper > 0;
    const measurable = [formation.homeShots, formation.awayShots, formation.totalShots].some(estimate => Math.abs(estimate.mean) >= 0.4 && excludesZero(estimate))
      || [formation.homeExpectedGoals, formation.awayExpectedGoals, formation.totalExpectedGoals].some(estimate => Math.abs(estimate.mean) >= 0.1 && excludesZero(estimate))
      || (Math.abs(formation.possession.mean) >= 1 && formation.possession.confidence95.lower * formation.possession.confidence95.upper > 0);
    add(formation.id, measurable && formation.benefit.confidence95.lower > 0 && formation.cost.confidence95.lower > 0 && formation.win.rate >= 0.15 && formation.win.rate <= 0.7 && formation.loss.rate >= 0.15,
      `${formation.intent.description} Both predeclared benefit and cost require paired lower 95% bounds above zero. At least one own/opponent/total action metric changes by ≥0.4 shots or ≥0.1 expected goals, or possession by ≥1 percentage point, with paired 95% interval excluding zero. Win rate 15–70% and loss rate ≥15%.`,
      { ownShotsChange: formation.homeShots.mean, opponentShotsChange: formation.awayShots.mean, totalShotsChange: formation.totalShots.mean, ownExpectedGoalsChange: formation.homeExpectedGoals.mean, opponentExpectedGoalsChange: formation.awayExpectedGoals.mean, totalExpectedGoalsChange: formation.totalExpectedGoals.mean, possessionChange: formation.possession.mean, benefitLower95: formation.benefit.confidence95.lower, costLower95: formation.cost.confidence95.lower, winRate: formation.win.rate, lossRate: formation.loss.rate });
  }
  add('substitute-freshness', substituteFreshness.mean >= 5 && substituteFreshness.confidence95.lower >= 5 && substituteLateExpectedGoals.mean >= 0.05 && substituteLateExpectedGoals.confidence95.lower > 0,
    'Three fresh minute-60 substitutes in the condition-55 scenario add ≥5 active outfield condition points and ≥0.05 late expected-goal margin; paired 95% intervals support both effects.',
    { conditionGain: substituteFreshness.mean, conditionLower95: substituteFreshness.confidence95.lower, lateExpectedGoalMarginGain: substituteLateExpectedGoals.mean, lateExpectedGoalLower95: substituteLateExpectedGoals.confidence95.lower });
  return {
    outcomes,
    comparisons: { homeEdge, homeGoalEdge, strongGoalAdvantage, strongWin, moderateGoalAdvantage: moderate.goalAdvantage, moderateWin: moderate.win, fatiguePenalty, fatigueGoalPenalty, staminaRetention, pressConditionCost, pressFoulCost, pressTackles, pressPossession, substituteFreshness, substituteLateExpectedGoals, formations: formationComparisons },
  };
}

export interface CalibrationOptions { matchesPerScenario?: number; seedStart?: number }

/** Fully deterministic report: no current timestamp, ambient randomness, or retained event histories. */
export function runCalibration(options: CalibrationOptions = {}) {
  const matchesPerScenario = options.matchesPerScenario ?? DEFAULT_CALIBRATION_MATCHES;
  const seedStart = options.seedStart ?? DEFAULT_CALIBRATION_SEED_START;
  if (!Number.isInteger(matchesPerScenario) || matchesPerScenario < 400 || matchesPerScenario > 1000) throw new Error('Use 400–1000 matches per scenario.');
  if (!Number.isInteger(seedStart) || seedStart < 0 || seedStart + matchesPerScenario - 1 > 0xffff_ffff) throw new Error('Seed range must fit unsigned 32-bit integers.');
  const seeds = Array.from({ length: matchesPerScenario }, (_, index) => calibrationSeed(seedStart + index));
  const samples: Samples = {};
  for (const scenario of CALIBRATION_SCENARIOS) {
    samples[scenario.id] = seeds.map(seed => runOne(syntheticMatchConfig(seed, scenario.home, scenario.away, scenario.homeAdvantage), scenario.substitute ?? false));
  }
  const assessment = assess(samples);
  return {
    reportVersion: 1,
    engineVersion: MATCH_ENGINE_VERSION,
    fixtureNotice: SYNTHETIC_FIXTURE_NOTICE,
    interpretation: 'Broad original model design targets, not empirical calibration or validation against observed football. Confidence intervals describe these deterministic synthetic batches; targets are not fitted to real leagues.',
    fixtureModel: {
      defaultActionAttribute: 12, aggression: 10, defaultStamina: 12, naturalFitness: 12,
      initialMorale: 70, defaultStarterCondition: 100, benchCondition: 100,
      defaultFormation: '4-4-2', defaultHomeAdvantage: 0.04,
      familiarity: 'Every outfield fixture is familiar with every outfield position; keepers are familiar with GK. Formation comparisons isolate shape rather than unfamiliar assignments.',
      instructions: 'Balanced mentality, standard tempo/width/pressing/defensive line unless the scenario explicitly changes pressing.',
    },
    sample: {
      matchesPerScenario, scenarioCount: CALIBRATION_SCENARIOS.length, totalMatches: matchesPerScenario * CALIBRATION_SCENARIOS.length,
      sourceIndexRange: { first: seedStart, last: seedStart + matchesPerScenario - 1 },
      seedRange: { minimum: Math.min(...seeds), maximum: Math.max(...seeds) },
      seedSchedule: { algorithm: 'uint32-multiply-v1', formula: 'Math.imul(seedStart + index, 0x9e3779b1) >>> 0', multiplier: CALIBRATION_SEED_MULTIPLIER, seeds },
      pairing: 'Each scenario reuses the identical explicit seed vector. Odd uint32 multiplication spreads adjacent source indices across RNG states; comparison intervals use per-seed paired differences. Balanced strength estimates average the two orientations within each seed block before computing uncertainty.',
    },
    scenarios: CALIBRATION_SCENARIOS.map(scenario => ({ id: scenario.id, description: scenario.description, metrics: scenarioMetrics(samples[scenario.id]!) })),
    comparisons: assessment.comparisons,
    acceptance: { passed: assessment.outcomes.every(outcome => outcome.passed), passedCount: assessment.outcomes.filter(outcome => outcome.passed).length, outcomeCount: assessment.outcomes.length, outcomes: assessment.outcomes },
  };
}

export type CalibrationReport = ReturnType<typeof runCalibration>;
