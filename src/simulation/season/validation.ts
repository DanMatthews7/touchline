import { isDateOnly } from '../commands';
import { MATCH_ENGINE_VERSION, parseMatchCommand, parseMatchConfig, type MatchTeam } from '../match';
import { addSeasonDays } from './scheduler';
import { SEASON_CLUB_COUNT, SEASON_ENGINE_VERSION, type SeasonCommand, type SeasonConfig } from './types';

export interface SeasonValidationIssue { path: string; message: string }
export class SeasonValidationError extends Error {
  constructor(public readonly issues: SeasonValidationIssue[]) {
    super(issues.map(issue => `${issue.path}: ${issue.message}`).join('; '));
    this.name = 'SeasonValidationError';
  }
}
type PlainRecord = Record<string, unknown>;
function invalid(path: string, message: string): never { throw new SeasonValidationError([{ path, message }]); }

/** Descriptor snapshots reject getters, custom prototypes and unrecognized input fields. */
function plainRecord(input: unknown, keys: readonly string[], path: string): PlainRecord {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return invalid(path, 'Expected a plain record.');
  const prototype: unknown = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) return invalid(path, 'Custom prototypes are not supported.');
  const result: PlainRecord = Object.create(null) as PlainRecord;
  for (const key of Reflect.ownKeys(input)) {
    if (typeof key !== 'string' || !keys.includes(key)) return invalid(path, `Unrecognized field: ${String(key)}.`);
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) return invalid(`${path}.${key}`, 'Expected an enumerable data field.');
    result[key] = descriptor.value as unknown;
  }
  for (const key of keys) if (!Object.hasOwn(result, key)) return invalid(`${path}.${key}`, 'Required field is missing.');
  return result;
}
function plainArray(input: unknown, length: number, path: string): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) return invalid(path, 'Expected a plain array.');
  const descriptor = Object.getOwnPropertyDescriptor(input, 'length');
  if (descriptor?.value !== length) return invalid(path, `Expected exactly ${length} entries.`);
  for (const key of Reflect.ownKeys(input)) if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) return invalid(path, 'Unrecognized array field.');
  return Array.from({ length }, (_, index) => {
    const item = Object.getOwnPropertyDescriptor(input, String(index));
    if (!item || !('value' in item) || !item.enumerable) return invalid(`${path}[${index}]`, 'Expected a present data entry.');
    return item.value as unknown;
  });
}
function identifier(input: unknown, path: string, max = 128): string {
  if (typeof input !== 'string' || input.length > max || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(input)) return invalid(path, `Expected a stable identifier of at most ${max} characters.`);
  return input;
}
function label(input: unknown, path: string): string {
  if (typeof input !== 'string' || input.length > 240 || !/\S/.test(input) || /[\u0000-\u001f\u007f]/.test(input)) return invalid(path, 'Expected nonblank text of at most 240 characters without control characters.');
  return input;
}
function date(input: unknown, path: string): string {
  if (typeof input !== 'string' || !isDateOnly(input)) return invalid(path, 'Expected a real YYYY-MM-DD calendar date.');
  return input;
}

export function parseSeasonConfig(input: unknown): SeasonConfig {
  try {
    const fields = plainRecord(input, ['engineVersion', 'matchEngineVersion', 'id', 'careerId', 'name', 'startDate', 'firstMatchDate', 'seed', 'managedClubId', 'teams', 'assessmentMode', 'homeAdvantage'], 'config');
    if (fields.engineVersion !== SEASON_ENGINE_VERSION) return invalid('engineVersion', `Unsupported season engine version; expected ${SEASON_ENGINE_VERSION}.`);
    if (fields.matchEngineVersion !== MATCH_ENGINE_VERSION) return invalid('matchEngineVersion', `Unsupported match engine version; expected ${MATCH_ENGINE_VERSION}.`);
    const id = identifier(fields.id, 'id', 96);
    const careerId = identifier(fields.careerId, 'careerId');
    const name = label(fields.name, 'name');
    const startDate = date(fields.startDate, 'startDate');
    const firstMatchDate = date(fields.firstMatchDate, 'firstMatchDate');
    if (firstMatchDate < startDate) return invalid('firstMatchDate', 'The first fixture cannot precede the career start date.');
    addSeasonDays(firstMatchDate, 37 * 7);
    const managedClubId = identifier(fields.managedClubId, 'managedClubId');
    const teamsInput = plainArray(fields.teams, SEASON_CLUB_COUNT, 'teams');
    const teams: MatchTeam[] = [];
    for (let index = 0; index < teamsInput.length; index += 2) {
      let pair;
      try {
        pair = parseMatchConfig({ engineVersion: MATCH_ENGINE_VERSION, id: 'season-boundary-validation', seed: fields.seed, home: teamsInput[index], away: teamsInput[index + 1], assessmentMode: fields.assessmentMode, homeAdvantage: fields.homeAdvantage });
      } catch (error) { return invalid(`teams[${index}..${index + 1}]`, error instanceof Error ? error.message : 'Invalid match-ready team.'); }
      for (const team of [pair.home, pair.away]) {
        teams.push(team);
      }
    }
    if (new Set(teams.map(team => team.id)).size !== SEASON_CLUB_COUNT) return invalid('teams', 'The twenty club identifiers must be unique.');
    const playerIds = teams.flatMap(team => team.players.map(player => player.id));
    if (new Set(playerIds).size !== playerIds.length) return invalid('teams', 'A player may belong to only one season team.');
    if (!teams.some(team => team.id === managedClubId)) return invalid('managedClubId', 'The managed club must belong to this season.');
    return { engineVersion: SEASON_ENGINE_VERSION, matchEngineVersion: MATCH_ENGINE_VERSION, id, careerId, name, startDate, firstMatchDate, seed: fields.seed as number, managedClubId, teams, assessmentMode: fields.assessmentMode as SeasonConfig['assessmentMode'], homeAdvantage: fields.homeAdvantage as number };
  } catch (error) {
    if (error instanceof SeasonValidationError) throw error;
    return invalid('config', error instanceof Error ? error.message : 'Season input could not be inspected as plain data.');
  }
}

export function parseSeasonCommand(input: unknown): SeasonCommand {
  try {
    const descriptor = typeof input === 'object' && input !== null ? Object.getOwnPropertyDescriptor(input, 'type') : undefined;
    const type: unknown = descriptor && 'value' in descriptor ? descriptor.value as unknown : undefined;
    const fields = plainRecord(input, type === 'MATCH_COMMAND' ? ['type', 'command'] : ['type'], 'command');
    if (fields.type === 'MATCH_COMMAND') return { type: 'MATCH_COMMAND', command: parseMatchCommand(fields.command) };
    if (fields.type === 'ADVANCE_CALENDAR' || fields.type === 'START_MATCH' || fields.type === 'COMPLETE_ROUND' || fields.type === 'REPLAY_ABANDONED') return { type: fields.type };
    return invalid('command.type', 'Unknown season command.');
  } catch (error) {
    if (error instanceof SeasonValidationError) throw error;
    return invalid('command', error instanceof Error ? error.message : 'Invalid season command.');
  }
}
