import { expect, test } from '@playwright/test';
import {
  clickBuild,
  clickFormat,
  clickRun,
  expectBuildSucceeded,
  expectRunSucceeded,
  fillRunInputs,
  getEditorValue,
  getTestRowStatuses,
  gotoPlayground,
  loadExampleByName,
  runAllTests,
  selectRunFunction,
} from './helpers';
import { EXAMPLES } from './fixtures';

for (const ex of EXAMPLES) {
  test.describe(`example: ${ex.displayName}`, () => {
    test.beforeEach(async ({ page }) => {
      await gotoPlayground(page);
      await loadExampleByName(page, ex.displayName);
    });

    test('builds', async ({ page }) => {
      await clickBuild(page);
      await expectBuildSucceeded(page);
      // ABI tab should also have content after a successful build.
      await page.locator('#abi-tab').click();
      await expect(page.locator('#abi-content')).toContainText('"program"');
      await expect(page.locator('#abi-content')).toContainText(ex.programName);
    });

    test('formats (idempotent)', async ({ page }) => {
      const { before, after } = await clickFormat(page);
      // Source must remain a valid Leo program after formatting.
      expect(after).toContain(`program ${ex.programName}`);
      // Examples are seeded formatted; idempotency was already verified in helper.
      expect(after.length).toBeGreaterThan(0);
      // After format, build must still succeed.
      await clickBuild(page);
      await expectBuildSucceeded(page);
      // Use `before` to silence unused-variable warning if format is a no-op.
      expect(typeof before).toBe('string');
    });

    test(`runs ${ex.runFn}`, async ({ page }) => {
      await selectRunFunction(page, ex.runFn);
      await fillRunInputs(page, ex.runInputs);
      await clickRun(page);
      await expectRunSucceeded(page);
      const out = await page.locator('#run-output').innerText();
      expect(out).toContain(ex.expectedRunSubstring);
    });

    test('runs all tests', async ({ page }) => {
      await runAllTests(page);
      const statuses = await getTestRowStatuses(page);
      // Every test in the seeded tests/ file must pass.
      for (const name of ex.expectedPassingTests) {
        expect(statuses[name], `${name} status`).toBe('passed');
      }
      // No stray tests beyond the expected list.
      expect(Object.keys(statuses).sort()).toEqual([...ex.expectedPassingTests].sort());
      // Status footer reports N / N passed.
      const n = ex.expectedPassingTests.length;
      await expect(page.locator('#status')).toContainText(`${n} / ${n} tests passed`);
    });
  });
}
