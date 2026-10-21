import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getClubFinancialSummary } from '../simulation/career';
import { createDemoArchive, exportDemoArchive, importDemoArchive, type DemoCommand, type DemoSession } from './archive';
import { DEMO_CAREER_INPUTS } from './career-session';
import { DemoConflictError, DemoRepository } from './repository';
import { defaultDemoScenario } from './scenario';

const time = '2026-10-20T12:00:00.000Z';
const scenario = () => ({ ...defaultDemoScenario(), startDate: '2026-10-16', firstMatchDate: '2026-10-17' });
let sequence = 0;
let name: string;
let repository: DemoRepository;
beforeEach(() => { name = `touchline-career-storage-test-${sequence++}`; repository = new DemoRepository(name); });
afterEach(async () => { vi.restoreAllMocks(); repository.close(); await Dexie.delete(name); });
async function commit(session: DemoSession, command: DemoCommand): Promise<DemoSession> {
  return repository.commit(command, time, session.archive.commands);
}
async function finishRound(session: DemoSession): Promise<DemoSession> {
  let current = session;
  for (let decisions = 0; decisions < 40; decisions++) {
    if (current.state.status === 'between-rounds') current = await commit(current, { type: 'ADVANCE_CALENDAR' });
    else if (current.state.status === 'matchday') current = await commit(current, { type: 'START_MATCH' });
    else if (current.state.status === 'playing') current = await commit(current, { type: 'MATCH_COMMAND', command: { type: 'ADVANCE' } });
    else if (current.state.status === 'round-ready') return commit(current, { type: 'COMPLETE_ROUND' });
    else if (current.state.status === 'blocked') current = await commit(current, { type: 'REPLAY_ABANDONED' });
    else throw new Error('Unexpected demo completion state.');
  }
  throw new Error('Demo round did not complete within its decision budget.');
}
async function finishManagedMatch(session: DemoSession): Promise<DemoSession> {
  let current = session;
  for (let decisions = 0; decisions < 40; decisions++) {
    if (current.state.status === 'round-ready') return current;
    if (current.state.status === 'between-rounds') current = await commit(current, { type: 'ADVANCE_CALENDAR' });
    else if (current.state.status === 'matchday') current = await commit(current, { type: 'START_MATCH' });
    else if (current.state.status === 'playing') current = await commit(current, { type: 'MATCH_COMMAND', command: { type: 'ADVANCE' } });
    else if (current.state.status === 'blocked') current = await commit(current, { type: 'REPLAY_ABANDONED' });
    else throw new Error('Unexpected managed match completion state.');
  }
  throw new Error('Managed match did not complete within its decision budget.');
}
function renewal(session: DemoSession): DemoCommand {
  return { type: 'RENEW_CONTRACT', playerId: session.state.config.teams.find(team => team.id === session.state.config.managedClubId)!.players[0]!.id, weeklyWageMinor: 120_000, endDate: '2030-10-17' };
}

describe('career-aware demo checkpoint boundary', () => {
  it('rejects an unsupported first-match gap before replacing a checkpoint or activating an old season', async () => {
    const current = await repository.start(defaultDemoScenario(), time);
    const distant = { ...scenario(), firstMatchDate: '2037-10-17' };
    await expect(repository.start(distant, time)).rejects.toThrow('within ten years');
    expect(await repository.load()).toEqual(current);
    const legacy = await repository.import(exportDemoArchive(createDemoArchive('demo-distant-fixture', distant, time).archive));
    await expect(repository.enableCareer(time, legacy.archive.commands)).rejects.toThrow('within ten years');
    expect(await repository.load()).toEqual(legacy);
    // Original football-only archives keep their scenario-version-1 interpretation.
    expect((await commit(legacy, { type: 'ADVANCE_CALENDAR' })).state.currentDate).toBe(distant.firstMatchDate);
  });

  it('retains legacy v1 backups exactly and enables finances only at the explicit current football boundary', async () => {
    const legacy = createDemoArchive('demo-legacy-career-opt-in', scenario(), time);
    let old = await repository.import(exportDemoArchive(legacy.archive));
    old = await finishRound(old);
    old = await finishRound(old);
    const original = await repository.export();
    expect(old.archive.schemaVersion).toBe(1);
    expect(old.finances).toBeNull();
    expect(Object.keys(JSON.parse(original) as object)).toEqual(['format', 'schemaVersion', 'engineVersion', 'matchEngineVersion', 'id', 'updatedAt', 'scenario', 'commands']);
    repository.close(); repository = new DemoRepository(name);
    expect(await repository.load()).toEqual(old);
    expect(await repository.export()).toBe(original);
    const upgraded = await repository.enableCareer(time, old.archive.commands);
    expect(upgraded.state).toEqual(old.state);
    expect(upgraded.archive.id).toBe(old.archive.id);
    expect(upgraded.archive.schemaVersion).toBe(2);
    if (upgraded.archive.schemaVersion !== 2) throw new Error('Expected a career archive.');
    expect(upgraded.archive.careerStartCommandIndex).toBe(old.archive.commands.length);
    expect(upgraded.archive.commands).toEqual(old.archive.commands);
    expect(upgraded.finances!.startDate).toBe(old.state.currentDate);
    expect(upgraded.finances!.currentDate).toBe(old.state.currentDate);
    expect(upgraded.finances!.ledger).toEqual([]);
    expect(Object.values(upgraded.finances!.clubs).every(club => club.balanceMinor === DEMO_CAREER_INPUTS.openingBalanceMinor)).toBe(true);
    expect(importDemoArchive(await repository.export())).toEqual(upgraded);
    const next = await commit(upgraded, { type: 'ADVANCE_CALENDAR' });
    const summary = getClubFinancialSummary(next.finances!, next.state.config.managedClubId);
    expect(summary.totalSpendingMinor).toBe(1_600_000);
    expect(summary.totalIncomeMinor).toBe(0);
    expect(await repository.import(original)).toEqual(old);
    expect((await repository.load())!.finances).toBeNull();
  });

  it('saves renewed contracts, home income and wage payments with football results in one replayable checkpoint', async () => {
    let session = await repository.start(defaultDemoScenario(), time);
    const beforeFootball = structuredClone(session.state);
    const accepted = renewal(session);
    session = await commit(session, accepted);
    expect(session.state).toEqual(beforeFootball);
    expect(session.archive.commands).toEqual([accepted]);
    expect(session.state.commands).toEqual([]);
    const summary = getClubFinancialSummary(session.finances!, session.state.config.managedClubId);
    expect(summary.weeklyWagesMinor).toBe(1_620_000);
    expect(summary.balanceMinor).toBe(DEMO_CAREER_INPUTS.openingBalanceMinor);
    session = await finishRound(session);
    expect(session.state.results).toHaveLength(10);
    const firstHomeIds = session.state.fixtures.filter(fixture => fixture.round === 1).map(fixture => fixture.homeClubId);
    for (const club of session.state.config.teams) {
      const clubSummary = getClubFinancialSummary(session.finances!, club.id);
      expect(clubSummary.totalIncomeMinor).toBe(firstHomeIds.includes(club.id) ? DEMO_CAREER_INPUTS.matchdayIncomeMinor : 0);
    }
    session = await commit(session, { type: 'ADVANCE_CALENDAR' });
    expect(getClubFinancialSummary(session.finances!, session.state.config.managedClubId).totalSpendingMinor).toBe(1_620_000);
    const backup = await repository.export();
    const envelope = JSON.parse(backup) as Record<string, unknown>;
    for (const untrusted of ['finances', 'ledger', 'contracts', 'balanceMinor', 'results']) expect(envelope).not.toHaveProperty(untrusted);
    repository.close(); repository = new DemoRepository(name);
    expect(await repository.load()).toEqual(session);
    expect(importDemoArchive(backup)).toEqual(session);
    const other = new DemoRepository(`${name}-fresh`);
    try { expect(await other.import(backup)).toEqual(session); } finally { other.close(); await Dexie.delete(`${name}-fresh`); }
  });

  it('rejects forged financial states, activation changes and impossible renewals without changing the saved checkpoint', async () => {
    const legacy = createDemoArchive('demo-immutable-activation', scenario(), time);
    const old = await commit(await repository.import(exportDemoArchive(legacy.archive)), { type: 'ADVANCE_CALENDAR' });
    const session = await repository.enableCareer(time, old.archive.commands);
    const before = await repository.export();
    const ownId = session.state.config.managedClubId;
    const rivalId = session.state.config.teams.find(team => team.id !== ownId)!.players[0]!.id;
    const renewalCommand = renewal(session);
    if (renewalCommand.type !== 'RENEW_CONTRACT') throw new Error('Expected renewal.');
    for (const archive of [
      { ...session.archive, finances: { balanceMinor: 999_999_999 } },
      { ...session.archive, careerEngineVersion: 999 },
      { ...session.archive, careerStartCommandIndex: 999 },
      { ...session.archive, careerStartCommandIndex: 0 },
      { ...session.archive, commands: [renewalCommand] },
      { ...session.archive, commands: [...session.archive.commands, { ...renewalCommand, playerId: rivalId }] },
      { ...session.archive, commands: [...session.archive.commands, { ...renewalCommand, weeklyWageMinor: 10_000_000 }] },
    ]) await expect(repository.import(JSON.stringify(archive))).rejects.toThrow();
    await expect(commit(session, { ...renewalCommand, endDate: '2026-02-30' })).rejects.toThrow();
    expect(await repository.export()).toBe(before);
    expect(await repository.load()).toEqual(session);
  });

  it('rejects stale same-count writes after career activation and concurrent contract decisions', async () => {
    const old = await repository.import(exportDemoArchive(createDemoArchive('demo-activation-conflict', defaultDemoScenario(), time).archive));
    const other = new DemoRepository(name);
    try {
      await other.load();
      let upgraded = await repository.enableCareer(time, old.archive.commands);
      await expect(other.commit({ type: 'START_MATCH' }, time, old.archive.commands)).rejects.toThrow(DemoConflictError);
      await expect(other.export()).rejects.toThrow(DemoConflictError);
      await other.load();
      const decision = renewal(upgraded);
      const outcomes = await Promise.allSettled([repository.commit(decision, time, upgraded.archive.commands), other.commit(decision, time, upgraded.archive.commands)]);
      expect(outcomes.filter(value => value.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter(value => value.status === 'rejected')).toHaveLength(1);
      upgraded = (await repository.load())!;
      expect(upgraded.archive.commands).toHaveLength(1);
      expect(getClubFinancialSummary(upgraded.finances!, upgraded.state.config.managedClubId).weeklyWagesMinor).toBe(1_620_000);
    } finally { other.close(); }
  });

  it('preserves the old checkpoint and private financial cache if an activation or renewal write fails', async () => {
    const old = await repository.import(exportDemoArchive(createDemoArchive('demo-failed-finance-save', defaultDemoScenario(), time).archive));
    const activationFailure = vi.spyOn(Dexie.prototype, 'transaction').mockRejectedValueOnce(new Error('Simulated activation write failure'));
    await expect(repository.enableCareer(time, old.archive.commands)).rejects.toThrow('activation write failure');
    activationFailure.mockRestore();
    expect(await repository.load()).toEqual(old);
    const enabled = await repository.enableCareer(time, old.archive.commands);
    const renewalFailure = vi.spyOn(Dexie.prototype, 'transaction').mockRejectedValueOnce(new Error('Simulated contract write failure'));
    await expect(commit(enabled, renewal(enabled))).rejects.toThrow('contract write failure');
    renewalFailure.mockRestore();
    expect(await repository.load()).toEqual(enabled);
    expect((await commit(enabled, renewal(enabled))).archive.commands).toHaveLength(1);
  });

  it('commits football results and ten home receipts together, then pays wages once after a failed calendar write', async () => {
    const staged = await finishManagedMatch(await repository.start(defaultDemoScenario(), time));
    expect(staged.state.results).toEqual([]);
    expect(staged.finances!.processedFixtures).toEqual({});
    expect(staged.finances!.ledger).toEqual([]);
    const roundFailure = vi.spyOn(Dexie.prototype, 'transaction').mockRejectedValueOnce(new Error('Simulated round write failure'));
    await expect(commit(staged, { type: 'COMPLETE_ROUND' })).rejects.toThrow('round write failure');
    roundFailure.mockRestore();
    expect(await repository.load()).toEqual(staged);
    const completed = await commit(staged, { type: 'COMPLETE_ROUND' });
    expect(completed.state.results).toHaveLength(10);
    expect(Object.keys(completed.finances!.processedFixtures)).toHaveLength(10);
    expect(completed.finances!.ledger.filter(entry => entry.kind === 'matchday-income')).toHaveLength(10);
    const calendarFailure = vi.spyOn(Dexie.prototype, 'transaction').mockRejectedValueOnce(new Error('Simulated payday write failure'));
    await expect(commit(completed, { type: 'ADVANCE_CALENDAR' })).rejects.toThrow('payday write failure');
    calendarFailure.mockRestore();
    expect(await repository.load()).toEqual(completed);
    const paid = await commit(completed, { type: 'ADVANCE_CALENDAR' });
    expect(paid.finances!.ledger.filter(entry => entry.kind === 'wages')).toHaveLength(20);
    expect(paid.finances!.ledger.filter(entry => entry.kind === 'matchday-income')).toHaveLength(10);
    expect(getClubFinancialSummary(paid.finances!, paid.state.config.managedClubId).totalSpendingMinor).toBe(1_600_000);
    expect(importDemoArchive(await repository.export())).toEqual(paid);
  });
});
