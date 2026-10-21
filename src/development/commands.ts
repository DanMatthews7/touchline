import { z } from 'zod';
import { isDateOnly } from '../simulation/commands';
import { parseSeasonCommand, type SeasonCommand } from '../simulation/season';
import { assertPlainDemoData } from './validation';

export interface DemoContractRenewal {
  type: 'RENEW_CONTRACT';
  playerId: string;
  weeklyWageMinor: number;
  endDate: string;
}
export interface DemoNegotiatedContract {
  type: 'NEGOTIATE_CONTRACT';
  negotiationVersion: 1;
  playerId: string;
  weeklyWageMinor: number;
  endDate: string;
  signingBonusMinor: number;
}
export type DemoFinanceCommand = DemoContractRenewal | DemoNegotiatedContract;
export type DemoCommand = SeasonCommand | DemoFinanceCommand;
export function isDemoFinanceCommand(command: DemoCommand): command is DemoFinanceCommand {
  return command.type === 'RENEW_CONTRACT' || command.type === 'NEGOTIATE_CONTRACT';
}
const renewalSchema = z.object({
  type: z.literal('RENEW_CONTRACT'),
  playerId: z.string().min(1).max(120),
  weeklyWageMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  endDate: z.string().refine(isDateOnly, 'Use a real YYYY-MM-DD contract end date.'),
}).strict();
const offerSchema = renewalSchema.omit({ type: true }).extend({
  type: z.literal('NEGOTIATE_CONTRACT'), negotiationVersion: z.literal(1),
  signingBonusMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
}).strict();

export function parseDemoCommand(input: unknown): DemoCommand {
  assertPlainDemoData(input);
  if (input && typeof input === 'object' && 'type' in input && input.type === 'RENEW_CONTRACT') return renewalSchema.parse(input);
  if (input && typeof input === 'object' && 'type' in input && input.type === 'NEGOTIATE_CONTRACT') return offerSchema.parse(input);
  return parseSeasonCommand(input);
}
