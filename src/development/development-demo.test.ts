import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_ATTRIBUTE_PATHS, getAttributeValue } from '../domain/attributes';
import { getSeasonTable, replaySeason, type SeasonCommand } from '../simulation/season';
import * as seasonEngine from '../simulation/season';
import { createDemoArchive, importDemoArchive, MAX_DEMO_ARCHIVE_BYTES, MAX_DEMO_COMMANDS } from './archive';
import { DEMO_CLUBS, createDemoConfig, defaultDemoScenario, parseDemoScenario } from './scenario';
import { DEMO_DATABASE_NAME, DemoConflictError, DemoRepository } from './repository';

const time = '2026-10-17T12:00:00.000Z';
function calendarScenario() { return { ...defaultDemoScenario(), firstMatchDate: '2026-10-18' }; }
let sequence = 0;
let name: string;
let repository: DemoRepository;
beforeEach(() => { name = `touchline-development-demo-test-${sequence++}`; repository = new DemoRepository(name); });
afterEach(async () => { vi.restoreAllMocks(); repository.close(); await Dexie.delete(name); });

describe('isolated database-free development scenario', () => {
  it('regenerates twenty generic teams with unique players, balanced original attributes and a legal 433 plus five substitutes', () => {
    const scenario = defaultDemoScenario();
    const config = createDemoConfig(scenario, 'demo-test');
    expect(config.teams.map(team => ({ id: team.id, name: team.name }))).toEqual(DEMO_CLUBS);
    const players = config.teams.flatMap(team => team.players);
    expect(players).toHaveLength(320);
    expect(new Set(players.map(player => player.id)).size).toBe(320);
    for (const team of config.teams) {
      expect(team.lineup).toHaveLength(11);
      expect(team.benchIds).toHaveLength(5);
      expect(team.players.filter(player => player.positions.includes('GK'))).toHaveLength(2);
      expect(team.players.every(player => ALL_ATTRIBUTE_PATHS.every(path => getAttributeValue(player.attributes, path) === 10))).toBe(true);
    }
    expect(createDemoConfig(scenario, 'demo-test')).toEqual(config);
    config.teams[0]!.players[0]!.attributes.technical.passing = 20;
    expect(createDemoConfig(scenario, 'demo-test').teams[0]!.players[0]!.attributes.technical.passing).toBe(10);
    expect(() => parseDemoScenario({ ...scenario, managedClubId: 'real-club' })).toThrow();
    expect(() => parseDemoScenario({ ...scenario, firstMatchDate: '2026-02-30' })).toThrow();
    expect(() => parseDemoScenario({ ...scenario, seed: -1 })).toThrow();
    expect(() => parseDemoScenario({ ...scenario, initialCondition: 0 })).toThrow();
    expect(() => parseDemoScenario({ ...scenario, attributes: 20 })).toThrow();
  });

  it('checkpoints an actual managed match and completed round, restores by replay and exports only scenario plus accepted commands', async () => {
    let session = await repository.start(calendarScenario(), time);
    expect(session.state.status).toBe('between-rounds');
    for (const command of [{ type: 'ADVANCE_CALENDAR' }, { type: 'START_MATCH' }] satisfies SeasonCommand[]) session = await repository.commit(command, time, session.archive.commands);
    session = await repository.commit({ type: 'MATCH_COMMAND', command: { type: 'ADVANCE' } }, time, session.archive.commands);
    expect(session.state.activeMatch!.state.minute).toBe(15);
    repository.close();
    repository = new DemoRepository(name);
    expect(await repository.load()).toEqual(session);
    while (session.state.status === 'playing') session = await repository.commit({ type: 'MATCH_COMMAND', command: { type: 'ADVANCE' } }, time, session.archive.commands);
    expect(session.state.status).toBe('round-ready');
    session = await repository.commit({ type: 'COMPLETE_ROUND' }, time, session.archive.commands);
    expect(session.state.results).toHaveLength(10);
    expect(getSeasonTable(session.state).every(row => row.played === 1)).toBe(true);
    const serialized = await repository.export();
    expect(Object.keys(JSON.parse(serialized) as object)).toEqual(['format', 'schemaVersion', 'engineVersion', 'matchEngineVersion', 'id', 'updatedAt', 'scenario', 'commands']);
    expect(importDemoArchive(serialized)).toEqual(session);
    expect(session.state).toEqual(replaySeason(createDemoConfig(session.archive.scenario, session.archive.id), session.archive.commands));
    const restoration = new DemoRepository(`${name}-restored`);
    try {
      expect(await restoration.import(serialized)).toEqual(session);
      restoration.close();
      const reopened = new DemoRepository(`${name}-restored`);
      try { expect(await reopened.load()).toEqual(session); } finally { reopened.close(); }
    } finally { restoration.close(); await Dexie.delete(`${name}-restored`); }
  });

  it('rejects unsupported, tampered and impossible imports without replacing the checkpoint, including raw getters and oversize logs', async () => {
    const session = await repository.start(defaultDemoScenario(), time);
    const exported = await repository.export();
    for (const changed of [
      { ...session.archive, format: 'touchline-season' },
      { ...session.archive, schemaVersion: 2 },
      { ...session.archive, engineVersion: 2 },
      { ...session.archive, matchEngineVersion: 2 },
      { ...session.archive, results: [{ score: 99 }] },
      { ...session.archive, initialConfig: session.state.config },
      { ...session.archive, commands: [{ type: 'COMPLETE_ROUND' }] },
      { ...session.archive, scenario: { ...session.archive.scenario, managedClubId: 'unknown' } },
      { ...session.archive, commands: Array.from({ length: MAX_DEMO_COMMANDS + 1 }, () => ({ type: 'ADVANCE_CALENDAR' })) },
    ]) await expect(repository.import(JSON.stringify(changed))).rejects.toThrow();
    await expect(repository.import('not-json')).rejects.toThrow('valid JSON');
    await expect(repository.import(' '.repeat(MAX_DEMO_ARCHIVE_BYTES + 1))).rejects.toThrow('16 MiB');
    let reads = 0;
    const hostile = Object.defineProperty(defaultDemoScenario(), 'seed', { enumerable: true, get() { reads++; return 42; } });
    await expect(repository.start(hostile, time)).rejects.toThrow('accessors');
    expect(reads).toBe(0);
    expect(() => createDemoArchive('demo-hostile', Object.assign(Object.create({ forged: true }) as object, defaultDemoScenario()) as ReturnType<typeof defaultDemoScenario>, time)).toThrow('prototypes');
    expect(await repository.export()).toBe(exported);
    expect(await repository.load()).toEqual(session);
  });

  it('refuses stale concurrent decisions and another tab replacing an empty-log demo', async () => {
    const original = await repository.start(calendarScenario(), time);
    const other = new DemoRepository(name);
    try {
      await other.load();
      const outcomes = await Promise.allSettled([
        repository.commit({ type: 'ADVANCE_CALENDAR' }, time, []),
        other.commit({ type: 'ADVANCE_CALENDAR' }, time, []),
      ]);
      expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter(outcome => outcome.status === 'rejected')).toHaveLength(1);
      expect((await repository.load())!.archive.commands).toEqual([{ type: 'ADVANCE_CALENDAR' }]);
      await expect(repository.commit({ type: 'START_MATCH' }, time, original.archive.commands)).rejects.toThrow(DemoConflictError);
      const reset = await repository.start(calendarScenario(), time);
      await other.start(calendarScenario(), time);
      await expect(repository.commit({ type: 'ADVANCE_CALENDAR' }, time, reset.archive.commands)).rejects.toThrow(DemoConflictError);
    } finally { other.close(); }
  });

  it('keeps incremental cache private and retains the previous checkpoint when storage rejects a command', async () => {
    const original = await repository.start(calendarScenario(), time);
    original.state.config.teams[0]!.name = 'Caller alteration';
    original.archive.scenario.seed = 900;
    const replaySpy = vi.spyOn(seasonEngine, 'replaySeason');
    const next = await repository.commit({ type: 'ADVANCE_CALENDAR' }, time, []);
    expect(replaySpy).not.toHaveBeenCalled();
    expect(next.state.config.teams[0]!.name).toBe('Demo Club 01');
    expect(next.archive.scenario.seed).toBe(42);
    const transactionSpy = vi.spyOn(Dexie.prototype, 'transaction').mockRejectedValueOnce(new Error('Simulated storage failure'));
    await expect(repository.commit({ type: 'START_MATCH' }, time, next.archive.commands)).rejects.toThrow('storage failure');
    transactionSpy.mockRestore();
    expect(await repository.load()).toEqual(next);
    expect((await repository.commit({ type: 'START_MATCH' }, time, next.archive.commands)).state.status).toBe('playing');
  });

  it('allows explicit backup rollback but forbids changing a saved demo scenario under the same identifier', async () => {
    const initial = await repository.start(calendarScenario(), time);
    const backup = await repository.export();
    const progressed = await repository.commit({ type: 'ADVANCE_CALENDAR' }, time, []);
    const changed = { ...progressed.archive, scenario: { ...progressed.archive.scenario, seed: 51 } };
    await expect(repository.import(JSON.stringify(changed))).rejects.toThrow('initial scenario');
    expect(await repository.load()).toEqual(progressed);
    expect(await repository.import(backup)).toEqual(initial);
    expect((await repository.start({ ...defaultDemoScenario(), seed: 51 }, time)).archive.id).not.toBe(initial.archive.id);
  });

  it('rejects exporting a stale empty-log demo without adopting another tab\'s checkpoint behind the UI', async () => {
    const oldSession = await repository.start(calendarScenario(), time);
    const other = new DemoRepository(name);
    try {
      const replacement = await other.start(calendarScenario(), time);
      expect(replacement.archive.id).not.toBe(oldSession.archive.id);
      await expect(repository.export()).rejects.toThrow(DemoConflictError);
      await expect(repository.commit({ type: 'ADVANCE_CALENDAR' }, time, oldSession.archive.commands)).rejects.toThrow(DemoConflictError);
      expect(await other.load()).toEqual(replacement);
    } finally { other.close(); }
  });

  it('opens only the dedicated development database, without normal source, career or exhibition stores', async () => {
    const before = (await indexedDB.databases()).map(database => database.name);
    const dedicated = new DemoRepository();
    try {
      await dedicated.start(defaultDemoScenario(), time);
      const after = (await indexedDB.databases()).map(database => database.name);
      expect(after.filter(database => !before.includes(database))).toEqual([DEMO_DATABASE_NAME]);
      const inspection = new Dexie(DEMO_DATABASE_NAME);
      await inspection.open();
      try { expect(inspection.tables.map(table => table.name)).toEqual(['checkpoints']); } finally { inspection.close(); }
    } finally { dedicated.close(); await Dexie.delete(DEMO_DATABASE_NAME); }
  });
});
