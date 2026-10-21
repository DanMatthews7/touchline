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
export type DemoCommand = SeasonCommand | DemoContractRenewal;
const renewalSchema = z.object({
  type: z.literal('RENEW_CONTRACT'),
  playerId: z.string().min(1).max(120),
  weeklyWageMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  endDate: z.string().refine(isDateOnly, 'Use a real YYYY-MM-DD contract end date.'),
}).strict();

export function parseDemoCommand(input: unknown): DemoCommand {
  assertPlainDemoData(input);
  if (input && typeof input === 'object' && 'type' in input && input.type === 'RENEW_CONTRACT') return renewalSchema.parse(input);
  return parseSeasonCommand(input);
}
