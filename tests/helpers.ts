import { Page, expect } from '@playwright/test';

export type EditorName = 'editor' | 'pjson-editor' | 'test-editor';

export async function gotoPlayground(page: Page) {
  await page.goto('/');
  await waitForWasmReady(page);
  await waitForMonaco(page);
}

export async function waitForWasmReady(page: Page) {
  // app.js enables #build-btn only after Monaco loads. WASM readiness is
  // signalled by the `wasm-ready` event (sets window._leoWasm).
  await page.waitForFunction(() => (window as any)._leoWasm !== undefined, null, { timeout: 90_000 });
  // _leoWasm is set to null on load failure; treat that as fatal.
  await expect.poll(
    () => page.evaluate(() => (window as any)._leoWasm !== null),
    { timeout: 90_000 }
  ).toBe(true);
}

export async function waitForMonaco(page: Page) {
  await page.waitForFunction(() => {
    const w = window as any;
    return w.monaco && w.monaco.editor && w.monaco.editor.getEditors().length >= 3;
  }, null, { timeout: 60_000 });
  await expect(page.locator('#build-btn')).toBeEnabled({ timeout: 30_000 });
}

export async function setEditorValue(page: Page, which: EditorName, value: string) {
  const ok = await page.evaluate(({ which, value }) => {
    const w = window as any;
    const ed = w.monaco.editor.getEditors().find(
      (e: any) => e.getContainerDomNode()?.id === which,
    );
    if (!ed) return false;
    ed.setValue(value);
    return true;
  }, { which, value });
  if (!ok) throw new Error(`Editor not found: ${which}`);
}

export async function getEditorValue(page: Page, which: EditorName): Promise<string> {
  return page.evaluate((which) => {
    const w = window as any;
    const ed = w.monaco.editor.getEditors().find(
      (e: any) => e.getContainerDomNode()?.id === which,
    );
    return ed ? ed.getValue() : '';
  }, which);
}

export async function loadExampleByName(page: Page, displayName: string) {
  await page.locator('#examples-dropdown button.btn-ghost').click();
  await page.locator(`#examples-dropdown .dropdown-menu button`, { hasText: displayName }).click();
  // Dropdown should close after selection.
  await expect(page.locator('#examples-dropdown')).not.toHaveClass(/open/);
}

export async function clickBuild(page: Page) {
  await page.locator('#build-btn').click();
  // Wait for build to complete: button text returns to "▶ Build" and status is set.
  await expect(page.locator('#build-btn')).toHaveText('▶ Build', { timeout: 60_000 });
  await expect(page.locator('#status')).toHaveText(/Build (succeeded|failed)|Compiler/, { timeout: 30_000 });
}

export async function expectBuildSucceeded(page: Page) {
  await expect(page.locator('#status')).toHaveClass(/success/);
  await expect(page.locator('#status')).toHaveText('✓ Build succeeded');
  // Output pane is active and has non-placeholder content.
  await expect(page.locator('#output-tab')).toHaveClass(/active/);
  await expect(page.locator('#output-content')).not.toContainText('// Compiled .aleo output will appear here.');
  await expect(page.locator('#output-content')).toContainText('program');
}

export async function clickFormat(page: Page) {
  const before = await getEditorValue(page, 'editor');
  await page.locator('#fmt-btn').click();
  await expect(page.locator('#fmt-btn')).toHaveText('Format', { timeout: 30_000 });
  // Either editor changed, or it was already formatted (idempotent). Both pass.
  const after = await getEditorValue(page, 'editor');
  // Idempotency check: re-format must yield same source.
  await page.locator('#fmt-btn').click();
  await expect(page.locator('#fmt-btn')).toHaveText('Format', { timeout: 30_000 });
  const afterSecond = await getEditorValue(page, 'editor');
  expect(afterSecond).toBe(after);
  return { before, after };
}

export async function selectRunFunction(page: Page, fnName: string) {
  await page.locator('#bottom-run-tab').click();
  await expect(page.locator('#bottom-run')).toHaveClass(/active/);
  // The select is populated from the editor's fn defs. Wait for the option.
  await expect(page.locator(`#run-fn-select option[value="${fnName}"]`)).toHaveCount(1, { timeout: 15_000 });
  await page.locator('#run-fn-select').selectOption(fnName);
  await page.evaluate(() => (window as any).onRunFnChange?.());
}

export async function fillRunInputs(page: Page, inputs: string[]) {
  for (let i = 0; i < inputs.length; i++) {
    const input = page.locator(`#rp${i}`);
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await input.fill(inputs[i]);
  }
}

export async function clickRun(page: Page) {
  await page.locator('#run-btn').click();
  await expect(page.locator('#run-btn')).toHaveText('▶ Run', { timeout: 90_000 });
}

export async function expectRunSucceeded(page: Page) {
  await expect(page.locator('#status')).toHaveClass(/success/);
  await expect(page.locator('#status')).toHaveText('✓ Run succeeded');
  await expect(page.locator('#run-output')).not.toContainText('—', { timeout: 5_000 });
}

export async function runAllTests(page: Page) {
  await page.locator('#bottom-test-tab').click();
  await expect(page.locator('#bottom-test')).toHaveClass(/active/);
  // Wait for at least one test row to appear.
  await expect(page.locator('#test-list .test-row')).not.toHaveCount(0, { timeout: 15_000 });
  await page.locator('#run-all-btn').click();
  await expect(page.locator('#run-all-btn')).toHaveText('▶ Run All', { timeout: 120_000 });
}

export async function runSingleTest(page: Page, qualifiedName: string) {
  await page.locator('#bottom-test-tab').click();
  await expect(page.locator('#bottom-test')).toHaveClass(/active/);
  await page.evaluate((q) => (window as any).runSingleTest(q), qualifiedName);
  // Wait for status to settle (it includes the qualified name on success/fail).
  await expect(page.locator('#status')).toHaveText(new RegExp(`${qualifiedName.replace('.', '\\.')}`), {
    timeout: 90_000,
  });
}

export async function getTestRowStatuses(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('#test-list .test-row');
    const result: Record<string, string> = {};
    rows.forEach((row) => {
      const name = row.querySelector('.test-name')?.textContent?.trim() ?? '';
      const icon = row.querySelector('.test-icon');
      const status = icon?.className.replace('test-icon', '').trim() ?? 'unknown';
      result[name] = status;
    });
    return result;
  });
}

export async function switchEditorTab(page: Page, tab: 'leo' | 'test' | 'pjson') {
  await page.locator(`#${tab}-tab`).click();
  await expect(page.locator(`#${tab}-tab`)).toHaveClass(/active/);
}

export async function switchOutputTab(page: Page, tab: 'output' | 'abi' | 'problems') {
  await page.locator(`#${tab}-tab`).click();
  await expect(page.locator(`#${tab}-tab`)).toHaveClass(/active/);
}
