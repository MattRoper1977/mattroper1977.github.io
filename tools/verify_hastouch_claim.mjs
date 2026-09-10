#!/usr/bin/env node
/*
 * The note in verify_inline_exit.mjs makes a claim about the file it lives in:
 *
 *     EVERY browser context opened below the rendered-leg header pins
 *     hasTouch: true ... the claim is that no context in this file omits
 *     hasTouch, not that it lives on a line.
 *
 * That claim is why /relicforge/ asserts 12 presses rather than 8. It is the
 * load-bearing sentence, and until now it was only a sentence. Prose is not
 * asserted, so it ages while the code beside it stays green — three times this
 * week (#141's stale F1 table, the /neonmeridian/ 59.5 fps column, and the
 * sentence this note replaced). This gate makes the claim fail like an
 * assertion instead of drifting like a comment.
 *
 * PARSED, NOT GREPPED
 * The file's own note names `hasTouch` repeatedly in prose. A regex counting
 * "hasTouch" would find those and call the claim satisfied by its own
 * documentation - the estate's oldest trap. Every count here comes from the
 * AST, so comments are invisible by construction, and the control below proves
 * it: a comment naming hasTouch does not make an omitting context compliant.
 *
 * WHY IT DOES NOT ASSERT LINE NUMBERS
 * The note originally cited :297, :307, :362 and :428. Those were correct when
 * written and wrong the moment the note grew, because the note sits above every
 * line it cites - it invalidated its own citations by being written. So this
 * gate locates the rendered leg by the TEXT of its header and reports the line
 * numbers it finds rather than checking them. Drift makes the printed numbers
 * move; it does not make the gate lie.
 *
 * EXITS  0 claim holds and controls fired · 1 a context omits hasTouch · 2 INCONCLUSIVE
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = process.argv[2] || path.join(HERE, 'verify_inline_exit.mjs');
const HEADER = 'rendered: the only evidence about rendered geometry';

function inconclusive(why, ...more) {
  console.error(`INCONCLUSIVE: ${why}`);
  for (const m of more) console.error(`  ${m}`);
  console.error('  This gate did not judge anything. That is not a pass.');
  process.exit(2);
}

let acorn;
for (const spec of ['acorn', path.join(HERE, '..', 'node_modules', 'acorn'), path.join(HERE, 'node_modules', 'acorn')]) {
  try { acorn = require_(spec); if (acorn) break; } catch (e) { /* next */ }
}
if (!acorn) inconclusive('acorn is not importable, so nothing was parsed.',
  'Install it first:  npm i --no-save acorn@8.18.0');
if (!fs.existsSync(TARGET)) inconclusive(`the file under test does not exist: ${TARGET}`);

function walk(node, fn) {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, fn));
    else if (v && typeof v.type === 'string') walk(v, fn);
  }
}

/* Every newContext(...) call in the file, with whether its options object
   declares hasTouch and whether it sits below the rendered-leg header. */
function contextsIn(src) {
  const headerAt = src.indexOf(HEADER);
  let ast;
  // allowHashBang rather than stripping the first line: the target starts with
  // #!/usr/bin/env node, and slicing it off would shift every offset this gate
  // reports line numbers from.
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module', allowHashBang: true }); }
  catch (e) { inconclusive(`the file under test does not parse: ${e.message}`); }
  const lineOf = off => src.slice(0, off).split('\n').length;

  /* WHICH RECEIVER MAKES A CONTEXT.
     browser.newPage() DOES open a fresh context - Playwright's own types say
     "Creates a new page in a new browser context" - but context.newPage() does
     NOT; it opens a page inside the context that already exists. Counting both
     was wrong in the opposite direction from ignoring both: it made the target
     report six contexts, three of them the ctx.newPage() calls that follow each
     newContext, and turned the main assertion red on a file that is correct.
     So receivers are resolved first: a name bound from .launch() is a browser,
     a name bound from .newContext() is a context. */
  const browsers = new Set(['browser']), contextsVars = new Set();
  const unwrap = e => (e && e.type === 'AwaitExpression') ? e.argument : e;
  walk(ast, n => {
    if (n.type !== 'VariableDeclarator' || !n.id || n.id.type !== 'Identifier') return;
    const init = unwrap(n.init);
    if (!init || init.type !== 'CallExpression' || !init.callee || init.callee.type !== 'MemberExpression') return;
    const m = init.callee.property && init.callee.property.name;
    if (m === 'launch' || m === 'connect') browsers.add(n.id.name);
    if (m === 'newContext') contextsVars.add(n.id.name);
  });

  const out = [];
  walk(ast, n => {
    if (n.type !== 'CallExpression') return;
    const callee = n.callee;
    if (!callee || callee.type !== 'MemberExpression') return;
    const name = callee.computed
      ? (callee.property.type === 'Literal' ? callee.property.value : null)
      : callee.property.name;
    /* newPage is here because Playwright's own types call it "Creates a new
       page in a new browser context", and its options include
       hasTouch?: boolean, "Defaults to false". A gate watching only
       newContext would let `browser.newPage({viewport:{...}})` open an
       untouch-capable context directly below the header and still exit 0 —
       measured, on a copy of the target. Both API doors, one claim. */
    if (name !== 'newContext' && name !== 'newPage') return;
    if (name === 'newPage') {
      const recv = callee.object;
      const recvName = recv && recv.type === 'Identifier' ? recv.name : null;
      // Only a browser's newPage mints a context. A context's newPage does not,
      // and an unresolvable receiver is reported rather than assumed either way.
      if (recvName && contextsVars.has(recvName)) return;
      if (recvName && !browsers.has(recvName)) return;
      if (!recvName) return;
    }
    const optsArg = n.arguments[0];
    let declares = false, value = null;
    if (optsArg && optsArg.type === 'ObjectExpression') {
      for (const p of optsArg.properties) {
        if (p.type !== 'Property') continue;
        const k = p.computed ? (p.key.type === 'Literal' ? p.key.value : null)
                             : (p.key.name || p.key.value);
        if (k === 'hasTouch') { declares = true; value = p.value.type === 'Literal' ? p.value.value : '(expression)'; }
      }
    }
    out.push({ api: name, line: lineOf(n.start), start: n.start, end: n.end,
               propStart: callee.property.start, declares, value,
               belowHeader: headerAt >= 0 && n.start > headerAt });
  });
  return { headerAt, headerLine: headerAt >= 0 ? lineOf(headerAt) : null, contexts: out };
}

const src = fs.readFileSync(TARGET, 'utf8');
const { headerAt, headerLine, contexts } = contextsIn(src);
if (headerAt < 0) inconclusive(`the rendered-leg header was not found in ${TARGET}`,
  `looked for: "${HEADER}"`,
  'Without it "below the header" has no meaning and the claim cannot be judged.');

let failed = 0;
const check = (ok, what, detail = '') => {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${what}${detail ? '  ·  ' + detail : ''}`);
  if (!ok) failed++;
};

const below = contexts.filter(c => c.belowHeader);
const omitting = below.filter(c => !c.declares);

console.log(`file            : ${path.relative(path.join(HERE, '..'), TARGET)}`);
console.log(`rendered leg at : line ${headerLine}  (located by text, not by a pinned number)`);
console.log(`newContext calls: ${contexts.length} total, ${below.length} below the header`);
for (const c of below) console.log(`  line ${String(c.line).padStart(4)}  hasTouch: ${c.declares ? c.value : 'ABSENT'}`);
console.log();

check(below.length > 0,
  'there are contexts below the header at all — a claim about none of them would be vacuous',
  `${below.length} found`);
check(omitting.length === 0,
  'no browser context below the rendered-leg header omits hasTouch — the note\'s claim, asserted',
  omitting.length ? `omitted at line(s) ${omitting.map(c => c.line).join(', ')}` : `${below.length} of ${below.length} declare it`);
check(below.every(c => c.value === true),
  'and every one of them pins it TRUE, which is why 12 is the number this file asserts',
  below.map(c => `${c.line}:${c.value}`).join(' '));

console.log('\n=== CONTROLS ===\n');

const scratch = fs.mkdtempSync('/tmp/hastouch-claim-');
const copy = path.join(scratch, 'target.mjs');

/* CONTROL 1 — inject a context that omits hasTouch. Must count 1. */
{
  /* The METHOD NAME's offset, from the AST. Two wrong anchors were tried first:
     src.indexOf('newContext(') is a raw text search inside a gate whose whole
     point is that it parses, and a maintainer comment carrying that literal
     would hijack it; n.start is the start of `browser.newContext(...)`, so
     injecting there yields `browser.browser.newContext` and a bare call the
     gate cannot see — it made three controls fail at once, which is how it was
     caught. callee.property.start is the offset of `newContext` itself. */
  const anchor = contexts.find(c => c.belowHeader).propStart;
  const injected = src.slice(0, anchor) +
    'newContext({ viewport: { width: 1, height: 1 } }); await browser.' +
    src.slice(anchor);
  fs.writeFileSync(copy, injected);
  const r = contextsIn(fs.readFileSync(copy, 'utf8'));
  const omit = r.contexts.filter(c => c.belowHeader && !c.declares);
  check(injected.length > src.length, 'CONTROL: the injection is real, not a no-op replace',
    `${src.length} B -> ${injected.length} B`);
  check(omit.length === 1, 'CONTROL: a context injected WITHOUT hasTouch is counted — the gate can go red',
    `${omit.length} omitting, at line ${omit.length ? omit[0].line : '-'}`);
}

/* CONTROL 2 — remove it again. Must return to 0, so the red was the injection
   and not something the copy did to the file. */
{
  /* Reads the COPY back after restoring it. The first version called
     contextsIn(src) — the pristine source, byte-identical to the main
     assertion's input — so it could not tell "the restore worked" from "the
     copy was never written", and would have passed even if CONTROL 1 had
     silently done nothing. */
  fs.writeFileSync(copy, src);
  const r = contextsIn(fs.readFileSync(copy, 'utf8'));
  const omit = r.contexts.filter(c => c.belowHeader && !c.declares);
  check(omit.length === 0 && r.contexts.length === contexts.length,
    'CONTROL: restoring the copy returns the count to 0 — read back from the copy, not from the original',
    `${omit.length} omitting, ${r.contexts.length} contexts seen in the restored copy`);
}

/* CONTROL 3 — the trap this gate exists to avoid. A COMMENT naming hasTouch,
   sitting immediately above a context that omits it, must not satisfy the
   claim. A regex-based version of this gate would pass here. */
{
  /* The METHOD NAME's offset, from the AST. Two wrong anchors were tried first:
     src.indexOf('newContext(') is a raw text search inside a gate whose whole
     point is that it parses, and a maintainer comment carrying that literal
     would hijack it; n.start is the start of `browser.newContext(...)`, so
     injecting there yields `browser.browser.newContext` and a bare call the
     gate cannot see — it made three controls fail at once, which is how it was
     caught. callee.property.start is the offset of `newContext` itself. */
  const anchor = contexts.find(c => c.belowHeader).propStart;
  const commented = src.slice(0, anchor) +
    '/* hasTouch: true hasTouch hasTouch — prose naming it three times */\n      ' +
    'newContext({ viewport: { width: 1, height: 1 } }); await browser.' +
    src.slice(anchor);
  fs.writeFileSync(copy, commented);
  const r = contextsIn(fs.readFileSync(copy, 'utf8'));
  const omit = r.contexts.filter(c => c.belowHeader && !c.declares);
  /* SIMULATE the naive gate on this same copy rather than counting mentions in
     the file as a whole. The first version of this line compared total textual
     occurrences of "hasTouch" against the number of contexts, which is true of
     any file carrying this tool's own prose — a tautology sitting beside the
     real assertion and contributing nothing, which is precisely the "inert
     decoration behind a green tick" this estate keeps finding. What a
     text-matching gate would actually do is look at each call site's own source
     span; the injected comment lands inside the CallExpression span, so that
     view records a declaration where the AST records none. Now the conjunct
     fails when the simulation is not fooled, so it measures rather than
     asserts. */
  const belowC = r.contexts.filter(c => c.belowHeader);
  const naiveGateSees = belowC.map(c => /hasTouch/.test(commented.slice(c.start, c.end)));
  const grepWouldPass = naiveGateSees.every(Boolean);
  check(omit.length === 1 && grepWouldPass,
    'CONTROL: a comment naming hasTouch does NOT satisfy the claim — a call-site grep IS fooled here, the AST is not',
    `AST: ${omit.length} omitting  ·  simulated text gate: ${naiveGateSees.filter(Boolean).length}/${belowC.length} look compliant, so it would have passed`);
}

/* CONTROLS 4-6 — the OTHER API door, pinned in all three directions.
   browser.newPage() opens a fresh context and takes hasTouch; ctx.newPage()
   does not. A gate watching only newContext exits 0 on the first of these,
   which is how the hole was found; a gate counting both turns red on the
   third, which is how the over-correction was found. */
{
  const hdr = src.indexOf(HEADER);
  const eol = src.indexOf('\n', hdr) + 1;
  const probe = inject => {
    fs.writeFileSync(copy, src.slice(0, eol) + inject + src.slice(eol));
    const r = contextsIn(fs.readFileSync(copy, 'utf8'));
    return r.contexts.filter(c => c.belowHeader && !c.declares).length;
  };
  check(probe('  const p0 = await browser.newPage({ viewport: { width: 390, height: 844 } });\n') === 1,
    'CONTROL: browser.newPage WITHOUT hasTouch is caught — the other API door is watched too');
  check(probe('  const p0 = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });\n') === 0,
    'CONTROL: browser.newPage WITH hasTouch is compliant, so the limb is not simply counting newPage');
  check(probe('  const c0 = await browser.newContext({ hasTouch: true }); const p0 = await c0.newPage();\n') === 0,
    'CONTROL: ctx.newPage() does NOT count — a page inside an existing context mints no context');
}

fs.rmSync(scratch, { recursive: true, force: true });
console.log(`\n${failed} failed`);
process.exit(failed ? 1 : 0);
