import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Locator, type Page } from '@playwright/test';
import type { MatchArchive } from '../src/persistence/match';
import type { SaveEnvelope } from '../src/persistence/save-format';
import sourcePool from '../src/reference/exhibition-snapshot.json' with { type: 'json' };

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
    expect.soft(runtimeErrors, 'No uncaught match application errors.').toEqual([]);
    expect.soft(externalRequests, 'Exhibition gameplay must remain local.').toEqual([]);
  }, { auto: true }],
});

function centre(page: Page): Locator {
  return page.getByRole('region', { name: 'Exhibition Match Centre', exact: true });
}

async function beginCareer(page: Page) {
  await page.goto(APP_URL);
  await expect(page.getByRole('heading', { name: 'Choose your club', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Arsenal FC.*England/ }).click();
  await page.getByRole('button', { name: 'Begin career', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Manager.s desk/, level: 1 })).toBeVisible();
}

async function openMatchday(page: Page) {
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Matchday', exact: true }).click();
  await expect(centre(page).getByRole('heading', { name: 'Match Centre', level: 1 })).toBeVisible();
  await expect(centre(page).getByText('Opening local exhibition archives…', { exact: true })).toHaveCount(0);
}

async function prepareMatch(page: Page, seed = 777) {
  await openMatchday(page);
  const match = centre(page);
  await match.getByRole('spinbutton', { name: 'Match seed', exact: true }).fill(String(seed));
  await match.getByRole('checkbox', { name: /Use uniform 10\/20 exhibition estimates/ }).check();
  await match.getByRole('button', { name: 'Prepare exhibition match', exact: true }).click();
  await expect(match.getByText('0′ · Ready for kick-off', { exact: true })).toBeVisible();
}

async function advance(page: Page, minute: number) {
  const label = minute === 15 ? 'Kick off · advance to 15′' : `Advance to ${minute}′`;
  await centre(page).getByRole('button', { name: label, exact: true }).click();
  await expect(centre(page).getByRole('status')).toContainText(`Saved the ${minute}′ checkpoint`);
}

async function downloadJson<T>(page: Page, label: 'Export save' | 'Export match archive'): Promise<T> {
  const downloaded = page.waitForEvent('download');
  const scope = label === 'Export match archive' ? centre(page) : page;
  await scope.getByRole('button', { name: label, exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  return JSON.parse(await readFile(path!, 'utf8')) as T;
}

async function importArchive(page: Page, input: unknown) {
  await centre(page).locator('input[type="file"][aria-label="Import match archive file"]').setInputFiles({
    name: 'automated-browser-test-match.json',
    mimeType: 'application/json',
    buffer: Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)),
  });
}

async function matchReport(page: Page) {
  const match = centre(page);
  await match.getByRole('combobox', { name: 'Commentary event filter', exact: true }).selectOption('all');
  return {
    score: await match.locator('[aria-label^="Score "]').getAttribute('aria-label'),
    statistics: await match.getByRole('table', { name: 'Statistics derived from the authoritative match event log' }).locator('tbody tr').allTextContents(),
    homePlayers: await match.getByRole('region', { name: 'Home match squad', exact: true }).locator('tbody tr').allTextContents(),
    awayPlayers: await match.getByRole('region', { name: 'Away match squad', exact: true }).locator('tbody tr').allTextContents(),
    events: await match.getByRole('list', { name: 'Authoritative match events', exact: true }).getByRole('listitem').allTextContents(),
  };
}

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical').map(item => ({
    id: item.id,
    nodes: item.nodes.map(node => ({ target: node.target, reason: node.failureSummary })),
  }));
  expect.soft(violations, `No serious or critical accessibility violations: ${label}`).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
}

test('explicit exhibition assumptions use real identities without changing the career database', async ({ page }) => {
  await beginCareer(page);
  const careerBefore = await downloadJson<SaveEnvelope>(page, 'Export save');
  await openMatchday(page);
  const match = centre(page);
  await expect(match.getByText('32 catalogue identities available', { exact: true })).toBeVisible();
  await expect(match.getByRole('checkbox', { name: /Use uniform 10\/20 exhibition estimates/ })).not.toBeChecked();
  await expect(match.getByRole('button', { name: 'Prepare exhibition match', exact: true })).toBeDisabled();
  await match.getByRole('spinbutton', { name: 'Match seed', exact: true }).fill('24680');
  await match.getByRole('spinbutton', { name: 'Starting condition', exact: true }).fill('93');
  await match.getByRole('spinbutton', { name: 'Starting morale', exact: true }).fill('65');
  await match.getByRole('combobox', { name: 'Home setup formation', exact: true }).selectOption('4-4-2');
  await match.getByRole('combobox', { name: 'Away setup formation', exact: true }).selectOption('4-2-3-1');
  await match.getByRole('combobox', { name: 'Home setup mentality', exact: true }).selectOption('attacking');
  await match.getByRole('checkbox', { name: 'Home action advantage (4%)', exact: true }).check();
  const baseline = match.getByRole('checkbox', { name: /Use uniform 10\/20 exhibition estimates/ });
  await baseline.check();
  await expect(match.getByRole('button', { name: 'Prepare exhibition match', exact: true })).toBeEnabled();
  await baseline.uncheck();
  await expect(match.getByRole('button', { name: 'Prepare exhibition match', exact: true })).toBeDisabled();
  await baseline.check();
  await match.getByRole('button', { name: 'Prepare exhibition match', exact: true }).click();
  await expect(match.getByLabel('Score 0 to 0', { exact: true })).toBeVisible();
  await expect(match.getByText('Missing attributes: uniform 10/20', { exact: true })).toBeVisible();
  await expect(match.getByText('Exhibition selections • not real club squads.', { exact: true })).toBeVisible();

  const archive = await downloadJson<MatchArchive>(page, 'Export match archive');
  expect(archive.format).toBe('touchline-match');
  expect(archive.schemaVersion).toBe(1);
  expect(archive.commands).toEqual([]);
  expect(archive.config.seed).toBe(24680);
  expect(archive.config.home.formation).toBe('4-4-2');
  expect(archive.config.away.formation).toBe('4-2-3-1');
  expect(archive.config.home.instructions.mentality).toBe('attacking');
  expect(archive.config.homeAdvantage).toBe(0.04);
  expect(archive.config.assessmentMode).toBe('uniform-missing-10');
  const participants = [...archive.config.home.players, ...archive.config.away.players];
  expect(new Set(participants.map(player => player.id)).size).toBe(participants.length);
  for (const player of participants) {
    const source = sourcePool.players.find(record => record.id === player.id);
    expect(source?.name).toBe(player.name);
    expect(player.initialCondition).toBe(93);
    expect(player.initialMorale).toBe(65);
    expect(Object.values(player.attributes).flatMap(group => Object.values(group)).every(value => value === 10)).toBe(true);
  }
  expect(archive).not.toHaveProperty('score');
  expect(archive).not.toHaveProperty('events');
  const careerAfter = await downloadJson<SaveEnvelope>(page, 'Export save');
  expect(careerAfter.career).toEqual(careerBefore.career);
  expect(careerAfter.snapshot).toEqual(careerBefore.snapshot);
});

test('checkpoint play produces statistics, fatigue, authoritative tactics and a fresh substitute', async ({ page }, testInfo) => {
  await beginCareer(page);
  await prepareMatch(page);
  const match = centre(page);
  const home = match.getByRole('region', { name: 'Home match squad', exact: true });
  await expect(home.locator('tbody tr').first().locator('td').nth(2)).toHaveText('100.0');
  await advance(page, 15);
  await expect(match.getByText('15′ · Touchline checkpoint', { exact: true })).toBeVisible();
  const passes = match.getByRole('table', { name: 'Statistics derived from the authoritative match event log' }).getByRole('row').filter({ hasText: 'Passes completed / attempted' });
  const homePasses = Number((await passes.locator('td').first().innerText()).split('/')[1]);
  const awayPasses = Number((await passes.locator('td').last().innerText()).split('/')[1]);
  expect(homePasses + awayPasses).toBeGreaterThan(0);
  const goalkeeperCondition = Number(await home.locator('tbody tr').first().locator('td').nth(2).innerText());
  expect(goalkeeperCondition).toBeLessThan(100);
  await match.getByRole('combobox', { name: 'Commentary event filter', exact: true }).selectOption('all');
  const eventLog = match.getByRole('list', { name: 'Authoritative match events', exact: true });
  expect(await eventLog.getByRole('listitem').count()).toBeGreaterThan(10);
  await expect(eventLog).toContainText('FATIGUE');

  await home.getByText('Home touchline controls', { exact: true }).click();
  await home.getByRole('combobox', { name: 'Home live formation', exact: true }).selectOption('3-5-2');
  await home.getByRole('combobox', { name: 'Home live mentality', exact: true }).selectOption('attacking');
  await home.getByRole('combobox', { name: 'Home live tempo', exact: true }).selectOption('fast');
  await home.getByRole('button', { name: 'Apply home tactics', exact: true }).click();
  await expect(match.getByRole('status')).toContainText('Tactical change applied and saved');
  await expect(eventLog).toContainText('TACTICS CHANGED');
  await expect(eventLog).toContainText('switch to 3-5-2');
  await home.getByText('Home touchline controls', { exact: true }).click();
  const outControl = home.getByRole('combobox', { name: 'Home player off', exact: true });
  const inControl = home.getByRole('combobox', { name: 'Home player on', exact: true });
  const playerOutId = await outControl.inputValue();
  const playerInId = await inControl.inputValue();
  const playerOutName = (await outControl.locator('option:checked').innerText()).trim();
  const playerInName = (await inControl.locator('option:checked').innerText()).trim();
  await home.getByRole('button', { name: 'Confirm home substitution', exact: true }).click();
  await expect(match.getByRole('status')).toContainText('Substitution applied and saved');
  await expect(eventLog).toContainText(`replace ${playerOutName} with ${playerInName}`);
  const outgoing = home.getByRole('row').filter({ has: page.getByRole('cell', { name: playerOutName, exact: true }) });
  const incoming = home.getByRole('row').filter({ has: page.getByRole('cell', { name: playerInName, exact: true }) });
  await expect(outgoing.locator('td').last()).toHaveText('Off field');
  await expect(incoming.locator('td').last()).toHaveText('XI');
  await expect(incoming.locator('td').nth(2)).toHaveText('100.0');
  const outgoingCondition = await outgoing.locator('td').nth(2).innerText();
  const archive = await downloadJson<MatchArchive>(page, 'Export match archive');
  expect(archive.commands.map(command => command.type)).toEqual(['ADVANCE', 'CHANGE_TACTICS', 'SUBSTITUTE']);
  expect(archive.commands[2]).toEqual({ type: 'SUBSTITUTE', team: 'home', playerOutId, playerInId });
  expect(archive.config.home.formation).toBe('4-3-3');
  await advance(page, 30);
  expect(Number(await incoming.locator('td').nth(2).innerText())).toBeLessThan(100);
  await expect(outgoing.locator('td').nth(2)).toHaveText(outgoingCondition);
  await expect(match.getByText('Missing attributes: uniform 10/20', { exact: true })).toBeVisible();
  await match.getByRole('button', { name: 'Advance to 45′', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('touchline-milestone-2.png'), fullPage: false });
});

test('match archives replay exactly after reload and in a clean browser, then resume to full time', async ({ page, browser, observe }) => {
  test.setTimeout(60_000);
  await beginCareer(page);
  await prepareMatch(page, 424242);
  await advance(page, 15);
  const home = centre(page).getByRole('region', { name: 'Home match squad', exact: true });
  await home.getByText('Home touchline controls', { exact: true }).click();
  await home.getByRole('combobox', { name: 'Home live mentality', exact: true }).selectOption('defensive');
  await home.getByRole('button', { name: 'Apply home tactics', exact: true }).click();
  await expect(centre(page).getByRole('status')).toContainText('Tactical change applied and saved');
  await advance(page, 30);
  const originalReport = await matchReport(page);
  const originalArchive = await downloadJson<MatchArchive>(page, 'Export match archive');
  await page.reload();
  await expect(page.getByRole('heading', { name: /Manager.s desk/, level: 1 })).toBeVisible();
  await openMatchday(page);
  await expect(centre(page).getByText('30′ · Touchline checkpoint', { exact: true })).toBeVisible();
  expect(await matchReport(page)).toEqual(originalReport);
  expect(await downloadJson<MatchArchive>(page, 'Export match archive')).toEqual(originalArchive);

  const freshContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const restoredPage = await freshContext.newPage();
    observe(restoredPage);
    await beginCareer(restoredPage);
    await openMatchday(restoredPage);
    await expect(centre(restoredPage).getByRole('button', { name: 'Prepare exhibition match', exact: true })).toBeVisible();
    await importArchive(restoredPage, originalArchive);
    await expect(centre(restoredPage).getByRole('status')).toContainText('Exhibition archive validated, replayed and saved');
    expect(await matchReport(restoredPage)).toEqual(originalReport);
    expect(await downloadJson<MatchArchive>(restoredPage, 'Export match archive')).toEqual(originalArchive);
    await advance(page, 45);
    await advance(restoredPage, 45);
    expect(await matchReport(restoredPage)).toEqual(await matchReport(page));
    const resumed = await downloadJson<MatchArchive>(restoredPage, 'Export match archive');
    const continued = await downloadJson<MatchArchive>(page, 'Export match archive');
    expect(resumed.config).toEqual(continued.config);
    expect(resumed.commands).toEqual(continued.commands);
  } finally {
    await freshContext.close();
  }

  for (const minute of [60, 75, 90]) await advance(page, minute);
  await expect(centre(page).getByText('90′ · Full time', { exact: true })).toBeVisible();
  await expect(centre(page).getByRole('button', { name: 'Match complete', exact: true })).toBeDisabled();
  await expect(centre(page).getByRole('list', { name: 'Authoritative match events', exact: true })).toContainText('FULL TIME');
  const finalHome = centre(page).getByRole('region', { name: 'Home match squad', exact: true });
  await finalHome.getByText('Home touchline controls', { exact: true }).click();
  await expect(finalHome.getByRole('button', { name: 'Confirm home substitution', exact: true })).toBeDisabled();
  await expect(finalHome.getByRole('button', { name: 'Apply home tactics', exact: true })).toBeDisabled();
  const finished = await downloadJson<MatchArchive>(page, 'Export match archive');
  expect(finished.commands.filter(command => command.type === 'ADVANCE')).toHaveLength(6);
  expect(finished.config).toEqual(originalArchive.config);
});

test('invalid JSON, future versions and forged derived results preserve the paused exhibition and career', async ({ page }) => {
  await beginCareer(page);
  const careerBefore = await downloadJson<SaveEnvelope>(page, 'Export save');
  await prepareMatch(page);
  await advance(page, 15);
  const archiveBefore = await downloadJson<MatchArchive>(page, 'Export match archive');
  const reportBefore = await matchReport(page);
  const cases = [
    { input: '{broken automated match archive', message: /Match archive is not valid JSON/ },
    { input: { ...archiveBefore, schemaVersion: 999 }, message: /Unsupported match archive version 999/ },
    { input: { ...archiveBefore, engineVersion: 999 }, message: /Unsupported match engine version 999/ },
    { input: { ...archiveBefore, score: { home: 99, away: 0 } }, message: /Unrecognized key|unrecognized_keys/ },
  ];
  for (const invalid of cases) {
    await importArchive(page, invalid.input);
    await expect(centre(page).getByRole('alert')).toContainText(invalid.message);
    expect(await matchReport(page)).toEqual(reportBefore);
    expect(await downloadJson<MatchArchive>(page, 'Export match archive')).toEqual(archiveBefore);
  }
  const careerAfter = await downloadJson<SaveEnvelope>(page, 'Export save');
  expect(careerAfter.career).toEqual(careerBefore.career);
  expect(careerAfter.snapshot).toEqual(careerBefore.snapshot);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Manager.s desk/, level: 1 })).toBeVisible();
  await openMatchday(page);
  await expect(centre(page).getByText('15′ · Touchline checkpoint', { exact: true })).toBeVisible();
  expect(await downloadJson<MatchArchive>(page, 'Export match archive')).toEqual(archiveBefore);
});

test('match setup, paused reports and expanded touchline controls are accessible at desktop and compact widths', async ({ page }) => {
  test.setTimeout(60_000);
  await beginCareer(page);
  await openMatchday(page);
  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, `setup ${width}px`);
  }
  await centre(page).getByRole('checkbox', { name: /Use uniform 10\/20 exhibition estimates/ }).focus();
  await page.keyboard.press('Space');
  await expect(centre(page).getByRole('checkbox', { name: /Use uniform 10\/20 exhibition estimates/ })).toBeChecked();
  await centre(page).getByRole('button', { name: 'Prepare exhibition match', exact: true }).click();
  await expect(centre(page).getByText('0′ · Ready for kick-off', { exact: true })).toBeVisible();
  await advance(page, 15);
  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, `paused report ${width}px`);
    for (const side of ['Home', 'Away']) {
      const panel = centre(page).getByRole('region', { name: `${side} match squad`, exact: true });
      await panel.getByText(`${side} touchline controls`, { exact: true }).click();
      const assignments = panel.locator('summary').filter({ hasText: /^Player assignments/ });
      if (!await assignments.evaluate(element => element.parentElement?.hasAttribute('open'))) await assignments.click();
      await expect(panel.getByRole('combobox', { name: `${side} live slot 1 player`, exact: true })).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page, `expanded touchline controls ${width}px`);
    for (const side of ['Home', 'Away']) {
      await centre(page).getByRole('region', { name: `${side} match squad`, exact: true }).getByText(`${side} touchline controls`, { exact: true }).click();
    }
  }
});
