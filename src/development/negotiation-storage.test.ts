import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getClubFinancialSummary } from '../simulation/career';
import { exportDemoArchive, importDemoArchive, type DemoCommand, type DemoSession } from './archive';
import { DemoRepository } from './repository';
import { defaultDemoScenario } from './scenario';

const time = '2026-10-21T12:00:00.000Z';
let sequence = 0;
let name: string;
let repository: DemoRepository;
beforeEach(() => { name = `touchline-negotiation-storage-test-${sequence++}`; repository = new DemoRepository(name); });
afterEach(async () => { vi.restoreAllMocks(); repository.close(); await Dexie.delete(name); });

function offer(playerId = 'demo-player-01-01'): DemoCommand {
  return { type: 'NEGOTIATE_CONTRACT', negotiationVersion: 1, playerId, weeklyWageMinor: 90_000, endDate: '2029-10-17', signingBonusMinor: 2_000_000 };
}
async function commit(session: DemoSession, command: DemoCommand): Promise<DemoSession> {
  return repository.commit(command, time, session.archive.commands);
}

describe('negotiated demo contract checkpoints', () => {
  it('records a funded wage reduction and guaranteed bonus once across reload and repeated portable restoration', async () => {
    const initial = await repository.start(defaultDemoScenario(), time);
    const accepted = await commit(initial, offer());
    expect(accepted.state).toEqual(initial.state);
    expect(accepted.state.commands).toEqual([]);
    expect(accepted.finances!.contracts['demo-player-01-01']).toMatchObject({ weeklyWageMinor: 90_000, endDate: '2029-10-17' });
    expect(accepted.finances!.ledger).toHaveLength(1);
    expect(accepted.finances!.ledger[0]).toMatchObject({ kind: 'signing-bonus', playerId: 'demo-player-01-01', amountMinor: -2_000_000, balanceAfterMinor: 498_000_000 });
    expect(getClubFinancialSummary(accepted.finances!, 'demo-club-01')).toMatchObject({
      balanceMinor: 498_000_000, weeklyWagesMinor: 1_590_000, totalSpendingMinor: 2_000_000, totalBonusesMinor: 2_000_000,
    });
    const backup = await repository.export();
    expect(importDemoArchive(backup)).toEqual(accepted);
    repository.close(); repository = new DemoRepository(name);
    expect(await repository.load()).toEqual(accepted);
    expect(await repository.export()).toBe(backup);
    const freshName = `${name}-fresh`;
    const fresh = new DemoRepository(freshName);
    try {
      for (let restores = 0; restores < 2; restores++) {
        expect(await fresh.import(backup)).toEqual(accepted);
        expect(await fresh.export()).toBe(backup);
        expect((await fresh.load())!.finances!.ledger).toHaveLength(1);
      }
    } finally { fresh.close(); await Dexie.delete(freshName); }
  });

  it('preserves a checkpoint on player refusal, unfunded compensation and forged negotiation circumstances', async () => {
    const initial = await repository.start(defaultDemoScenario(), time);
    const before = await repository.export();
    const proposal = offer();
    if (proposal.type !== 'NEGOTIATE_CONTRACT') throw new Error('Expected negotiated offer.');
    await expect(commit(initial, { ...proposal, signingBonusMinor: 0 })).rejects.toThrow();
    await expect(commit(initial, { ...proposal, signingBonusMinor: 600_000_000 })).rejects.toThrow();
    for (const command of [
      { ...proposal, negotiationVersion: 999 },
      { ...proposal, ageYears: 36 },
      { ...proposal, birthDate: '1990-01-01' },
      { ...proposal, reason: 'financial-distress' },
      { ...proposal, financiallyStruggling: true },
    ]) {
      await expect(repository.import(JSON.stringify({ ...initial.archive, commands: [command] }))).rejects.toThrow();
    }
    expect(await repository.export()).toBe(before);
    expect(await repository.load()).toEqual(initial);
  });

  it('replays historical literal renewals without changing their command or creating negotiation metadata', async () => {
    const initial = await repository.start(defaultDemoScenario(), time);
    if (initial.archive.schemaVersion !== 2) throw new Error('Expected a career-enabled demo.');
    const command = { type: 'RENEW_CONTRACT' as const, playerId: 'demo-player-01-01', weeklyWageMinor: 120_000, endDate: '2029-10-17' };
    const archive = { ...initial.archive, commands: [command] };
    const serialized = exportDemoArchive(archive);
    const restored = await repository.import(serialized);
    expect(restored.archive.commands).toEqual([command]);
    expect(restored.finances!.contracts['demo-player-01-01']).toEqual({
      playerId: command.playerId, clubId: 'demo-club-01', startDate: '2026-10-17', endDate: command.endDate, weeklyWageMinor: command.weeklyWageMinor,
    });
    expect(restored.finances!.ledger).toEqual([]);
    expect(await repository.export()).toBe(serialized);
    await expect(commit(restored, { ...command, weeklyWageMinor: 110_000, endDate: '2030-10-17' })).rejects.toThrow(/cannot reduce/);
    expect(await repository.export()).toBe(serialized);
  });

  it('keeps bonus cash and accepted terms atomic when a write fails and gives same-day bonuses unique identities', async () => {
    const initial = await repository.start(defaultDemoScenario(), time);
    const failure = vi.spyOn(Dexie.prototype, 'transaction').mockRejectedValueOnce(new Error('Simulated bonus checkpoint write failure'));
    await expect(commit(initial, offer())).rejects.toThrow('bonus checkpoint write failure');
    failure.mockRestore();
    expect(await repository.load()).toEqual(initial);
    const first = await commit(initial, offer());
    const second = await commit(first, offer('demo-player-01-02'));
    expect(second.finances!.ledger).toHaveLength(2);
    expect(new Set(second.finances!.ledger.map(entry => entry.id)).size).toBe(2);
    expect(getClubFinancialSummary(second.finances!, 'demo-club-01')).toMatchObject({ balanceMinor: 496_000_000, totalSpendingMinor: 4_000_000, totalBonusesMinor: 4_000_000 });
    expect(importDemoArchive(await repository.export())).toEqual(second);
  });
});
