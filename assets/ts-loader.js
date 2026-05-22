// ESM shim: loads web-tree-sitter and the Leo grammar, then notifies app.js
// via a global event. app.js stays a plain script; this is the only ESM file.
import { Parser, Language, Query } from './web-tree-sitter.js';

const _base = new URL('.', import.meta.url).href;

async function load() {
  await Parser.init({
    locateFile(name) {
      return name === 'tree-sitter.wasm' ? new URL('web-tree-sitter.wasm', _base).href : name;
    },
  });
  const Leo = await Language.load(new URL('tree-sitter-leo.wasm', _base).href);
  const parser = new Parser();
  parser.setLanguage(Leo);
  const src = await fetch(new URL('highlights.scm', _base).href).then(r => r.text());
  const query = new Query(Leo, src);
  window._tsParser = parser;
  window._tsQuery  = query;
  window.dispatchEvent(new CustomEvent('ts-ready'));
}

load().catch(e => {
  console.warn('[ts-loader] failed:', e);
});
