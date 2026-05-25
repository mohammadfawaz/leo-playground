import { expect, test } from '@playwright/test';
import {
  clickBuild,
  clickFormat,
  clickRun,
  expectBuildSucceeded,
  expectRunSucceeded,
  fillRunInputs,
  getTestRowStatuses,
  gotoPlayground,
  runAllTests,
  selectRunFunction,
  setEditorValue,
} from './helpers';
import { NEW_PROJECT } from './fixtures';

test.describe('new project', () => {
  test('build / format / run / test on a freshly-typed program', async ({ page }) => {
    await gotoPlayground(page);

    // Replace all three editors with a brand-new project.
    await setEditorValue(page, 'editor', NEW_PROJECT.source);
    await setEditorValue(page, 'pjson-editor', NEW_PROJECT.programJson);
    await setEditorValue(page, 'test-editor', NEW_PROJECT.testSource);

    // 1) Build the new program.
    await clickBuild(page);
    await expectBuildSucceeded(page);
    await page.locator('#abi-tab').click();
    await expect(page.locator('#abi-content')).toContainText(NEW_PROJECT.programName);

    // 2) Format — idempotent and leaves a valid program.
    const { after } = await clickFormat(page);
    expect(after).toContain(`program ${NEW_PROJECT.programName}`);
    expect(after).toContain(`fn ${NEW_PROJECT.runFn}`);

    // 3) Run the function.
    await selectRunFunction(page, NEW_PROJECT.runFn);
    await fillRunInputs(page, NEW_PROJECT.runInputs);
    await clickRun(page);
    await expectRunSucceeded(page);
    await expect(page.locator('#run-output')).toContainText(NEW_PROJECT.expectedRunSubstring);

    // 4) Run all tests — every test in this fresh project must pass.
    await runAllTests(page);
    const statuses = await getTestRowStatuses(page);
    const n = NEW_PROJECT.expectedPassingTests.length;
    expect(Object.keys(statuses).length).toBe(n);
    for (const name of NEW_PROJECT.expectedPassingTests) {
      expect(statuses[name], `${name} status`).toBe('passed');
    }
    await expect(page.locator('#status')).toContainText(
      new RegExp(`${n} / ${n} tests passed`),
    );
  });
});
