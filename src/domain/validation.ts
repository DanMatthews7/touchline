import { ALL_ATTRIBUTE_PATHS, getAttributeValue, isAttributeValue, type PlayerAttributes } from './attributes';
import type { Club, DatabaseSnapshot, Money, Player, Tactics } from './models';

export interface DomainIssue { path: string; message: string }

export function validateAttributes(attributes: PlayerAttributes): DomainIssue[] {
  return ALL_ATTRIBUTE_PATHS.filter(path => !isAttributeValue(getAttributeValue(attributes, path)))
    .map(path => ({ path: `attributes.${path}`, message: 'Expected null or an integer from 1 to 20.' }));
}

export function validateMoney(value: Money, path = 'money'): DomainIssue[] {
  const issues: DomainIssue[] = [];
  if (!Number.isSafeInteger(value.amountMinor)) issues.push({ path: `${path}.amountMinor`, message: 'Currency must use a safe integer of minor units.' });
  if (!/^[A-Z]{3}$/.test(value.currency)) issues.push({ path: `${path}.currency`, message: 'Expected a three-letter uppercase currency code.' });
  return issues;
}

/** Cross-record invariants, complementary to the importer's unknown-input schema validation. */
export function validateDatabaseInvariants(snapshot: Pick<DatabaseSnapshot, 'players' | 'clubs' | 'competitions' | 'sources'>): DomainIssue[] {
  const issues: DomainIssue[] = [];
  const checkIds = (records: { id: string }[], label: string): Set<string> => {
    const ids = new Set<string>();
    for (const [index, record] of records.entries()) {
      if (!record.id.trim()) issues.push({ path: `${label}.${index}.id`, message: 'Identifier cannot be empty.' });
      if (ids.has(record.id)) issues.push({ path: `${label}.${index}.id`, message: `Duplicate identifier: ${record.id}.` });
      ids.add(record.id);
    }
    return ids;
  };
  const clubIds = checkIds(snapshot.clubs, 'clubs');
  checkIds(snapshot.players, 'players');
  checkIds(snapshot.competitions, 'competitions');
  for (const [index, player] of snapshot.players.entries()) {
    if (player.clubId !== null && !clubIds.has(player.clubId)) issues.push({ path: `players.${index}.clubId`, message: 'Assigned club does not exist in this snapshot.' });
    for (const issue of validateAttributes(player.attributes)) issues.push({ path: `players.${index}.${issue.path}`, message: issue.message });
    if (new Set(player.positions).size !== player.positions.length) issues.push({ path: `players.${index}.positions`, message: 'Positions cannot be repeated.' });
  }
  for (const [index, club] of snapshot.clubs.entries()) {
    if (club.finances) {
      for (const key of ['balance', 'transferBudget', 'weeklyWageBudget'] as const) {
        issues.push(...validateMoney(club.finances[key], `clubs.${index}.finances.${key}`));
        if (club.finances[key].currency !== club.finances.balance.currency) issues.push({ path: `clubs.${index}.finances.${key}.currency`, message: 'A club ledger must use a single currency.' });
        if (key !== 'balance' && club.finances[key].amountMinor < 0) issues.push({ path: `clubs.${index}.finances.${key}.amountMinor`, message: 'A spending budget cannot be negative.' });
      }
    }
  }
  for (const [index, competition] of snapshot.competitions.entries()) {
    if (new Set(competition.clubIds).size !== competition.clubIds.length) issues.push({ path: `competitions.${index}.clubIds`, message: 'Competition membership cannot contain duplicate clubs.' });
    for (const clubId of competition.clubIds) if (!clubIds.has(clubId)) issues.push({ path: `competitions.${index}.clubIds`, message: `Unknown club: ${clubId}.` });
  }
  return issues;
}

export function validateTactics(tactics: Tactics, players: readonly Player[], clubs: readonly Club[]): DomainIssue[] {
  const issues: DomainIssue[] = [];
  if (!clubs.some(club => club.id === tactics.clubId)) issues.push({ path: 'clubId', message: 'Tactics must belong to a known club.' });
  if (tactics.startingXI.length !== 11) issues.push({ path: 'startingXI', message: 'A formation must contain 11 starting slots.' });
  if (tactics.startingXI.filter(slot => slot.position === 'GK').length !== 1) issues.push({ path: 'startingXI', message: 'A formation must contain exactly one goalkeeper slot.' });
  const slotIds = tactics.startingXI.map(slot => slot.slotId);
  if (new Set(slotIds).size !== slotIds.length) issues.push({ path: 'startingXI', message: 'Starting slot identifiers must be unique.' });
  const assigned = [...tactics.startingXI.flatMap(slot => slot.playerId === null ? [] : [slot.playerId]), ...tactics.substitutes];
  if (new Set(assigned).size !== assigned.length) issues.push({ path: 'startingXI', message: 'A player cannot occupy multiple squad places.' });
  for (const playerId of assigned) if (!players.some(player => player.id === playerId && player.clubId === tactics.clubId)) issues.push({ path: 'startingXI', message: `Player ${playerId} must belong to this club.` });
  return issues;
}
