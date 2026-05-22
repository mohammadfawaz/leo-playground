// Leo Playground — app.js (plain script, not a module)
// Tree-sitter is loaded by ts-loader.js (ESM) and surfaced via window._ts*.

// ── Example loader ────────────────────────────────────────────────────────────

const EXAMPLE_ORDER = ['Hello World', 'Token', 'Counter', 'Vote'];
const EXAMPLE_SLUGS = {
  'Hello World': 'hello-world',
  'Token':       'token',
  'Counter':     'counter',
  'Vote':        'vote',
};

let EXAMPLES       = {};
let EXAMPLE_TESTS  = {};
let EXAMPLE_PJSONS = {};

async function loadExamples() {
  const fetchText = async url => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status} ${r.statusText}`);
    return r.text();
  };
  await Promise.all(EXAMPLE_ORDER.map(async name => {
    const slug = EXAMPLE_SLUGS[name];
    const base = `examples/${slug}`;
    // Load program and program.json first so we can derive the test file name.
    const [program, pjson] = await Promise.all([
      fetchText(`${base}/src/main.leo`),
      fetchText(`${base}/program.json`),
    ]);
    // Test file is named after the program: test_{program_name}.leo
    const progName = JSON.parse(pjson).program.replace('.aleo', '');
    const tests = await fetchText(`${base}/tests/test_${progName}.leo`);
    EXAMPLES[name]       = program;
    EXAMPLE_PJSONS[name] = pjson;
    EXAMPLE_TESTS[name]  = tests;
  }));
}

const examplesReady = loadExamples();

// ── Editor state ──────────────────────────────────────────────────────────────

let editor        = null;
let pjsonEditor   = null;
let testEditor    = null;
let tsDecorations = null;
let tsTimer       = null;

// ── Tree-sitter highlighting ──────────────────────────────────────────────────

function applyHighlighting() {
  const tsParser = window._tsParser;
  const leoQuery = window._tsQuery;
  if (!tsParser || !leoQuery || !editor) return;

  const tree     = tsParser.parse(editor.getValue());
  const captures = leoQuery.captures(tree.rootNode);

  // Deduplicate: keep first (highest-priority) capture per node span.
  const seen = new Set();
  const decorations = [];
  for (const { name, node } of captures) {
    const key = `${node.startIndex}:${node.endIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    decorations.push({
      range: new monaco.Range(
        node.startPosition.row + 1,
        node.startPosition.column + 1,
        node.endPosition.row + 1,
        node.endPosition.column + 1,
      ),
      options: { inlineClassName: 'hl-' + name.replace(/\./g, '-') },
    });
  }

  if (!tsDecorations) {
    tsDecorations = editor.createDecorationsCollection(decorations);
  } else {
    tsDecorations.set(decorations);
  }
}

// ts-loader.js fires this once tree-sitter + Leo grammar are ready.
window.addEventListener('ts-ready', applyHighlighting);

// ── Monaco ────────────────────────────────────────────────────────────────────


const _vsBase = new URL('vs', document.baseURI).href;

require.config({
  paths: { vs: _vsBase },
});

require(['vs/editor/editor.main'], async function () {

  monaco.languages.register({ id: 'leo' });

  // Full Monarch tokenizer — provides immediate highlighting before tree-sitter
  // loads, and drives bracket matching / indentation behaviour at all times.
  monaco.languages.setMonarchTokensProvider('leo', {
    keywords: [
      'as', 'assert', 'assert_eq', 'assert_neq', 'async', 'const',
      'constructor', 'else', 'final', 'fn', 'for', 'if', 'import', 'in',
      'let', 'mapping', 'program', 'record', 'return', 'script',
      'self', 'struct',
    ],
    types: [
      'address', 'bool', 'field', 'group', 'scalar', 'string',
      'Final', 'Future',
      'u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128',
    ],
    modifiers: ['public', 'private', 'constant'],
    builtins: [
      'Mapping', 'ChaCha', 'BHP256', 'BHP512', 'BHP768', 'BHP1024',
      'Pedersen64', 'Pedersen128', 'Poseidon2', 'Poseidon4', 'Poseidon8',
      'SHA3_256', 'SHA3_384', 'SHA3_512', 'block', 'network',
    ],
    tokenizer: {
      root: [
        [/@[a-zA-Z_]\w*/, 'keyword'],  // annotations: @test, @should_fail, @noupgrade
        [/[a-zA-Z_]\w*/, { cases: {
          '@keywords':  'keyword',
          '@types':     'type',
          '@modifiers': 'keyword',
          '@builtins':  'type',
          'true|false': 'constant',
          '@default':   'identifier',
        }}],
        [/\d+(?:u8|u16|u32|u64|u128|i8|i16|i32|i64|i128|field|group|scalar)\b/, 'number'],
        [/\d+/, 'number'],
        [/"[^"]*"/, 'string'],
        [/\/\/.*$/,   'comment'],
        [/\/\*/,      { token: 'comment', next: '@block_comment' }],
        [/[{}()\[\]]/, '@brackets'],
        [/[;,]/,      'delimiter'],
      ],
      block_comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//,   { token: 'comment', next: '@pop' }],
        [/[/*]/,   'comment'],
      ],
    },
  });

  monaco.editor.defineTheme('leo-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword',    foreground: 'c586c0' },
      { token: 'type',       foreground: '4ec9b0' },
      { token: 'constant',   foreground: '569cd6' },
      { token: 'number',     foreground: 'b5cea8' },
      { token: 'string',     foreground: 'ce9178' },
      { token: 'comment',    foreground: '6a9955', fontStyle: 'italic' },
      { token: 'identifier', foreground: '9cdcfe' },
    ],
    colors: { 'editor.background': '#1e1e1e' },
  });

  await examplesReady;

  const fromHash      = loadFromHash();
  const initialSource = fromHash || EXAMPLES['Hello World'];
  const initialPjson  = fromHash ? defaultProgramJson(fromHash) : (EXAMPLE_PJSONS['Hello World'] || defaultProgramJson(initialSource));

  const editorOpts = {
    language: 'leo',
    theme: 'leo-dark',
    fontSize: 14,
    fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", monospace',
    fontLigatures: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    renderLineHighlight: 'line',
    automaticLayout: true,
    padding: { top: 14 },
    overviewRulerLanes: 0,
  };

  editor = monaco.editor.create(document.getElementById('editor'), {
    ...editorOpts,
    value: initialSource,
  });

  pjsonEditor = monaco.editor.create(document.getElementById('pjson-editor'), {
    ...editorOpts,
    value: initialPjson,
    language: 'json',
    lineNumbers: 'off',
  });

  const initialTestSource = (() => {
    if (fromHash) return defaultTestSource(initialSource);
    for (const [name, src] of Object.entries(EXAMPLES)) {
      if (src === initialSource && EXAMPLE_TESTS[name]) return EXAMPLE_TESTS[name];
    }
    return defaultTestSource(initialSource);
  })();

  testEditor = monaco.editor.create(document.getElementById('test-editor'), {
    ...editorOpts,
    value: initialTestSource,
  });

  testEditor.onDidChangeModelContent(() => {
    clearTimeout(tsTimer);
    tsTimer = setTimeout(updateTestPanel, 300);
  });

  editor.onDidChangeModelContent(() => {
    clearTimeout(tsTimer);
    tsTimer = setTimeout(applyHighlighting, 120);
    updateRunPanel();
  });

  document.getElementById('build-btn').disabled = false;
  updateTestPanel();


  document.getElementById('leo-version').textContent = 'v4.0.2';

  updateRunPanel();

  // If tree-sitter already finished loading before Monaco (unlikely but possible).
  if (window._tsParser) applyHighlighting();
});

// ── .aleo output highlighter ─────────────────────────────────────────────────

function highlightAleo(raw) {
  const esc  = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const span = (c, s) => `<span class="${c}">${esc(s)}</span>`;

  // Rules are tried in order; first match wins.
  const rules = [
    [/^\/\/[^\n]*/,                                                                    'ao-comment'],
    // dot-prefixed visibility/mode (before bare keywords so .record beats record)
    [/^\.(?:public|private|constant|record|future)\b/,                                'ao-modifier'],
    // multi-part opcodes with dots
    [/^hash_many\.psd[248]/,                                                           'ao-opcode'],
    [/^hash\.(?:bhp(?:256|512|768|1024)|keccak(?:256|384|512)|ped(?:64|128)|psd[248]|sha3_(?:256|384|512))(?:\.(?:native\.raw|native|raw))?/, 'ao-opcode'],
    [/^(?:rand\.chacha|branch\.(?:eq|neq)|is\.(?:eq|neq)|assert\.(?:eq|neq))/,         'ao-opcode'],
    [/^(?:get\.or_use\.dynamic|get\.or_use|get\.dynamic)/,                            'ao-opcode'],
    [/^(?:contains\.dynamic|cast\.lossy)/,                                             'ao-opcode'],
    // dot-w arithmetic variants
    [/^(?:add|sub|mul|div|rem|pow|shl|shr|abs)\.w\b/,                                 'ao-opcode'],
    // section/block keywords
    [/^(?:program|import|function|transition|closure|struct|record|mapping|finalize|async|constructor)\b/, 'ao-section'],
    // instruction flow
    [/^(?:input|output|call|await|position|set|remove|get|contains|cast|into|as)\b/,  'ao-inst'],
    // simple opcodes
    [/^(?:add|sub|mul|div|rem|pow|shl|shr|mod|and|or|xor|nor|nand|not|neg|abs|double|sqrt|inv|square|gt|gte|lt|lte|ternary)\b/, 'ao-opcode'],
    // types (longest prefixes first)
    [/^(?:u128|u64|u32|u16|u8|i128|i64|i32|i16|i8|field|group|scalar|boolean|bool|address|string|signature)\b/, 'ao-type'],
    // registers and edition pseudo-register
    [/^(?:r\d+|edition)\b/,                                                            'ao-register'],
    // booleans
    [/^(?:true|false)\b/,                                                              'ao-bool'],
    // typed number literals (1u32, 100field, etc.)
    [/^\d+(?:u128|u64|u32|u16|u8|i128|i64|i32|i16|i8|field|group|scalar)/,           'ao-number'],
    // plain numbers
    [/^\d+/,                                                                           'ao-number'],
    // program name (foo.aleo)
    [/^[a-zA-Z_]\w*\.aleo/,                                                            'ao-name'],
  ];

  const out = [];
  let i = 0;
  while (i < raw.length) {
    const rest = raw.slice(i);
    let matched = false;
    for (const [re, cls] of rules) {
      const m = rest.match(re);
      if (m) { out.push(span(cls, m[0])); i += m[0].length; matched = true; break; }
    }
    if (!matched) { out.push(esc(raw[i])); i++; }
  }
  return out.join('');
}

// ── ANSI → HTML ───────────────────────────────────────────────────────────────

function ansiToHtml(s) {
  const esc = t => t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const colorMap = {
    '1':  'font-weight:bold',
    '30': 'color:#4e4e4e', '31': 'color:#f14c4c', '32': 'color:#4ec9b0',
    '33': 'color:#ce9178', '34': 'color:#569cd6', '35': 'color:#c586c0',
    '36': 'color:#4fc1ff', '37': 'color:#d4d4d4', '90': 'color:#6a9955',
  };
  let out = '', open = 0;
  const parts = s.split(/\x1b\[([0-9;]*)m/);
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) { out += esc(parts[i]); continue; }
    const codes = parts[i].split(';');
    if (codes[0] === '0' || codes[0] === '') {
      out += '</span>'.repeat(open); open = 0;
    } else {
      for (const c of codes) {
        const style = colorMap[c];
        if (style) { out += `<span style="${style}">`; open++; }
      }
    }
  }
  out += '</span>'.repeat(open);
  return out;
}

// ── Build ─────────────────────────────────────────────────────────────────────

async function build() {
  if (!editor) return;

  const wasm = window._leoWasm;
  if (!wasm) {
    document.getElementById('problems-content').textContent = 'Compiler not ready yet — please wait a moment and try again.';
    setTab('problems');
    setStatus('error', '✗ Compiler not ready');
    return;
  }

  const btn = document.getElementById('build-btn');
  btn.disabled    = true;
  btn.textContent = 'Building…';
  setStatus('building', 'Building…');

  try {
    const result = JSON.parse(wasm.compile(editor.getValue(), getProgramJson()));

    if (result.success) {
      document.getElementById('output-content').innerHTML = highlightAleo(result.output);
      document.getElementById('abi-content').innerHTML    = highlightJson(result.abi);
      document.getElementById('problems-content').innerHTML = '';
      document.getElementById('problems-tab').textContent   = 'Diagnostics';
      setTab('output');
      setStatus('success', '✓ Build succeeded');
    } else {
      const diag = result.diagnostics || '';
      document.getElementById('problems-content').innerHTML = ansiToHtml(diag);
      document.getElementById('output-content').textContent = '';
      document.getElementById('abi-content').innerHTML = '<span class="placeholder">// ABI JSON will appear here after a successful build.</span>';
      const n = (diag.match(/\[E[A-Z0-9]+\]/g) || []).length;
      document.getElementById('problems-tab').textContent   = `Problems${n ? ` (${n})` : ''}`;
      setTab('problems');
      setStatus('error', '✗ Build failed');
    }
  } catch (e) {
    document.getElementById('problems-content').textContent = 'Compiler error: ' + e.message;
    setTab('problems');
    setStatus('error', '✗ Compiler error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '▶ Build';
  }
}

// ── Format ────────────────────────────────────────────────────────────────────

async function format() {
  if (!editor) return;
  const wasm = window._leoWasm;
  if (!wasm) return;
  const btn = document.getElementById('fmt-btn');
  btn.disabled    = true;
  btn.textContent = 'Formatting…';
  try {
    const formatted = wasm.format(editor.getValue());
    if (formatted) {
      const pos = editor.getPosition();
      editor.setValue(formatted);
      editor.setPosition(pos);
    }
  } catch (_) {}
  finally {
    btn.disabled    = false;
    btn.textContent = 'Format';
  }
}

function highlightJson(raw) {
  if (!raw) return '<span class="placeholder">// ABI JSON will appear here after a successful build.</span>';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Tokenize JSON: strings, numbers, booleans/null, punctuation
  return raw.replace(/("(?:[^"\\]|\\.)*")\s*(:)|("(?:[^"\\]|\\.)*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],:])/g,
    (_, key, colon, str, kw, num, punct) => {
      if (key && colon) return `<span class="aj-key">${esc(key)}</span><span class="aj-punct">${colon}</span>`;
      if (str)   return `<span class="aj-str">${esc(str)}</span>`;
      if (kw)    return `<span class="aj-kw">${esc(kw)}</span>`;
      if (num)   return `<span class="aj-num">${esc(num)}</span>`;
      if (punct) return `<span class="aj-punct">${esc(punct)}</span>`;
      return esc(_);
    });
}

// ── Run ───────────────────────────────────────────────────────────────────────

function parseLeoDefs(src) {
  const fns = [];
  const re = /\b(?:async\s+)?fn\s+(\w+)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const params = m[2].trim()
      ? m[2].split(',').map(p => {
          p = p.trim().replace(/^(?:public|private|constant)\s+/, '');
          const [name, type] = p.split(':').map(s => s.trim());
          return { name: name || '', type: type || '?' };
        }).filter(p => p.name)
      : [];
    fns.push({ name: m[1], params });
  }
  return fns;
}

function defaultForType(t) {
  if (/^u\d+$/.test(t) || /^i\d+$/.test(t)) return `0${t}`;
  if (t === 'bool' || t === 'boolean') return 'true';
  if (t === 'field')   return '1field';
  if (t === 'group')   return '0group';
  if (t === 'scalar')  return '1scalar';
  if (t === 'address') return 'aleo1…';
  return t;
}

function buildParamInputs(fn_) {
  const container = document.getElementById('run-params');
  if (!fn_ || fn_.params.length === 0) { container.innerHTML = ''; return; }
  container.innerHTML = fn_.params.map((p, i) => `
    <div class="run-row">
      <label class="run-label" for="rp${i}">${p.name} <span class="run-type">${p.type}</span></label>
      <input id="rp${i}" class="run-input" type="text" placeholder="${defaultForType(p.type)}">
    </div>`).join('');
}

function onRunFnChange() {
  if (!editor) return;
  const fns = parseLeoDefs(editor.getValue());
  buildParamInputs(fns.find(f => f.name === document.getElementById('run-fn-select').value));
}

function updateRunPanel() {
  if (!editor) return;
  const fns  = parseLeoDefs(editor.getValue());
  const sel  = document.getElementById('run-fn-select');
  const prev = sel.value;
  sel.innerHTML = fns.length
    ? fns.map(f => `<option value="${f.name}">${f.name}</option>`).join('')
    : '<option value="">— no functions —</option>';
  if (prev && fns.find(f => f.name === prev)) sel.value = prev;
  buildParamInputs(fns.find(f => f.name === sel.value));
}

async function runProgram() {
  const out = document.getElementById('run-output');
  const wasm = window._leoWasm;
  if (!wasm) { out.textContent = 'Compiler not ready.'; return; }

  const btn = document.getElementById('run-btn');
  btn.disabled    = true;
  btn.textContent = '⏳ Running…';
  out.innerHTML   = '<span class="placeholder">Running…</span>';
  setStatus('building', 'Running…');

  try {
    const fnName  = document.getElementById('run-fn-select').value;
    const inputs  = Array.from(document.querySelectorAll('[id^="rp"]')).map(el => el.value.trim()).filter(Boolean);
    const result  = JSON.parse(wasm.run(editor.getValue(), fnName, JSON.stringify(inputs), getProgramJson()));

    if (result.success) {
      const lines = [];
      // Suppress the raw future(...) value when finalize ran — only show finalize state.
      if (!result.finalize) {
        lines.push(result.output || '(no output)');
      }
      if (result.finalize) {
        if (result.finalize.error) {
          lines.push('Finalize error:\n  ' + result.finalize.error);
        } else {
          lines.push('Finalize state:');
          for (const [name, entries] of Object.entries(result.finalize)) {
            lines.push(`  [${name}]`);
            if (entries.length === 0) lines.push('    (empty)');
            else entries.forEach(e => lines.push(`    ${e}`));
          }
        }
      }
      out.textContent = lines.join('\n') || '(no output)';
      setStatus('success', '✓ Run succeeded');
    } else {
      out.innerHTML = ansiToHtml(result.diagnostics || 'Run failed');
      setStatus('error', '✗ Run failed');
    }
  } catch (e) {
    out.textContent = 'Error: ' + e.message;
    setStatus('error', '✗ Run error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '▶ Run';
  }
}

// ── Test panel ────────────────────────────────────────────────────────────────

const testState = new Map(); // qualifiedName → { status, error }

function parseTestDefs(src) {
  const tests = [];
  const progMatch = src.match(/\bprogram\s+([\w.]+\.aleo)\b/);
  if (!progMatch) return tests;
  const prog = progMatch[1];
  const chunks = src.split(/@test\b/);
  for (let i = 1; i < chunks.length; i++) {
    const fnMatch = chunks[i].match(/\bfn\s+(\w+)\s*\(/);
    if (!fnMatch) continue;
    const beforeFn = chunks[i].slice(0, fnMatch.index);
    const shouldFail = /@should_fail/.test(beforeFn);
    tests.push({ name: fnMatch[1], qualified: `${prog}/${fnMatch[1]}`, shouldFail });
  }
  return tests;
}

function renderTestList() {
  const list = document.getElementById('test-list');
  const tests = testEditor ? parseTestDefs(testEditor.getValue()) : [];
  if (!tests.length) {
    list.innerHTML = '<span class="placeholder test-placeholder">No @test functions found in tests/ file.</span>';
    return;
  }
  list.innerHTML = tests.map(t => {
    const st = testState.get(t.qualified) || { status: 'pending', error: '' };
    const icon = { pending: '○', running: '◌', passed: '✓', failed: '✗' }[st.status] || '○';
    return `<div class="test-row">
      <span class="test-icon ${st.status}">${icon}</span>
      <span class="test-name${t.shouldFail ? ' should-fail' : ''}" title="${escHtml(t.qualified)}">${escHtml(t.name)}</span>
      <button class="test-run-btn" onclick="runSingleTest('${t.qualified}')">▶</button>
    </div>`;
  }).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function updateTestPanel() {
  const tests = testEditor ? parseTestDefs(testEditor.getValue()) : [];
  // Remove stale entries
  const names = new Set(tests.map(t => t.qualified));
  for (const k of testState.keys()) if (!names.has(k)) testState.delete(k);
  // Add new entries as pending
  for (const t of tests) if (!testState.has(t.qualified)) testState.set(t.qualified, { status: 'pending', error: '' });
  renderTestList();
}

function applyTestResults(results) {
  for (const r of results) {
    testState.set(r.name, { status: r.passed ? 'passed' : 'failed', error: r.error || '' });
  }
  renderTestList();
  const total  = results.length;
  const passed = results.filter(r => r.passed).length;
  setStatus(passed === total ? 'success' : 'error', `${passed} / ${total} tests passed`);

  const failures = results.filter(r => !r.passed && r.error);
  if (failures.length) {
    setTestDiagnostics(failures.map(r =>
      `<span class="test-diag-name">✗ ${escHtml(r.name)}</span>\n${ansiToHtml(r.error)}`
    ).join('\n\n'));
  } else {
    setTestDiagnostics('');
  }
}

function setTestDiagnostics(html) {
  document.getElementById('test-diagnostics').innerHTML = html;
}

async function runSingleTest(qualifiedName) {
  const wasm = window._leoWasm;
  if (!wasm) { setTestDiagnostics('<span>Compiler not ready.</span>'); return; }

  testState.set(qualifiedName, { status: 'running', error: '' });
  renderTestList();
  setStatus('building', `Running ${qualifiedName}…`);

  try {
    const result = JSON.parse(wasm.run_tests(editor.getValue(), testEditor.getValue(), getProgramJson()));
    const match  = (result.results || []).find(r => r.name === qualifiedName);
    if (match) {
      testState.set(qualifiedName, { status: match.passed ? 'passed' : 'failed', error: match.error || '' });
      const st = testState.get(qualifiedName);
      setStatus(st.status === 'passed' ? 'success' : 'error', st.status === 'passed' ? `✓ ${qualifiedName} passed` : `✗ ${qualifiedName} failed`);
      if (result.diagnostics) setTestDiagnostics(ansiToHtml(result.diagnostics));
      else if (!match.passed && match.error) setTestDiagnostics(`<span class="test-diag-name">✗ ${escHtml(match.name)}</span>\n${ansiToHtml(match.error)}`);
      else setTestDiagnostics('');
    } else {
      testState.set(qualifiedName, { status: 'failed', error: result.diagnostics || 'Test not found in output' });
      setStatus('error', `✗ ${qualifiedName} failed`);
      setTestDiagnostics(result.diagnostics ? ansiToHtml(result.diagnostics) : '<span>Test not found in output.</span>');
    }
  } catch (e) {
    testState.set(qualifiedName, { status: 'failed', error: e.message });
    setTestDiagnostics('<span>' + escHtml(e.message) + '</span>');
    setStatus('error', '✗ Test error');
  }
  renderTestList();
}

async function runAllTests() {
  const wasm = window._leoWasm;
  if (!wasm) { setTestDiagnostics('<span>Compiler not ready.</span>'); return; }

  const tests = testEditor ? parseTestDefs(testEditor.getValue()) : [];
  if (!tests.length) return;

  const btn = document.getElementById('run-all-btn');
  btn.disabled    = true;
  btn.textContent = '⏳ Running…';
  for (const t of tests) testState.set(t.qualified, { status: 'running', error: '' });
  renderTestList();
  setStatus('building', 'Running tests…');

  try {
    const result = JSON.parse(wasm.run_tests(editor.getValue(), testEditor.getValue(), getProgramJson()));
    applyTestResults(result.results || []);
    if (result.diagnostics) setTestDiagnostics(ansiToHtml(result.diagnostics));
    else setTestDiagnostics('');
  } catch (e) {
    setTestDiagnostics('<span>' + escHtml(e.message) + '</span>');
    setStatus('error', '✗ Test error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '▶ Run All';
  }
}

// ── Share ─────────────────────────────────────────────────────────────────────

function share() {
  if (!editor) return;
  history.replaceState(null, '', '#' + btoa(encodeURIComponent(editor.getValue())));
  navigator.clipboard.writeText(location.href).then(() => {
    const btn = document.getElementById('share-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Share', 2000);
  }).catch(() => {});
}

function loadFromHash() {
  if (!location.hash) return null;
  try { return decodeURIComponent(atob(location.hash.slice(1))); } catch { return null; }
}

// ── Examples ──────────────────────────────────────────────────────────────────

function loadExample(name) {
  if (!editor || !EXAMPLES[name]) return;
  const src = EXAMPLES[name];
  editor.setValue(src);
  if (pjsonEditor)  pjsonEditor.setValue(EXAMPLE_PJSONS[name] || defaultProgramJson(src));
  if (testEditor)  { testEditor.setValue(EXAMPLE_TESTS[name] ?? defaultTestSource(src)); testState.clear(); updateTestPanel(); }
  history.replaceState(null, '', location.pathname);
  document.getElementById('examples-dropdown').classList.remove('open');
}

function toggleExamples() {
  document.getElementById('examples-dropdown').classList.toggle('open');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getProgramJson() {
  return pjsonEditor ? pjsonEditor.getValue() : '';
}

function defaultProgramJson(src) {
  const match = src.match(/\bprogram\s+([\w.]+\.aleo)\b/);
  const name = match ? match[1] : 'main.aleo';
  return JSON.stringify({ program: name, version: '0.0.0', description: '', license: 'MIT' }, null, 2);
}

function defaultTestSource(src) {
  const match = src.match(/\bprogram\s+([\w.]+)\.aleo\b/);
  const name = match ? match[1] : 'main';
  return `import ${name}.aleo;\n\nprogram test_${name}.aleo {\n    @test\n    fn test_${name}() {\n        // Add assertions here.\n    }\n\n    @noupgrade\n    constructor() {}\n}\n`;
}

function setEditorTab(name) {
  document.getElementById('leo-tab').classList.toggle('active',   name === 'leo');
  document.getElementById('test-tab').classList.toggle('active',  name === 'test');
  document.getElementById('pjson-tab').classList.toggle('active', name === 'pjson');
  document.getElementById('editor').style.display = name === 'leo' ? '' : 'none';
  document.getElementById('test-editor').classList.toggle('active',  name === 'test');
  document.getElementById('pjson-editor').classList.toggle('active', name === 'pjson');
  if (name === 'leo'   && editor)      editor.layout();
  if (name === 'test'  && testEditor)  testEditor.layout();
  if (name === 'pjson' && pjsonEditor) pjsonEditor.layout();
}

function setBottomTab(name) {
  document.getElementById('bottom-run-tab').classList.toggle('active',  name === 'run');
  document.getElementById('bottom-test-tab').classList.toggle('active', name === 'test');
  document.getElementById('bottom-run').classList.toggle('active',  name === 'run');
  document.getElementById('bottom-test').classList.toggle('active', name === 'test');
}

function setTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(name + '-tab').classList.add('active');
  document.getElementById(name + '-content').classList.add('active');
}

function setStatus(cls, text) {
  const el = document.getElementById('status');
  el.className   = 'status ' + cls;
  el.textContent = text;
}

document.addEventListener('click', e => {
  const dd = document.getElementById('examples-dropdown');
  if (!dd.contains(e.target)) dd.classList.remove('open');
});

// ── Resizable panes ───────────────────────────────────────────────────────────

function initDividers() {
  // ── Vertical: editor ↔ output ──
  const vDiv        = document.querySelector('.divider');
  const editorPane  = document.querySelector('.editor-pane');
  const outputPane  = document.querySelector('.output-pane');

  vDiv.addEventListener('mousedown', e => {
    e.preventDefault();
    vDiv.classList.add('active');
    document.body.classList.add('resizing');
    document.body.style.cursor = 'col-resize';

    const onMove = mv => {
      const rect  = vDiv.parentElement.getBoundingClientRect();
      const dw    = vDiv.offsetWidth;
      const edW   = Math.max(160, Math.min(mv.clientX - rect.left, rect.width - dw - 220));
      editorPane.style.flex  = 'none';
      editorPane.style.width = edW + 'px';
      outputPane.style.flex  = 'none';
      outputPane.style.width = (rect.width - edW - dw) + 'px';
      if (editor) editor.layout();
    };
    const onUp = () => {
      vDiv.classList.remove('active');
      document.body.classList.remove('resizing');
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ── Horizontal: compile ↔ run ──
  const hDiv           = document.querySelector('.h-divider');
  const compileSection = document.querySelector('.compile-section');
  const runSection     = document.querySelector('.run-section');

  hDiv.addEventListener('mousedown', e => {
    e.preventDefault();
    hDiv.classList.add('active');
    document.body.classList.add('resizing');
    document.body.style.cursor = 'row-resize';

    const onMove = mv => {
      const rect = hDiv.parentElement.getBoundingClientRect();
      const dh   = hDiv.offsetHeight;
      const cH   = Math.max(60, Math.min(mv.clientY - rect.top, rect.height - dh - 60));
      compileSection.style.flex   = 'none';
      compileSection.style.height = cH + 'px';
      runSection.style.flex       = 'none';
      runSection.style.height     = (rect.height - cH - dh) + 'px';
    };
    const onUp = () => {
      hDiv.classList.remove('active');
      document.body.classList.remove('resizing');
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

document.addEventListener('DOMContentLoaded', initDividers);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    build();
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
    e.preventDefault();
    format();
  }
});
