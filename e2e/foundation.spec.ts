import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';
import type { SaveEnvelope } from '../src/persistence/save-format';

const APP_URL = 'http://127.0.0.1:4173';

/** Observe every tested page, including a separate browser context used for restore. */
const test = base.extend<{ observe: (page: Page) => void }>({
  observe: [async ({ page }, use) => {
    const runtimeErrors: string[] = [];
    const externalRequests: string[] = [];
    const observe = (observedPage: Page) => {
      observedPage.on('pageerror', error => runtimeErrors.push(error.message));
      observedPage.on('request', request => {
        if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== APP_URL) {
          externalRequests.push(request.url());
        }
      });
    };
    observe(page);
    await use(observe);
    expect.soft(runtimeErrors, 'The browser must not report uncaught application errors.').toEqual([]);
    expect.soft(externalRequests, 'Gameplay must not fetch external assets or services.').toEqual([]);
  }, { auto: true }],
});

async function beginCareer(page: Page) {
  await page.goto(APP_URL);
  await expect(page.getByRole('heading', { name: 'Choose your club', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin career', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /Arsenal FC.*England/ }).click();
  await expect(page.getByRole('button', { name: /Arsenal FC.*England/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Begin career', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Manager.s desk/ })).toBeVisible();
}

async function navigate(page: Page, name: string) {
  const label = name === 'Inbox' ? /^Inbox(?: 3)?$/ : name;
  const button = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: label, exact: typeof label === 'string' });
  await button.click();
  await expect(button).toHaveAttribute('aria-current', 'page');
}

async function openPlayer(page: Page, name: string) {
  await navigate(page, 'Squad');
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
}

async function exportCareer(page: Page): Promise<SaveEnvelope> {
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^touchline-.*\.json$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  return JSON.parse(await readFile(path!, 'utf8')) as SaveEnvelope;
}

async function uploadJson(page: Page, label: 'Import database' | 'Restore save', input: unknown, filename = 'automated-test-input.json') {
  await page.locator(`input[type="file"][aria-label="${label}"]`).setInputFiles({
    name: filename,
    mimeType: 'application/json',
    buffer: Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)),
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const violations = results.violations
    .filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
    .map(violation => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map(node => ({ target: node.target, reason: node.failureSummary })),
    }));
  expect.soft(violations, 'No serious or critical axe accessibility violations.').toEqual([]);
}

test('club selection, every primary screen, sortable reference directory and all unknown attributes', async ({ page }, testInfo) => {
  await beginCareer(page);
  await expect(page.getByRole('status')).toContainText('Career created and saved locally');
  for (const name of ['Inbox', 'Squad', 'Player Profiles', 'Tactics', 'Fixtures', 'Competitions', 'Transfers', 'Finances', 'Dashboard']) {
    await navigate(page, name);
    if (name === 'Dashboard') await expect(page.getByRole('heading', { level: 1, name: /Manager.s desk/ })).toBeVisible();
    else if (name === 'Squad') await expect(page.getByRole('heading', { level: 1, name: 'Squad & player directory' })).toBeVisible();
    else if (name === 'Player Profiles') await expect(page.getByRole('heading', { level: 1, name: 'Bukayo Saka' })).toBeVisible();
    else if (name === 'Fixtures' || name === 'Competitions') {
      await expect(page.getByRole('heading', { level: 1, name: 'Season preparation', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create league season', exact: true })).toBeDisabled();
    }
    else await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
    if (['Tactics', 'Transfers', 'Finances'].includes(name)) {
      await expect(page.getByText('Planned feature', { exact: true })).toBeVisible();
    }
  }

  await navigate(page, 'Squad');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(12);
  await expect(rows.first().getByRole('button')).toHaveText('Antoine Griezmann');
  await page.getByRole('columnheader', { name: /Player/ }).getByRole('button').click();
  await expect(page.getByRole('columnheader', { name: /Player/ })).toHaveAttribute('aria-sort', 'descending');
  await expect(rows.first().getByRole('button')).toHaveText('William Saliba');
  await page.getByRole('columnheader', { name: /^Age/ }).getByRole('button').click();
  const ages = await rows.locator('td:nth-child(3)').allTextContents();
  expect(ages.map(Number)).toEqual(ages.map(Number).sort((left, right) => left - right));

  await page.getByRole('searchbox', { name: 'Filter players by name or nationality' }).fill('sAkA');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole('button')).toHaveText('Bukayo Saka');
  await page.getByRole('searchbox').fill('');
  await page.getByRole('combobox', { name: 'Filter by position' }).selectOption('GK');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole('button')).toHaveText('Jordan Pickford');
  await page.getByRole('combobox', { name: 'Filter by position' }).selectOption('all');
  await page.getByRole('combobox', { name: 'Player directory scope' }).selectOption('club');
  await expect(rows).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No verified squad assignments.' })).toBeVisible();
  await page.getByRole('button', { name: 'View reference players', exact: true }).click();
  await expect(rows).toHaveCount(12);

  await page.getByRole('button', { name: 'Bukayo Saka', exact: true }).click();
  for (const group of ['Technical', 'Mental', 'Physical', 'Goalkeeping']) {
    await expect(page.getByRole('region', { name: group, exact: true })).toBeVisible();
  }
  await expect(page.locator('[aria-label$=": unassessed"]')).toHaveCount(45);
  await expect(page.getByLabel('Role rating unassessed', { exact: true })).toBeVisible();
  await expect(page.getByText('0/45 assessed', { exact: true })).toBeVisible();
  await expect(page.getByText('Unknown · no current squad assignment', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^(Potential|Professionalism|Current development level)$/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('touchline-review.png'), fullPage: false });
});

test('manual original GK assessment calculates 74, survives reload and exports/restores in a clean context', async ({ page, browser, observe }) => {
  await beginCareer(page);
  const original = await exportCareer(page);
  await openPlayer(page, 'Jordan Pickford');
  await page.getByRole('button', { name: 'Assess attributes', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Assess Jordan Pickford', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('spinbutton')).toHaveCount(45);
  await expect(dialog.getByLabel(/^(Potential|Professionalism|Current development level)$/i)).toHaveCount(0);
  // Deliberate automated-test estimates, not sourced claims about the real player.
  const estimates = { Reflexes: 16, Handling: 15, 'One-on-Ones': 14, 'Command of Area': 13, 'Aerial Reach': 12, Positioning: 17, Concentration: 16, Agility: 15 };
  for (const [attribute, value] of Object.entries(estimates)) {
    await dialog.getByRole('spinbutton', { name: attribute, exact: true }).fill(String(value));
  }
  const rationale = 'Automated browser test only: deliberate original game estimates exercise weighting and persistence; no real player assessment is asserted.';
  await dialog.getByRole('textbox', { name: 'Basis and uncertainty' }).fill(rationale);
  await dialog.getByRole('combobox', { name: 'Confidence' }).selectOption('low');
  await dialog.getByRole('button', { name: 'Save assessment', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  // The required weighted mean is exactly 15: round(1 + 99 * 14 / 19) = 74.
  await expect(page.getByLabel('Role rating 74 out of 100', { exact: true })).toBeVisible();
  await expect(page.getByText('8/45 assessed', { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label$=": unassessed"]')).toHaveCount(37);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Manager.s desk/ })).toBeVisible();
  await openPlayer(page, 'Jordan Pickford');
  await expect(page.getByLabel('Role rating 74 out of 100', { exact: true })).toBeVisible();

  const backup = await exportCareer(page);
  expect(backup.format).toBe('touchline-save');
  expect(backup.schemaVersion).toBe(1);
  expect(backup.career.id).toBe(original.career.id);
  expect(backup.career.managedClubId).toBe(original.snapshot.clubs.find(club => club.name === 'Arsenal FC')?.id);
  expect(backup.career.simulation).toEqual(original.career.simulation);
  expect(backup.snapshot.id).not.toBe(original.snapshot.id);
  expect(backup.career.databaseSnapshotId).toBe(backup.snapshot.id);
  const assessedPlayer = backup.snapshot.players.find(player => player.name === 'Jordan Pickford')!;
  expect(assessedPlayer.attributeAssessments['goalkeeping.reflexes']?.method).toBe(rationale);
  expect(assessedPlayer.attributeAssessments['goalkeeping.reflexes']?.confidence).toBe('low');
  expect(assessedPlayer.dateOfBirth).toBe(original.snapshot.players.find(player => player.id === assessedPlayer.id)?.dateOfBirth);
  expect(assessedPlayer.provenance).toEqual(original.snapshot.players.find(player => player.id === assessedPlayer.id)?.provenance);

  const freshContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const restoredPage = await freshContext.newPage();
    observe(restoredPage);
    await restoredPage.goto(APP_URL);
    await expect(restoredPage.getByRole('heading', { name: 'Choose your club', exact: true })).toBeVisible();
    await uploadJson(restoredPage, 'Restore save', backup, 'automated-test-backup.json');
    await expect(restoredPage.getByRole('status')).toContainText('Save restored and validated');
    await openPlayer(restoredPage, 'Jordan Pickford');
    await expect(restoredPage.getByLabel('Role rating 74 out of 100', { exact: true })).toBeVisible();
    const restored = await exportCareer(restoredPage);
    expect(restored.career).toEqual(backup.career);
    expect(restored.snapshot).toEqual(backup.snapshot);
  } finally {
    await freshContext.close();
  }
});

test('malformed database and unsupported or invalid backups preserve the active saved career', async ({ page }) => {
  await beginCareer(page);
  const before = await exportCareer(page);
  const invalidCases: Array<{ label: 'Import database' | 'Restore save'; input: unknown; message: RegExp }> = [
    { label: 'Import database', input: '{broken automated test JSON', message: /Database file is not valid JSON/ },
    { label: 'Import database', input: { schemaVersion: 999 }, message: /Unsupported database snapshot version 999/ },
    { label: 'Restore save', input: '{broken automated test JSON', message: /Save is not valid JSON/ },
    { label: 'Restore save', input: { ...before, schemaVersion: 999 }, message: /Unsupported save version 999/ },
    { label: 'Restore save', input: { ...before, career: { ...before.career, managedClubId: 'automated-test-absent-club' } }, message: /Managed club is absent/ },
  ];
  for (const invalid of invalidCases) {
    await uploadJson(page, invalid.label, invalid.input);
    await expect(page.getByRole('alert')).toContainText(invalid.message);
    await expect(page.getByRole('heading', { level: 1, name: /Manager.s desk/ })).toBeVisible();
    const preserved = await exportCareer(page);
    expect(preserved.career).toEqual(before.career);
    expect(preserved.snapshot).toEqual(before.snapshot);
  }
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Manager.s desk/ })).toBeVisible();
  expect((await exportCareer(page)).career).toEqual(before.career);
});

test('keyboard navigation, modal focus, accessibility and desktop/compact layouts', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(APP_URL);
  await expect(page.getByRole('heading', { name: 'Choose your club', exact: true })).toBeVisible();
  await page.locator('button').filter({ hasText: /^Import database$/ }).focus();
  await page.keyboard.press('Tab');
  const restore = page.locator('button').filter({ hasText: /^Restore save$/ });
  await expect(restore).toBeFocused();
  expect(await restore.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  await expectAccessible(page);
  await page.getByRole('button', { name: /Arsenal FC.*England/ }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Begin career', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: /Manager.s desk/ })).toBeVisible();

  for (const width of [1280, 800]) {
    await page.setViewportSize({ width, height: 800 });
    await navigate(page, 'Dashboard');
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    const squad = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Squad', exact: true });
    await squad.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Squad & player directory' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    await page.getByRole('button', { name: 'Jordan Pickford', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Jordan Pickford' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectAccessible(page);
    const assess = page.getByRole('button', { name: 'Assess attributes', exact: true });
    await assess.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Assess Jordan Pickford', exact: true });
    await expect(dialog).toBeVisible();
    await expectAccessible(page);
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(assess).toBeFocused();
  }
});
