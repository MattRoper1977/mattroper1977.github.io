#!/usr/bin/env node
/**
 * G-EGRESS — canonical game payloads may not ship third-party signalling URLs.
 *
 * The gate derives its subjects from data/mbm-search-index.json. It inspects
 * quoted literals outside HTML/JavaScript/CSS comments, so gameplay fields
 * such as `{stun: 0}` or `{turn: 1}` are not mistaken for network endpoints.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_ROUTE = /^\/[A-Za-z0-9_-]+\/$/;
const URL_LITERAL = /\bwss?:\/\/[^\s"'`<>]+|\b(?:stun|turn):(?:\/\/)?(?:\[[0-9a-f:]+\]|localhost|[a-z0-9_-]+(?:\.[a-z0-9_-]+)+)(?::\d+)?(?:[/?][^\s"'`<>]*)?/ig;
/* An unquoted websocket URL is unambiguous in mixed HTML/JS source. Bare
   `turn:object.member` is valid JavaScript label/property syntax, so STUN and
   TURN are judged as string literals by URL_LITERAL rather than guessed from
   punctuation outside a string. */
const DIRECT_URL_LITERAL = /^wss?:\/\/[^\s"'`<>]+/i;

function lineAt(text, offset) {
  let line = 1;
  for (let i = 0; i < offset; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

export function scanText(text) {
  const findings = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('<!--', i)) {
      const end = text.indexOf('-->', i + 4);
      i = end < 0 ? text.length : end + 3;
      continue;
    }
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 2;
      continue;
    }
    if (text.startsWith('//', i)) {
      const end = text.indexOf('\n', i + 2);
      i = end < 0 ? text.length : end + 1;
      continue;
    }
    const quote = text[i];
    if (quote !== '"' && quote !== "'" && quote !== '`') {
      const direct = text.slice(i).match(DIRECT_URL_LITERAL);
      if (direct) {
        findings.push({ literal: direct[0], line: lineAt(text, i) });
        i += direct[0].length;
        continue;
      }
      i += 1;
      continue;
    }
    const start = i;
    i += 1;
    let literal = '';
    while (i < text.length) {
      const ch = text[i];
      if (ch === '\\') {
        literal += ch;
        if (i + 1 < text.length) literal += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) {
        i += 1;
        break;
      }
      literal += ch;
      i += 1;
    }
    URL_LITERAL.lastIndex = 0;
    for (const match of literal.matchAll(URL_LITERAL)) {
      findings.push({ literal: match[0], line: lineAt(text, start) });
    }
  }
  return findings;
}

function subjects(root) {
  const indexPath = join(root, 'data', 'mbm-search-index.json');
  const entries = JSON.parse(readFileSync(indexPath, 'utf8')).entries;
  const routes = [...new Set(entries
    .filter(entry => entry && entry.category === 'game' && ROOT_ROUTE.test(entry.route || ''))
    .map(entry => entry.route))].sort();
  if (!routes.length) throw new Error('INCONCLUSIVE: no canonical root game routes were derived');
  return routes.map(route => ({ route, path: join(root, route.slice(1), 'index.html') }));
}

export function checkRoot(root = ROOT) {
  const checked = [];
  const bad = [];
  for (const subject of subjects(root)) {
    let text;
    try {
      text = readFileSync(subject.path, 'utf8');
    } catch (error) {
      bad.push(`${subject.route} has no readable index.html: ${error.message}`);
      continue;
    }
    checked.push(subject.route);
    for (const finding of scanText(text)) {
      bad.push(`${subject.route}index.html:${finding.line} contains prohibited egress literal ${finding.literal}`);
    }
  }
  return { checked, bad };
}

function selfTest() {
  const scratch = mkdtempSync(join(tmpdir(), 'v6-egress-'));
  try {
    mkdirSync(join(scratch, 'data'), { recursive: true });
    mkdirSync(join(scratch, 'control'), { recursive: true });
    writeFileSync(join(scratch, 'data', 'mbm-search-index.json'), JSON.stringify({
      entries: [{ category: 'game', route: '/control/' }],
    }));
    const clean = `<script>const state={stun:0,turn:1}; const note='your turn: now';</script>\n<!-- wss://comment.invalid -->`;
    writeFileSync(join(scratch, 'control', 'index.html'), clean);
    const baseline = checkRoot(scratch);
    if (baseline.bad.length) throw new Error(`baseline false positive: ${baseline.bad.join('; ')}`);

    const controls = [
      'stun:stun.example.invalid:3478',
      'turn:turn.example.invalid:3478',
      'ws://signal.example.invalid/socket',
      'wss://signal.example.invalid/socket',
    ];
    for (const value of controls) {
      writeFileSync(join(scratch, 'control', 'index.html'), `${clean}\n<script>const planted='${value}'</script>`);
      const result = checkRoot(scratch);
      const fired = result.bad.length === 1 && result.bad[0].includes(value);
      console.log(`G-EGRESS control ${value}: ${fired ? 'FIRED' : 'DID NOT FIRE'}`);
      if (!fired) throw new Error(`control failed to red for ${value}: ${result.bad.join('; ')}`);
    }
    writeFileSync(join(scratch, 'control', 'index.html'), `${clean}\n<div data-signal=ws://unquoted.example.invalid/socket></div>`);
    const unquoted = checkRoot(scratch);
    const unquotedFired = unquoted.bad.length === 1 && unquoted.bad[0].includes('ws://unquoted.example.invalid/socket');
    console.log(`G-EGRESS control unquoted URL: ${unquotedFired ? 'FIRED' : 'DID NOT FIRE'}`);
    if (!unquotedFired) throw new Error(`control failed to red for an unquoted URL: ${unquoted.bad.join('; ')}`);
    console.log('[SELF-TEST] PASS — four quoted literals and one unquoted literal produced five named reds');
    return 0;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  try {
    const result = checkRoot(ROOT);
    for (const failure of result.bad) console.error(`[FAIL] ${failure}`);
    console.log(`G-EGRESS: ${result.checked.length} canonical root game payload(s) checked; ${result.bad.length} prohibited literal(s)`);
    return result.bad.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
