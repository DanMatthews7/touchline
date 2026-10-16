import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VersionCompatibilityError } from '../../data/schema';
import { syntheticCareer, syntheticSnapshot } from '../../data/__tests__/fixtures';
import { TouchlineRepository } from '../repository';
import { importSave } from '../save-format';
import { syntheticMatchConfig } from '../../simulation/__tests__/match-fixtures';
import exhibitionInput from '../../reference/exhibition-snapshot.json';
import { parseSnapshot } from '../../data/schema';
import { DEFAULT_INSTRUCTIONS, defaultExhibitionSelection, prepareExhibition } from '../../match/prepare';
import { applyMatchCommand, createMatch, type MatchCommand, type MatchState } from '../../simulation/match';
import {
  createMatchArchive, exportMatchArchive, importMatchArchive, replayMatchArchive,
  MAX_MATCH_ARCHIVE_BYTES, MAX_MATCH_ARCHIVE_COMMANDS,
} from './archive';
import { MatchSessionConflictError, MatchSessionRepository } from './repository';

const NOW = '2026-10-16T10:00:00.000Z';
let sequence = 0;
let repository: MatchSessionRepository;

beforeEach(() => { repository = new MatchSessionRepository(`touchline-match-synthetic-test-${sequence++}`); });
afterEach(async () => { await repository.deleteDatabase(); });

function accepted(state: MatchState, command: MatchCommand): MatchState {
  const result = applyMatchCommand(state, command);
  if (!result.ok) throw new Error(`Synthetic fixture command unexpectedly failed: ${result.error.message}`);
  return result.state;
}

function midMatch() {
  const config = syntheticMatchConfig(202627);
  let state = accepted(createMatch(config), { type: 'ADVANCE' });
  state = accepted(state, {
    type: 'CHANGE_TACTICS', team: 'home', formation: state.teams.home.formation,
    lineup: state.teams.home.lineup,
    instructions: { ...state.teams.home.instructions, tempo: 'fast' },
  });
  const playerOut = state.teams.home.lineup.find(slot => slot.position !== 'GK')!;
  const playerIn = state.teams.home.benchIds.find(id => config.home.players.find(player => player.id === id)!.positions.includes(playerOut.position))!;
  state = accepted(state, { type: 'SUBSTITUTE', team: 'home', playerOutId: playerOut.playerId, playerInId: playerIn });
  state = accepted(state, { type: 'ADVANCE' });
  return { config, state, archive: createMatchArchive('synthetic-midmatch', config, state.commands, NOW) };
}

describe('separate versioned exhibition match archives', () => {
  it('round-trips a checkpoint with substitutions and tactics by replaying the exact events and RNG', async () => {
    const { archive, state } = midMatch();
    const imported = importMatchArchive(exportMatchArchive(archive));
    expect(imported.archive).toEqual(archive);
    expect(imported.state).toEqual(state);
    expect(imported.state.events.some(event => event.type === 'SUBSTITUTION')).toBe(true);
    expect(imported.state.events.some(event => event.type === 'TACTICS_CHANGED')).toBe(true);
    await repository.save(archive);
    expect(await repository.load(archive.id)).toEqual(imported);
    expect(await repository.loadLatest()).toEqual(imported);
    expect(importMatchArchive(await repository.export(archive.id)).state).toEqual(state);
    expect(await repository.list()).toEqual([archive]);
  });

  it('keeps immutable original input independent from caller edits while allowing progress to evolve', async () => {
    const config = syntheticMatchConfig(2);
    const archive = createMatchArchive('synthetic-immutable-config', config, [], NOW);
    config.home.name = 'Changed caller-owned input';
    expect(archive.config.home.name).not.toBe(config.home.name);
    await repository.save(archive);
    const nextState = accepted(replayMatchArchive(archive).state, { type: 'ADVANCE' });
    const progressed = createMatchArchive(archive.id, archive.config, nextState.commands, '2026-10-16T10:01:00.000Z');
    await repository.save(progressed);
    expect((await repository.load(archive.id))!.state).toEqual(nextState);
    expect((await repository.load(archive.id))!.archive.config).toEqual(archive.config);
  });

  it('rejects changed initial config under a stored session ID without losing its existing progress', async () => {
    const { archive, state } = midMatch();
    await repository.save(archive);
    const changed = createMatchArchive(archive.id, { ...archive.config, seed: 123 }, [], NOW);
    await expect(repository.save(changed)).rejects.toThrow(MatchSessionConflictError);
    await expect(repository.import(exportMatchArchive(changed))).rejects.toThrow(MatchSessionConflictError);
    expect((await repository.load(archive.id))!.state).toEqual(state);
  });

  it('normalizes imported timestamps so latest-session ordering remains chronological', async () => {
    const config = syntheticMatchConfig(4);
    const earlier = createMatchArchive('synthetic-earlier', config, [], '2026-10-16T10:00:00Z');
    const later = createMatchArchive('synthetic-later', config, [], '2026-10-16T10:00:00.500Z');
    await repository.save(later);
    await repository.save(earlier);
    expect(earlier.updatedAt).toBe('2026-10-16T10:00:00.000Z');
    expect((await repository.loadLatest())!.archive.id).toBe(later.id);
    expect((await repository.list()).map(archive => archive.id)).toEqual([later.id, earlier.id]);
  });

  it('rejects unsupported archive and engine versions explicitly before replay or storage writes', async () => {
    const { archive, state } = midMatch();
    await repository.save(archive);
    for (const invalid of [
      { ...archive, schemaVersion: 0 },
      { ...archive, schemaVersion: 2 },
      { ...archive, engineVersion: 2 },
      { ...archive, config: { ...archive.config, engineVersion: 2 } },
    ]) {
      expect(() => replayMatchArchive(invalid)).toThrow(VersionCompatibilityError);
      await expect(repository.import(JSON.stringify(invalid))).rejects.toThrow(VersionCompatibilityError);
      expect((await repository.load(archive.id))!.state).toEqual(state);
    }
  });

  it('rejects corrupt seeds, attributes, conditions and lineup relations without trusting derived scores', async () => {
    const { archive, state } = midMatch();
    await repository.save(archive);
    const nanSeed = structuredClone(archive);
    nanSeed.config.seed = NaN;
    const badAttribute = structuredClone(archive);
    badAttribute.config.home.players[0]!.attributes.technical.passing = 21;
    const missingAssessment = structuredClone(archive);
    missingAssessment.config.home.players[0]!.attributes.technical.passing = null;
    const badCondition = structuredClone(archive);
    badCondition.config.away.players[0]!.initialCondition = Infinity;
    const badLineup = structuredClone(archive);
    badLineup.config.home.lineup[0]!.playerId = 'absent-player';
    for (const invalid of [
      { ...archive, config: { ...archive.config, seed: -1 } },
      { ...archive, config: { ...archive.config, seed: 1.5 } },
      { ...archive, config: { ...archive.config, homeAdvantage: 0.21 } },
      nanSeed, badAttribute, missingAssessment, badCondition, badLineup,
      { ...archive, score: { home: 99, away: 0 } },
      { ...archive, commands: [{ type: 'ADVANCE', inventedResult: 4 }] },
    ]) {
      expect(() => replayMatchArchive(invalid)).toThrow();
      expect((await repository.load(archive.id))!.state).toEqual(state);
    }
  });

  it('rejects invalid substitutions and commands after full time rather than truncating the command log', () => {
    const config = syntheticMatchConfig(19);
    const initial = createMatchArchive('synthetic-invalid-command', config, [], NOW);
    expect(() => replayMatchArchive({ ...initial, commands: [{ type: 'SUBSTITUTE', team: 'home', playerOutId: 'absent-player', playerInId: 'absent-player' }] })).toThrow();
    let state = createMatch(config);
    while (state.status !== 'finished' && state.status !== 'abandoned') state = accepted(state, { type: 'ADVANCE' });
    const completed = createMatchArchive(initial.id, config, state.commands, NOW);
    expect(replayMatchArchive(completed).state).toEqual(state);
    expect(() => replayMatchArchive({ ...completed, commands: [...state.commands, { type: 'ADVANCE' }] })).toThrow();
    expect(() => replayMatchArchive({ ...completed, commands: [...state.commands, { type: 'CHANGE_TACTICS', team: 'away', formation: config.away.formation, instructions: config.away.instructions, lineup: config.away.lineup }] })).toThrow();
  });

  it('rejects malformed JSON, excessive input and excessive command logs before replay', () => {
    expect(() => importMatchArchive('{broken')).toThrow(/valid JSON/);
    expect(() => importMatchArchive(' '.repeat(MAX_MATCH_ARCHIVE_BYTES + 1))).toThrow(/16 MiB/);
    const archive = createMatchArchive('synthetic-bounded', syntheticMatchConfig(1), [], NOW);
    expect(() => replayMatchArchive({ ...archive, commands: Array.from({ length: MAX_MATCH_ARCHIVE_COMMANDS + 1 }, () => ({ type: 'ADVANCE' })) })).toThrow();
  });

  it('archives the authentic identity pool with unknown positions and an explicit exhibition-only baseline', () => {
    const snapshot = parseSnapshot(exhibitionInput);
    const original = structuredClone(snapshot);
    const config = prepareExhibition(snapshot.players, {
      id: 'real-identity-exhibition-test', seed: 10, ...defaultExhibitionSelection(snapshot.players),
      homeFormation: '4-4-2', awayFormation: '4-4-2',
      homeInstructions: { ...DEFAULT_INSTRUCTIONS }, awayInstructions: { ...DEFAULT_INSTRUCTIONS },
      initialCondition: 100, initialMorale: 70, useUniformEstimates: true, homeAdvantage: true,
    });
    const archive = createMatchArchive('real-identity-exhibition-archive', config, [], NOW);
    const restored = importMatchArchive(exportMatchArchive(archive));
    expect(snapshot.players).toHaveLength(32);
    expect(restored.archive.config.assessmentMode).toBe('uniform-missing-10');
    expect(restored.archive.config.home.players.some(player => player.positions.length === 0)).toBe(true);
    expect(snapshot).toEqual(original);
    const withoutMode = structuredClone(archive) as unknown as { config: Record<string, unknown> };
    delete withoutMode.config.assessmentMode;
    expect(() => replayMatchArchive(withoutMode)).toThrow();
  });

  it('rejects custom prototypes and accessors without executing untrusted getters', () => {
    const archive = createMatchArchive('synthetic-plain-data', syntheticMatchConfig(1), [], NOW);
    const getter = { ...archive };
    let executed = false;
    Object.defineProperty(getter, 'engineVersion', { enumerable: true, get() { executed = true; return 1; } });
    expect(() => replayMatchArchive(getter)).toThrow(/accessors/);
    expect(executed).toBe(false);
    expect(() => replayMatchArchive(Object.assign(Object.create({ inherited: true }) as object, archive))).toThrow(/prototypes/);
  });

  it('leaves existing v1 career snapshots and save exports unchanged', async () => {
    const careerRepository = new TouchlineRepository(`touchline-career-isolation-${sequence++}`);
    try {
      const snapshot = syntheticSnapshot();
      const career = syntheticCareer();
      await careerRepository.save(snapshot, career);
      const before = importSave(await careerRepository.exportCareer(career.id));
      const { archive } = midMatch();
      await repository.import(exportMatchArchive(archive));
      await repository.deleteDatabase();
      const after = importSave(await careerRepository.exportCareer(career.id));
      expect(after.snapshot).toEqual(before.snapshot);
      expect(after.career).toEqual(before.career);
      expect(after.schemaVersion).toBe(1);
      expect(after.format).toBe('touchline-save');
    } finally { await careerRepository.deleteDatabase(); }
  });
});
