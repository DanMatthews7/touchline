/** SYNTHETIC AUTOMATED TESTS ONLY. This CLI is never part of the application bundle. */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runCalibration } from '../src/simulation/__tests__/calibration-harness';

function parseArguments(args: readonly string[]) {
  const options: { matchesPerScenario?: number; seedStart?: number; output?: string } = {};
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const argument = args[index];
    const value = args[index + 1];
    if (!argument || !['--matches', '--seed-start', '--output'].includes(argument) || value === undefined || seen.has(argument)) throw new Error('Usage: npm run calibrate -- [--matches 400..1000] [--seed-start UINT32] [--output report.json]');
    seen.add(argument);
    if (argument === '--output') options.output = value;
    else {
      if (!/^\d+$/.test(value)) throw new Error(`${argument} must be a nonnegative integer.`);
      if (argument === '--matches') options.matchesPerScenario = Number(value);
      else options.seedStart = Number(value);
    }
  }
  return options;
}

try {
  const { output, ...options } = parseArguments(process.argv.slice(2));
  const report = runCalibration(options);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) {
    await writeFile(resolve(output), json, 'utf8');
    process.stderr.write(`Calibration report: ${resolve(output)}; ${report.acceptance.passedCount}/${report.acceptance.outcomeCount} design targets passed.\n`);
  } else process.stdout.write(json);
  if (!report.acceptance.passed) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
