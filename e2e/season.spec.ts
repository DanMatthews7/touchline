/** SYNTHETIC AUTOMATED TESTS ONLY. Any positive roster fixtures are uploaded only by these tests. */
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Locator, type Page } from '@playwright/test';
import type { SaveEnvelope } from '../src/persistence/save-format';
import type { SeasonArchive } from '../src/persistence/season';
import { syntheticSeasonInputs } from '../src/persistence/season/__tests__/fixtures';

const APP_URL = 'http://127.0.0.1:4173';

const test = base.extend<{ observe: (page: Page) => void }>({
  observe: [async ({ page }, use) => {
    const runtimeErrors: string[] = [];
    const externalRequests: string[] = [];
    const observe = (observed: Page) => {
      observed.on('pageerror', error => runtimeErrors.push(error.message));
      observed.on('request', request => {
        if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== APP_URL) externalRequests.push(request.url());
      });
    };
    observe(page);
    await use(observe);
    expect.soft(runtimeErrors, 'No uncaught season application errors.').toEqual([]);
    expect.soft(externalRequests, 'Season workflows stay local.').toEqual([]);
  }, { auto: true }],
});

function workspace(page: Page): Locator {
  return page.getByRole('region', { name: 'League season workspace', exact: true });
}

async function beginCareer(page: Page) {
  await page.goto(APP_URL);
  await expect(page.getByRole('heading', { name: 'Choose your club', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Arsenal FC.*England/ }).click();
  await page.getByRole('button', { name: 'Begin career', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Manager.s desk/, level: 1 })).toBeVisible();
}

async function openSeason(page: Page, view: 'Fixtures' | 'Competitions' | 'Matchday' = 'Fixtures') {
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: view, exact: true }).click();
  if (view === 'Matchday') await page.getByRole('group', { name: 'Matchday mode', exact: true }).getByRole('button', { name: 'League season', exact: true }).click();
  await expect(workspace(page)).toBeVisible();
  await expect(workspace(page).getByText('Opening the season workspace…', { exact: true })).toHaveCount(0);
}

async function downloadSeason(page: Page): Promise<SeasonArchive> {
  const downloadEvent = page.waitForEvent('download');
  await workspace(page).getByRole('button', { name: 'Export season backup', exact: true }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  return JSON.parse(await readFile(path!, 'utf8')) as SeasonArchive;
}

async function importSeason(page: Page, input: unknown) {
  await workspace(page).locator('input[type="file"][aria-label="Import season backup file"]').setInputFiles({
    name: 'synthetic-automated-season-backup.json', mimeType: 'application/json',
    buffer: Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)),
  });
}

async function createSyntheticSeason(page: Page) {
  const inputs = syntheticSeasonInputs();
  // A private provider import needs the actual local/backup uses, not public redistribution.
  for (const evidence of inputs.rosterManifest.evidence) evidence.rightsReview.permittedUses = ['local-storage', 'in-app-display', 'save-export'];
  await page.goto(APP_URL);
  await expect(page.getByRole('heading', { name: 'Choose your club', exact: true })).toBeVisible();
  await page.locator('input[type="file"][aria-label="Import database"]').setInputFiles({
    name: 'SYNTHETIC-AUTOMATED-TEST-ONLY-database.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(inputs.snapshot)),
  });
  await page.getByRole('button', { name: /SYNTHETIC AUTOMATED TEST synthetic-season-club-0.*England/ }).click();
  await page.getByRole('button', { name: 'Begin career', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Manager.s desk/, level: 1 })).toBeVisible();
  await openSeason(page);
  await workspace(page).locator('input[type="file"][aria-label="Import squad dataset file"]').setInputFiles({
    name: 'SYNTHETIC-AUTOMATED-TEST-ONLY-squads.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'touchline-squad-dataset', schemaVersion: 1, snapshot: inputs.snapshot, manifest: inputs.rosterManifest })),
  });
  await expect(workspace(page).getByText(/20 \/ 20 squads ready/)).toBeVisible();
  await workspace(page).getByRole('textbox', { name: 'League name', exact: true }).fill('SYNTHETIC AUTOMATED TEST LEAGUE');
  await workspace(page).getByLabel('First matchweek date', { exact: true }).fill('2026-10-17');
  await workspace(page).getByRole('spinbutton', { name: 'Season seed', exact: true }).fill('12345');
  await workspace(page).getByRole('checkbox', { name: /uniform 10\/20.*missing ability/ }).check();
  await workspace(page).getByRole('button', { name: 'Create league season', exact: true }).click();
  await expectProgress(page, 0);
  return inputs;
}

async function expectProgress(page: Page, rounds: number) {
  const progress = workspace(page).locator('[aria-label="Season progress"]');
  await expect(progress.getByText(`${rounds} / 38`, { exact: true })).toBeVisible();
  await expect(progress.getByText(`${rounds * 10} / 380`, { exact: true })).toBeVisible();
}

async function seasonAction(page: Page, action: Locator) {
  await expect(action).toBeEnabled();
  const before = await workspace(page).innerText();
  await action.click();
  await expect.poll(() => workspace(page).innerText(), { timeout: 15_000 }).not.toBe(before);
  await expect(workspace(page).getByRole('button', { name: 'Export season backup', exact: true })).toBeEnabled({ timeout: 15_000 });
}

async function leagueReport(page: Page) {
  const league = workspace(page);
  await league.getByRole('combobox', { name: 'League commentary filter', exact: true }).selectOption('all');
  return {
    score: await league.locator('[aria-label^="League score "]').getAttribute('aria-label'),
    statistics: await league.getByRole('table', { name: 'Home and away statistics from the match event summary', exact: true }).locator('tbody tr').allTextContents(),
    players: await league.getByRole('region', { name: /^(Home|Away) match squad$/ }).locator('tbody tr').allTextContents(),
    events: await league.getByRole('list', { name: 'League match events', exact: true }).getByRole('listitem').allTextContents(),
  };
}

/** Exercise the visible management flow, including legitimate abandonment recovery rather than rerolling finished results. */
async function finishRound(page: Page, round: number) {
  for (let decisions = 0; decisions < 48; decisions++) {
    const progress = workspace(page).locator('[aria-label="Season progress"]');
    if (await progress.getByText(`${round} / 38`, { exact: true }).isVisible()) return;
    const names = ['Replay abandoned fixture', 'Advance calendar to matchday', 'Start league match', 'Kick off league match · advance to 15′', 'Complete round & advance league'];
    let action: Locator | undefined;
    for (const name of names) {
      const candidate = workspace(page).getByRole('button', { name, exact: true });
      if (await candidate.isVisible()) { action = candidate; break; }
    }
    if (!action) {
      const advance = workspace(page).getByRole('button', { name: /^Advance league match to \d+′$/ });
      if (await advance.isVisible()) action = advance;
    }
    expect(action, `A legal visible decision must progress round ${round}.`).toBeDefined();
    await seasonAction(page, action!);
  }
  throw new Error(`Round ${round} exceeded the bounded management/replay decision budget.`);
}

async function downloadCareer(page: Page): Promise<SaveEnvelope> {
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save', exact: true }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  return JSON.parse(await readFile(path!, 'utf8')) as SaveEnvelope;
}

async function expectRosterBlocked(page: Page) {
  const season = workspace(page);
  await expect(season.getByRole('heading', { name: 'Verified roster readiness', exact: true })).toBeVisible();
  await expect(season.getByRole('button', { name: 'Create league season', exact: true })).toBeDisabled();
  await expect(season.getByRole('spinbutton', { name: 'Season seed', exact: true })).toBeDisabled();
  await expect(season.getByRole('checkbox', { name: /uniform 10\/20.*missing ability/ })).toBeDisabled();
  await expect(season.getByRole('checkbox', { name: /uniform 10\/20.*missing ability/ })).not.toBeChecked();
  await expect(season.getByText('Verified current rosters are required.', { exact: true })).toBeVisible();
  await expect(season.getByRole('checkbox', { name: /original comparison squads/ })).toHaveCount(0);
  await expect(season.getByRole('button', { name: 'Export season backup', exact: true })).toHaveCount(0);
}

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical').map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, reason: node.failureSummary })) }));
  expect.soft(violations, `No serious or critical accessibility violations: ${label}`).toEqual([]);
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
}

test('unavailable verified squads block season creation without advancing or changing the career', async ({ page }) => {
  await beginCareer(page);
  const before = await downloadCareer(page);
  for (const view of ['Fixtures', 'Competitions'] as const) {
    await openSeason(page, view);
    await expectRosterBlocked(page);
  }
  const after = await downloadCareer(page);
  expect(after.career).toEqual(before.career);
  expect(after.snapshot).toEqual(before.snapshot);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Manager.s desk/, level: 1 })).toBeVisible();
  await openSeason(page);
  await expectRosterBlocked(page);
  expect((await downloadCareer(page)).career).toEqual(before.career);
});

test('invalid season backups preserve the blocked workspace, source snapshot and career', async ({ page }) => {
  await beginCareer(page);
  const before = await downloadCareer(page);
  await openSeason(page);
  for (const invalid of [
    { serialized: '{invalid automated season backup', message: /not valid JSON/i },
    { serialized: JSON.stringify({ format: 'touchline-season', schemaVersion: 999 }), message: /Unsupported season archive version 999/i },
  ]) {
    await workspace(page).locator('input[type="file"][aria-label="Import season backup file"]').setInputFiles({ name: 'synthetic-automated-invalid-season.json', mimeType: 'application/json', buffer: Buffer.from(invalid.serialized) });
    await expect(page.getByRole('alert').filter({ hasText: invalid.message })).toBeVisible();
    await expectRosterBlocked(page);
    const after = await downloadCareer(page);
    expect(after.career).toEqual(before.career);
    expect(after.snapshot).toEqual(before.snapshot);
  }
});

test('verified-roster readiness and disabled season controls remain accessible at desktop and compact widths', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await beginCareer(page);
  await openSeason(page);
  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await expectRosterBlocked(page);
    await expectAccessible(page, `verified roster readiness ${width}px`);
  }
  await page.screenshot({ path: testInfo.outputPath('touchline-season-roster-readiness.png'), fullPage: false });
});

test('SYNTHETIC ONLY: managed decisions, atomic round results and season backups survive reload and a fresh browser', async ({ page, browser, observe }, testInfo) => {
  test.setTimeout(180_000);
  const inputs = await createSyntheticSeason(page);
  const initial = await downloadSeason(page);
  expect(initial.initialConfig.teams).toHaveLength(20);
  expect(initial.rosterManifest).toBeDefined();
  expect(initial.snapshot.players).toHaveLength(280);
  expect(initial.snapshot.players.every(player => Object.values(player.attributes).flatMap(group => Object.values(group)).every(value => value === null))).toBe(true);
  expect(initial.initialConfig.teams.every(team => team.players.every(player => Object.values(player.attributes).flatMap(group => Object.values(group)).every(value => value === 10)))).toBe(true);
  await openSeason(page, 'Competitions');
  const table = workspace(page).getByRole('table', { name: 'League standings from committed full-time results', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(20);
  expect(await table.locator('tbody tr td:nth-child(3)').allTextContents()).toEqual(Array(20).fill('0'));
  await expectAccessible(page, 'synthetic season initial standings');
  await openSeason(page, 'Matchday');
  await seasonAction(page, workspace(page).getByRole('button', { name: 'Advance calendar to matchday', exact: true }));
  await seasonAction(page, workspace(page).getByRole('button', { name: 'Start league match', exact: true }));
  await seasonAction(page, workspace(page).getByRole('button', { name: 'Kick off league match · advance to 15′', exact: true }));
  await expectProgress(page, 0);
  expect((await downloadCareer(page)).career.currentDate).toBe('2026-10-17');

  const home = workspace(page).getByRole('region', { name: 'Home match squad', exact: true });
  await home.getByText('Home touchline controls', { exact: true }).click();
  await home.getByRole('combobox', { name: 'Home live formation', exact: true }).selectOption('3-5-2');
  await home.getByRole('combobox', { name: 'Home live mentality', exact: true }).selectOption('attacking');
  await home.getByRole('button', { name: 'Apply home tactics', exact: true }).click();
  await expect(workspace(page).getByRole('list', { name: 'League match events', exact: true })).toContainText('TACTICS CHANGED');
  await home.getByText('Home touchline controls', { exact: true }).click();
  const playerOn = home.getByRole('combobox', { name: 'Home player on', exact: true });
  const incoming = initial.initialConfig.teams.find(team => team.id === initial.career.managedClubId)!.benchIds.find(id => inputs.snapshot.players.find(player => player.id === id)!.positions.some(position => position !== 'GK'))!;
  await playerOn.selectOption(incoming);
  await home.getByRole('button', { name: 'Confirm home substitution', exact: true }).click();
  await expect(workspace(page).getByRole('list', { name: 'League match events', exact: true })).toContainText('SUBSTITUTION');
  const pausedReport = await leagueReport(page);
  const paused = await downloadSeason(page);
  expect(paused.commands.slice(-2).map(command => command.type === 'MATCH_COMMAND' ? command.command.type : command.type)).toEqual(['CHANGE_TACTICS', 'SUBSTITUTE']);
  expect(paused.career.currentDate).toBe('2026-10-17');
  await page.reload();
  await expect(page.getByRole('heading', { name: /Manager.s desk/, level: 1 })).toBeVisible();
  await openSeason(page, 'Matchday');
  expect(await leagueReport(page)).toEqual(pausedReport);
  expect(await downloadSeason(page)).toEqual(paused);
  await expectProgress(page, 0);
  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await expectAccessible(page, `synthetic paused managed fixture ${width}px`);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await finishRound(page, 1);
  await expectProgress(page, 1);
  const committed = await downloadSeason(page);
  expect(committed.career.currentDate).toBe('2026-10-17');
  await openSeason(page, 'Competitions');
  expect(await workspace(page).getByRole('table', { name: 'League standings from committed full-time results', exact: true }).locator('tbody tr td:nth-child(3)').allTextContents()).toEqual(Array(20).fill('1'));
  const committedTable = await workspace(page).getByRole('table', { name: 'League standings from committed full-time results', exact: true }).locator('tbody tr').allTextContents();
  await workspace(page).getByRole('button', { name: 'Restore season', exact: true }).click();
  await expectProgress(page, 1);
  expect(await downloadSeason(page)).toEqual(committed);
  await page.screenshot({ path: testInfo.outputPath('touchline-synthetic-season-table.png'), fullPage: false });

  const fresh = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const restored = await fresh.newPage();
    observe(restored);
    await beginCareer(restored);
    await openSeason(restored);
    await importSeason(restored, committed);
    await expectProgress(restored, 1);
    await openSeason(restored, 'Competitions');
    expect(await workspace(restored).getByRole('table', { name: 'League standings from committed full-time results', exact: true }).locator('tbody tr').allTextContents()).toEqual(committedTable);
    expect(await downloadSeason(restored)).toEqual(committed);
    for (const invalid of [
      { ...committed, results: [{ score: { home: 99, away: 0 } }] },
      { ...committed, rosterManifest: { ...committed.rosterManifest, evidence: committed.rosterManifest.evidence.map((evidence, index) => index === 0 ? { ...evidence, rightsReview: { ...evidence.rightsReview, status: 'unreviewed' } } : evidence) } },
    ]) {
      await importSeason(restored, invalid);
      await expect(restored.getByRole('alert')).toBeVisible();
      await expectProgress(restored, 1);
      expect(await downloadSeason(restored)).toEqual(committed);
    }
  } finally { await fresh.close(); }
});

test('SYNTHETIC ONLY: all 38 matchweeks finish through visible controls with 380 results and balanced final totals', async ({ page }) => {
  test.setTimeout(240_000);
  await createSyntheticSeason(page);
  await openSeason(page, 'Matchday');
  for (let round = 1; round <= 38; round++) {
    await finishRound(page, round);
    await expectProgress(page, round);
  }
  await expect(workspace(page).getByText('Season complete.', { exact: true })).toBeVisible();
  await expect(workspace(page).getByRole('button', { name: 'Advance calendar to matchday', exact: true })).toHaveCount(0);
  await expect(workspace(page).getByRole('button', { name: 'Start league match', exact: true })).toHaveCount(0);
  const completed = await downloadSeason(page);
  expect(completed.career.currentDate).toBe('2027-07-03');
  expect(completed.commands.at(-1)?.type).toBe('COMPLETE_ROUND');
  await openSeason(page, 'Competitions');
  const rows = await workspace(page).getByRole('table', { name: 'League standings from committed full-time results', exact: true }).locator('tbody tr').evaluateAll(elements => elements.map(row => Array.from(row.querySelectorAll('td'), cell => cell.textContent?.trim() ?? '')));
  expect(rows).toHaveLength(20);
  let goalsFor = 0;
  let goalsAgainst = 0;
  let goalDifference = 0;
  for (const row of rows) {
    const [played, won, drawn, lost, gf, ga, gd, points] = row.slice(2).map(Number);
    expect(played).toBe(38);
    expect(won! + drawn! + lost!).toBe(38);
    expect(points).toBe(3 * won! + drawn!);
    expect(gd).toBe(gf! - ga!);
    goalsFor += gf!;
    goalsAgainst += ga!;
    goalDifference += gd!;
  }
  expect(goalsFor).toBe(goalsAgainst);
  expect(goalDifference).toBe(0);
  await openSeason(page);
  await workspace(page).getByRole('button', { name: 'Calendar', exact: true }).click();
  const calendar = workspace(page).getByRole('table', { name: 'All 38 weekly fixtures for the managed club', exact: true });
  await expect(calendar.locator('tbody tr')).toHaveCount(38);
  expect((await calendar.locator('tbody tr td:nth-child(4)').allTextContents()).filter(venue => venue === 'Home')).toHaveLength(19);
  expect((await calendar.locator('tbody tr td:nth-child(4)').allTextContents()).filter(venue => venue === 'Away')).toHaveLength(19);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Manager.s desk/, level: 1 })).toBeVisible();
  await openSeason(page, 'Matchday');
  await expectProgress(page, 38);
  await expect(workspace(page).getByText('Season complete.', { exact: true })).toBeVisible();
});
