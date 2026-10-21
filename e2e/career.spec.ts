/** Career figures are explicit generic game inputs, not real club or player finances. */
import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Locator, type Page } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:4181';
type ArchiveCommand = { type: string; [key: string]: unknown };
interface BrowserArchive {
  format: 'touchline-season-demo';
  schemaVersion: number;
  engineVersion: 1;
  matchEngineVersion: 1;
  careerEngineVersion?: 1;
  id: string;
  updatedAt: string;
  scenario: Record<string, unknown>;
  careerStartCommandIndex?: number;
  commands: ArchiveCommand[];
}

const test = base.extend<{ observe: (page: Page) => Promise<void> }>({
  observe: [async ({ page }, use) => {
    const runtimeErrors: string[] = [];
    const externalRequests: string[] = [];
    const observe = async (observed: Page) => {
      observed.on('pageerror', error => runtimeErrors.push(error.message));
      observed.on('request', request => {
        if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== APP_URL) externalRequests.push(request.url());
      });
      await observed.addInitScript(() => {
        const opened: string[] = [];
        Object.defineProperty(window, '__touchlineCareerOpenedDatabases', { value: opened });
        const originalOpen = indexedDB.open.bind(indexedDB);
        indexedDB.open = (name: string, version?: number) => {
          opened.push(name);
          return version === undefined ? originalOpen(name) : originalOpen(name, version);
        };
      });
    };
    await observe(page);
    await use(observe);
    expect.soft(runtimeErrors, 'No uncaught career-management errors.').toEqual([]);
    expect.soft(externalRequests, 'Generic career management stays on this device.').toEqual([]);
  }, { auto: true }],
});

function workspace(page: Page): Locator {
  return page.getByRole('main', { name: 'Development demo workspace', exact: true });
}

async function expectIsolatedStorage(page: Page) {
  const audit = await page.evaluate(async () => ({
    opened: (window as unknown as { __touchlineCareerOpenedDatabases: string[] }).__touchlineCareerOpenedDatabases,
    present: (await indexedDB.databases()).map(database => database.name),
  }));
  expect(audit.opened.length).toBeGreaterThan(0);
  expect(audit.opened.every(name => name === 'touchline-season-demo')).toBe(true);
  expect(audit.present.every(name => name === 'touchline-season-demo')).toBe(true);
}

async function openView(page: Page, name: 'Club' | 'Squad' | 'Finances' | 'Fixtures' | 'League table' | 'Matchday') {
  const button = page.getByRole('navigation', { name: 'Demo workspace views', exact: true }).getByRole('button', { name, exact: true });
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

async function startCareer(page: Page) {
  await page.goto(APP_URL);
  await expect(workspace(page).getByRole('heading', { name: 'Start a demo season', exact: true })).toBeVisible();
  await workspace(page).getByRole('spinbutton', { name: 'Demo seed', exact: true }).fill('12345');
  await workspace(page).getByLabel('Demo start date', { exact: true }).fill('2026-10-16');
  await workspace(page).getByLabel('First demo matchday', { exact: true }).fill('2026-10-17');
  await workspace(page).getByRole('button', { name: 'Start demo season', exact: true }).click();
  await expectProgress(page, 0);
}

async function expectProgress(page: Page, rounds: number) {
  const progress = workspace(page).getByLabel('Demo season progress', { exact: true });
  await expect(progress.getByText(`${rounds} / 38`, { exact: true })).toBeVisible();
  await expect(progress.getByText(`${rounds * 10} / 380`, { exact: true })).toBeVisible();
  await expect(workspace(page).getByRole('button', { name: 'Export demo backup', exact: true })).toBeEnabled();
}

async function downloadArchive(page: Page): Promise<BrowserArchive> {
  const downloadEvent = page.waitForEvent('download');
  await workspace(page).getByRole('button', { name: 'Export demo backup', exact: true }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  return JSON.parse(await readFile(path!, 'utf8')) as BrowserArchive;
}

async function importArchive(page: Page, candidate: unknown) {
  await workspace(page).locator('input[type="file"][aria-label="Import demo backup file"]').setInputFiles({
    name: 'career-demo-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(candidate)),
  });
}

function moneyMinor(text: string): number {
  const amount = Number.parseFloat(text.replaceAll('−', '-').replace(/[^\d.-]/g, ''));
  expect(Number.isFinite(amount), `A visible amount must be parseable: ${text}`).toBe(true);
  return Math.round(amount * 100);
}

async function expectMoney(page: Page, label: string, pounds: number) {
  const value = workspace(page).getByLabel(label, { exact: true });
  await expect(value).toBeVisible();
  await expect.poll(async () => moneyMinor(await value.innerText())).toBe(Math.round(pounds * 100));
}

function ledger(page: Page): Locator {
  return workspace(page).getByRole('table', { name: 'Managed club transaction history', exact: true });
}

async function openPlayer(page: Page) {
  await openView(page, 'Squad');
  await workspace(page).getByRole('table', { name: 'Managed demo club squad', exact: true }).getByRole('button', { name: 'Demo 01 Player 01', exact: true }).click();
  await expect(workspace(page).getByRole('heading', { name: 'Demo 01 Player 01', exact: true })).toBeVisible();
}

async function demoAction(page: Page, action: Locator) {
  await expect(action).toBeEnabled();
  const before = await workspace(page).innerText();
  await action.click();
  await expect.poll(() => workspace(page).innerText(), { timeout: 15_000 }).not.toBe(before);
  await expect(workspace(page).getByRole('button', { name: 'Export demo backup', exact: true })).toBeEnabled();
}

async function finishRound(page: Page, round: number) {
  for (let decisions = 0; decisions < 48; decisions++) {
    if (await workspace(page).getByLabel('Demo season progress', { exact: true }).getByText(`${round} / 38`, { exact: true }).isVisible()) return;
    let action: Locator | undefined;
    for (const name of ['Replay abandoned fixture', 'Advance calendar to matchday', 'Start league match', 'Kick off league match · advance to 15′', 'Complete round & advance league']) {
      const candidate = workspace(page).getByRole('button', { name, exact: true });
      if (await candidate.isVisible()) { action = candidate; break; }
    }
    if (!action) {
      const advance = workspace(page).getByRole('button', { name: /^Advance league match to \d+′$/ });
      if (await advance.isVisible()) action = advance;
    }
    expect(action, `A legal football decision should progress career round ${round}.`).toBeDefined();
    await demoAction(page, action!);
  }
  throw new Error(`Career round ${round} exceeded its bounded decision budget.`);
}

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations.filter(item => item.impact === 'serious' || item.impact === 'critical').map(item => ({ id: item.id, nodes: item.nodes.map(node => ({ target: node.target, reason: node.failureSummary })) }));
  expect.soft(violations, `No serious or critical accessibility violations: ${label}`).toEqual([]);
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body).toBeLessThanOrEqual(widths.viewport);
}

test('generic contracts renew within the wage budget and an unaffordable offer preserves the checkpoint', async ({ page }) => {
  await startCareer(page);
  await openView(page, 'Finances');
  await expect(workspace(page).getByRole('heading', { name: 'Club finances', exact: true })).toBeVisible();
  await expectMoney(page, 'Club balance', 5_000_000);
  await expectMoney(page, 'Transfer budget', 1_000_000);
  await expectMoney(page, 'Weekly wage budget', 80_000);
  await expectMoney(page, 'Weekly wage commitments', 16_000);
  await expectMoney(page, 'Wage budget remaining', 64_000);
  await expectMoney(page, 'Income received', 0);
  await expectMoney(page, 'Spending paid', 0);
  const initial = await downloadArchive(page);
  expect(initial.schemaVersion).toBe(2);
  expect(initial.careerEngineVersion).toBe(1);
  expect(initial.careerStartCommandIndex).toBe(0);
  await openPlayer(page);
  await expectMoney(page, 'Weekly wage', 1_000);
  await expect(workspace(page).getByLabel('Contract expiry', { exact: true })).toContainText('2028');
  const renewal = workspace(page).getByRole('form', { name: 'Renew player contract', exact: true });
  await renewal.getByRole('textbox', { name: 'New weekly wage (£)', exact: true }).fill('1200');
  await renewal.getByLabel('New contract expiry', { exact: true }).fill('2029-10-16');
  await renewal.getByRole('button', { name: 'Renew contract', exact: true }).click();
  await expectMoney(page, 'Weekly wage', 1_200);
  await expect(workspace(page).getByLabel('Contract expiry', { exact: true })).toContainText('2029');
  const renewed = await downloadArchive(page);
  expect(renewed.commands).toHaveLength(initial.commands.length + 1);
  expect(renewed.commands.at(-1)).toMatchObject({ type: 'NEGOTIATE_CONTRACT', negotiationVersion: 1, playerId: 'demo-player-01-01', weeklyWageMinor: 120_000, endDate: '2029-10-16', signingBonusMinor: 0 });
  await openView(page, 'Finances');
  await expectMoney(page, 'Weekly wage commitments', 16_200);
  await expectMoney(page, 'Wage budget remaining', 63_800);
  await expectMoney(page, 'Club balance', 5_000_000);
  await expectMoney(page, 'Spending paid', 0);
  await openPlayer(page);
  await renewal.getByRole('textbox', { name: 'New weekly wage (£)', exact: true }).fill('90000');
  await renewal.getByLabel('New contract expiry', { exact: true }).fill('2030-10-16');
  await renewal.getByRole('button', { name: 'Renew contract', exact: true }).click();
  await expect(workspace(page).getByRole('alert')).toContainText(/budget/i);
  await expectMoney(page, 'Weekly wage', 1_200);
  expect(await downloadArchive(page)).toEqual(renewed);
  await page.reload();
  await expectProgress(page, 0);
  await openPlayer(page);
  await expectMoney(page, 'Weekly wage', 1_200);
  await expect(workspace(page).getByLabel('Contract expiry', { exact: true })).toContainText('2029');
  expect(await downloadArchive(page)).toEqual(renewed);
  await expectIsolatedStorage(page);
});

test('a lower wage needs accepted circumstances and a funded signing bonus survives repeated restore without duplicate payment', async ({ page, browser, observe }) => {
  test.setTimeout(90_000);
  await startCareer(page);
  const initial = await downloadArchive(page);
  await openPlayer(page);
  const renewal = workspace(page).getByRole('form', { name: 'Renew player contract', exact: true });
  await renewal.getByRole('textbox', { name: 'New weekly wage (£)', exact: true }).fill('900');
  await renewal.getByLabel('New contract expiry', { exact: true }).fill('2029-10-16');
  await renewal.getByRole('textbox', { name: 'Guaranteed signing bonus (£)', exact: true }).fill('0');
  await renewal.getByRole('button', { name: 'Renew contract', exact: true }).click();
  await expect(workspace(page).getByRole('alert')).toBeVisible();
  await expectMoney(page, 'Weekly wage', 1_000);
  expect(await downloadArchive(page)).toEqual(initial);
  // The manager cannot simply label a healthy club as distressed or invent a player age.
  await expect(renewal.getByRole('checkbox')).toHaveCount(0);
  await renewal.getByRole('textbox', { name: 'Guaranteed signing bonus (£)', exact: true }).fill('20000');
  await renewal.getByRole('button', { name: 'Renew contract', exact: true }).click();
  await expectMoney(page, 'Weekly wage', 900);
  const accepted = await downloadArchive(page);
  expect(accepted.commands.at(-1)).toMatchObject({ type: 'NEGOTIATE_CONTRACT', negotiationVersion: 1, playerId: 'demo-player-01-01', weeklyWageMinor: 90_000, endDate: '2029-10-16', signingBonusMinor: 2_000_000 });
  await openView(page, 'Finances');
  await expectMoney(page, 'Club balance', 4_980_000);
  await expectMoney(page, 'Weekly wage commitments', 15_900);
  await expectMoney(page, 'Spending paid', 20_000);
  await expectMoney(page, 'Signing bonuses paid', 20_000);
  await expect(ledger(page).getByRole('cell', { name: 'Signing bonus', exact: true })).toHaveCount(1);
  const movements = await ledger(page).locator('tbody tr').allTextContents();
  await page.reload();
  await expectProgress(page, 0);
  await openView(page, 'Finances');
  await expectMoney(page, 'Club balance', 4_980_000);
  expect(await ledger(page).locator('tbody tr').allTextContents()).toEqual(movements);
  expect(await downloadArchive(page)).toEqual(accepted);
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const restored = await fresh.newPage();
    await observe(restored);
    await restored.goto(APP_URL);
    await expect(workspace(restored).getByRole('heading', { name: 'Start a demo season', exact: true })).toBeVisible();
    for (let restores = 0; restores < 2; restores++) {
      await importArchive(restored, accepted);
      await expectProgress(restored, 0);
      await openView(restored, 'Finances');
      await expectMoney(restored, 'Club balance', 4_980_000);
      await expectMoney(restored, 'Signing bonuses paid', 20_000);
      expect(await ledger(restored).locator('tbody tr').allTextContents()).toEqual(movements);
      expect(await downloadArchive(restored)).toEqual(accepted);
    }
    await expectIsolatedStorage(restored);
  } finally { await fresh.close(); }
  await expectIsolatedStorage(page);
});

test('weekly payroll and home income enter the ledger once and survive reload and a fresh v2 backup restore', async ({ page, browser, observe }) => {
  test.setTimeout(120_000);
  await startCareer(page);
  await openView(page, 'Fixtures');
  await workspace(page).getByRole('button', { name: 'Calendar', exact: true }).click();
  const venues = await workspace(page).getByRole('table', { name: 'All 38 weekly fixtures for the managed club', exact: true }).locator('tbody tr td:nth-child(4)').allTextContents();
  const firstHomeFixtures = venues.slice(0, 1).filter(venue => venue === 'Home').length;
  const homeFixtures = venues.slice(0, 2).filter(venue => venue === 'Home').length;
  expect(homeFixtures).toBe(1);
  const firstIncome = firstHomeFixtures * 25_000;
  const totalIncome = homeFixtures * 25_000;
  const finalBalance = 5_000_000 + totalIncome - 32_000;
  await openView(page, 'Matchday');
  await finishRound(page, 1);
  await openView(page, 'Finances');
  await expectMoney(page, 'Club balance', 5_000_000 + firstIncome);
  await expect(ledger(page).getByRole('cell', { name: 'Home match income', exact: true })).toHaveCount(firstHomeFixtures);
  await expect(ledger(page).getByRole('cell', { name: 'Wage payment', exact: true })).toHaveCount(0);
  await openView(page, 'Matchday');
  await demoAction(page, workspace(page).getByRole('button', { name: 'Advance calendar to matchday', exact: true }));
  await openView(page, 'Finances');
  await expectMoney(page, 'Club balance', 5_000_000 + firstIncome - 16_000);
  await expect(ledger(page).getByRole('cell', { name: 'Wage payment', exact: true })).toHaveCount(1);
  await openView(page, 'Matchday');
  await finishRound(page, 2);
  await demoAction(page, workspace(page).getByRole('button', { name: 'Advance calendar to matchday', exact: true }));
  await expectProgress(page, 2);
  await openView(page, 'Finances');
  await expectMoney(page, 'Club balance', finalBalance);
  await expectMoney(page, 'Income received', totalIncome);
  await expectMoney(page, 'Spending paid', 32_000);
  await expect(ledger(page).getByRole('cell', { name: 'Wage payment', exact: true })).toHaveCount(2);
  await expect(ledger(page).getByRole('cell', { name: 'Home match income', exact: true })).toHaveCount(homeFixtures);
  const amounts = await ledger(page).locator('tbody tr td:nth-child(3)').allTextContents();
  expect(amounts.reduce((sum, amount) => sum + moneyMinor(amount), 0)).toBe((finalBalance - 5_000_000) * 100);
  const transactions = await ledger(page).locator('tbody tr').allTextContents();
  const archive = await downloadArchive(page);
  expect(archive.schemaVersion).toBe(2);
  expect(archive).not.toHaveProperty('ledger');
  expect(archive).not.toHaveProperty('balances');
  await page.reload();
  await expectProgress(page, 2);
  await openView(page, 'Finances');
  await expectMoney(page, 'Club balance', finalBalance);
  expect(await ledger(page).locator('tbody tr').allTextContents()).toEqual(transactions);
  expect(await downloadArchive(page)).toEqual(archive);
  await expectIsolatedStorage(page);

  const fresh = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const restored = await fresh.newPage();
    await observe(restored);
    await restored.goto(APP_URL);
    await expect(workspace(restored).getByRole('heading', { name: 'Start a demo season', exact: true })).toBeVisible();
    for (let imports = 0; imports < 2; imports++) {
      await importArchive(restored, archive);
      await expectProgress(restored, 2);
      await openView(restored, 'Finances');
      await expectMoney(restored, 'Club balance', finalBalance);
      expect(await ledger(restored).locator('tbody tr').allTextContents()).toEqual(transactions);
      expect(await downloadArchive(restored)).toEqual(archive);
    }
    await expectIsolatedStorage(restored);
  } finally { await fresh.close(); }
});

test('enabling career management for a progressed v1 save preserves football and begins without retroactive charges', async ({ page }) => {
  test.setTimeout(90_000);
  await startCareer(page);
  await openView(page, 'Matchday');
  await finishRound(page, 1);
  await demoAction(page, workspace(page).getByRole('button', { name: 'Advance calendar to matchday', exact: true }));
  await expectProgress(page, 1);
  const progress = await workspace(page).getByLabel('Demo season progress', { exact: true }).innerText();
  await openView(page, 'League table');
  const table = workspace(page).getByRole('table', { name: 'League standings from committed full-time results', exact: true });
  const standings = await table.locator('tbody tr').allTextContents();
  const baseArchive = await downloadArchive(page);
  // Construct exactly the historical eight fields. Retaining v2-only fields
  // while changing the version marker would be an invalid legacy backup.
  const legacy: BrowserArchive = {
    format: baseArchive.format, schemaVersion: 1, engineVersion: baseArchive.engineVersion,
    matchEngineVersion: baseArchive.matchEngineVersion, id: baseArchive.id, updatedAt: baseArchive.updatedAt,
    scenario: baseArchive.scenario, commands: baseArchive.commands,
  };
  expect(Object.keys(legacy)).toHaveLength(8);
  await importArchive(page, legacy);
  await expectProgress(page, 1);
  await openView(page, 'Finances');
  await expect(workspace(page).getByRole('heading', { name: 'Career management is not enabled', exact: true })).toBeVisible();
  expect(await downloadArchive(page)).toEqual(legacy);
  await workspace(page).getByRole('button', { name: 'Enable career management', exact: true }).click();
  await expect(workspace(page).getByRole('heading', { name: 'Club finances', exact: true })).toBeVisible();
  await expectMoney(page, 'Club balance', 5_000_000);
  await expectMoney(page, 'Income received', 0);
  await expectMoney(page, 'Spending paid', 0);
  await expectMoney(page, 'Accrued wages', 0);
  await expect(ledger(page).getByRole('cell', { name: 'Wage payment', exact: true })).toHaveCount(0);
  await expect(ledger(page).getByRole('cell', { name: 'Home match income', exact: true })).toHaveCount(0);
  expect(await workspace(page).getByLabel('Demo season progress', { exact: true }).innerText()).toEqual(progress);
  const enabled = await downloadArchive(page);
  expect(enabled.schemaVersion).toBe(2);
  expect(enabled.careerEngineVersion).toBe(1);
  expect(enabled.careerStartCommandIndex).toBe(legacy.commands.length);
  expect(enabled.commands).toEqual(legacy.commands);
  await page.reload();
  await expectProgress(page, 1);
  await openView(page, 'League table');
  expect(await table.locator('tbody tr').allTextContents()).toEqual(standings);
  expect(await workspace(page).getByLabel('Demo season progress', { exact: true }).innerText()).toEqual(progress);
  expect(await downloadArchive(page)).toEqual(enabled);
  await expectIsolatedStorage(page);
});

test('future versions and forged financial state cannot replace a valid career checkpoint', async ({ page }) => {
  await startCareer(page);
  const before = await downloadArchive(page);
  for (const candidate of [
    { ...before, schemaVersion: 999 },
    { ...before, schemaVersion: 1 },
    { ...before, balances: { 'demo-club-01': 999_999_999_999 } },
    { ...before, ledger: [{ kind: 'matchday-income', amountMinor: 999_999_999 }] },
  ]) {
    await importArchive(page, candidate);
    await expect(workspace(page).getByRole('alert')).toBeVisible();
    expect(await downloadArchive(page)).toEqual(before);
  }
  await page.reload();
  await expectProgress(page, 0);
  await openView(page, 'Finances');
  await expectMoney(page, 'Club balance', 5_000_000);
  expect(await downloadArchive(page)).toEqual(before);
  await expectIsolatedStorage(page);
});

test('finance summaries, ledger and contract forms are accessible at desktop and compact widths', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await startCareer(page);
  await openView(page, 'Matchday');
  await finishRound(page, 1);
  await openView(page, 'Finances');
  await expect(ledger(page)).toBeVisible();
  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await expectAccessible(page, `career finances ${width}px`);
  }
  await openPlayer(page);
  await expect(workspace(page).getByRole('form', { name: 'Renew player contract', exact: true })).toBeVisible();
  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await expectAccessible(page, `career contract renewal ${width}px`);
  }
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.screenshot({ path: testInfo.outputPath('touchline-career-player-contract.png'), fullPage: false });
  await expectIsolatedStorage(page);
});
