import { expect, test } from '@playwright/test';
import {
  clickBuild,
  getEditorValue,
  gotoPlayground,
  loadExampleByName,
  switchEditorTab,
  switchOutputTab,
} from './helpers';

test.describe('rendering', () => {
  test('initial layout: header, editor, panes, footer', async ({ page }) => {
    await gotoPlayground(page);

    // Header logo and buttons.
    await expect(page.locator('.site-logo')).toBeVisible();
    await expect(page.locator('#examples-dropdown button.btn-ghost')).toBeVisible();
    await expect(page.locator('#share-btn')).toBeVisible();

    // Editor tabs and panes.
    await expect(page.locator('#leo-tab')).toHaveClass(/active/);
    await expect(page.locator('#editor')).toBeVisible();

    // Output and Run sub-tabs both start active. Check them BEFORE clicking
    // any output tab — `setTab` strips `active` from every `.tab` element on
    // the page (overly-broad selector), which would clear bottom-run-tab too.
    await expect(page.locator('#output-tab')).toHaveClass(/active/);
    await expect(page.locator('#bottom-run-tab')).toHaveClass(/active/);
    await expect(page.locator('#output-content')).toBeVisible();
    await expect(page.locator('#bottom-run')).toBeVisible();

    // ABI tab starts with a placeholder.
    await page.locator('#abi-tab').click();
    await expect(page.locator('#abi-content')).toContainText(
      '// ABI JSON will appear here after a successful build.',
    );

    // Footer build & format and version label.
    await expect(page.locator('#build-btn')).toBeVisible();
    await expect(page.locator('#fmt-btn')).toBeVisible();
    await expect(page.locator('#leo-version')).toContainText('v');
    await expect(page.locator('#status')).toBeVisible();
  });

  test('source pane shows main.leo content for default example', async ({ page }) => {
    await gotoPlayground(page);
    const src = await getEditorValue(page, 'editor');
    expect(src).toContain('program hello.aleo');
    expect(src).toContain('fn sum');
  });

  test('switching to program.json tab shows valid JSON for example', async ({ page }) => {
    await gotoPlayground(page);
    await loadExampleByName(page, 'Token');
    await switchEditorTab(page, 'pjson');
    const text = await getEditorValue(page, 'pjson-editor');
    const parsed = JSON.parse(text);
    expect(parsed.program).toBe('token.aleo');
    expect(parsed.version).toBeDefined();
  });

  test('switching to tests tab shows imported test program', async ({ page }) => {
    await gotoPlayground(page);
    await loadExampleByName(page, 'Counter');
    await switchEditorTab(page, 'test');
    const text = await getEditorValue(page, 'test-editor');
    expect(text).toContain('import counter.aleo');
    expect(text).toContain('@test');
    expect(text).toContain('program test_counter.aleo');
  });

  test('build populates Output (.aleo) and ABI (JSON) with syntax-highlight markup', async ({
    page,
  }) => {
    await gotoPlayground(page);
    await loadExampleByName(page, 'Hello World');
    await clickBuild(page);

    // Output pane: highlighted .aleo with section/opcode spans.
    await switchOutputTab(page, 'output');
    const outputHtml = await page.locator('#output-content').innerHTML();
    expect(outputHtml).toContain('class="ao-section"');
    expect(outputHtml).toContain('class="ao-opcode"');
    expect(outputHtml).toContain('hello.aleo');

    // ABI pane: highlighted JSON with key/string/punct spans.
    await switchOutputTab(page, 'abi');
    const abiHtml = await page.locator('#abi-content').innerHTML();
    expect(abiHtml).toContain('class="aj-key"');
    expect(abiHtml).toContain('class="aj-str"');
    // ABI is valid JSON when stripped of HTML tags.
    const abiText = await page.locator('#abi-content').innerText();
    const parsed = JSON.parse(abiText);
    expect(parsed.program).toBe('hello.aleo');
    expect(Array.isArray(parsed.functions)).toBe(true);
  });

  test('build failure routes user to Diagnostics tab with error code', async ({ page }) => {
    await gotoPlayground(page);
    // Replace source with something that fails the parser.
    await page.evaluate(() => {
      const w = window as any;
      const ed = w.monaco.editor.getEditors().find(
        (e: any) => e.getContainerDomNode()?.id === 'editor',
      );
      ed.setValue('program broken.aleo { fn  }\n');
    });
    await clickBuild(page);
    await expect(page.locator('#status')).toHaveClass(/error/);
    await expect(page.locator('#problems-tab')).toHaveClass(/active/);
    // problems-tab text gets "Problems (N)" when error codes are present.
    await expect(page.locator('#problems-tab')).toHaveText(/Problems(?: \(\d+\))?|Diagnostics/);
    const diag = await page.locator('#problems-content').innerText();
    expect(diag.length).toBeGreaterThan(0);
  });
});
