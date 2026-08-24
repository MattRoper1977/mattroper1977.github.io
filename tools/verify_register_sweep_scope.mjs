#!/usr/bin/env node
/* The microcopy register sweep, scoped — and the scope proved.
 *
 * WHAT THIS GATE IS FOR, and what it is NOT for. It asserts that the sweep
 * looks in the right places and that hits are classified before they are
 * counted. It does NOT assert that the estate contains no banned phrasing, and
 * a green result here is not that claim. Whether "refresh to try again" in a
 * shelf error is evaluative microcopy or plain English is Matt's judgement, not
 * a gate's; the ship-side hits below are printed as a worklist for him, never
 * failed on and never rewritten from here.
 *
 * Saying that out loud is the point. A gate whose green is read as a stronger
 * claim than it makes is the same failure as a sweep that flags its own spec.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { classify, bannedPhrases } from './lib/register-sweep-scope.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = join(ROOT, 'schema/diagnostic-task.schema.json');

let pass = 0, fail = 0;
const ok = (n, c, d) => { c ? pass++ : fail++; console.log(`  ${c ? '[ ok ]' : '[FAIL]'} ${n}${d ? '  — ' + d : ''}`); };

const TEXT = /\.(html?|css|m?js|ts|json|md|py|sh|ya?ml|txt)$/i;
function walk(dir, rel = '', out = []) {
  for (const name of readdirSync(dir)) {
    const r = rel ? rel + '/' + name : name;
    if (classify(r).role === 'ignore') continue;
    const abs = join(dir, name);
    let st; try { st = statSync(abs); } catch (_) { continue; }
    if (st.isDirectory()) walk(abs, r, out);
    else if (TEXT.test(name) && st.size < 4_000_000) out.push(r);
  }
  return out;
}

const TERMS = bannedPhrases(SCHEMA);
console.log('=== THE REGISTER, DERIVED FROM THE SCHEMA THAT STATES IT ===\n');
console.log('       terms: ' + JSON.stringify(TERMS));
ok('the swept terms are derived, not retyped here', TERMS.length > 0, TERMS.length + ' term(s) read from schema/diagnostic-task.schema.json');

/* CONTROL — derivation, proved by moving the source. A hard-coded list would
   survive this unchanged, which is exactly what makes it a control. */
{
  const d = mkdtempSync(join(tmpdir(), 'sweepscope-'));
  const f = join(d, 'mutated.schema.json');
  writeFileSync(f, readFileSync(SCHEMA, 'utf8').replace("Replaces 'Try Again'", "Replaces 'Well Done'"));
  const mutated = bannedPhrases(f);
  ok('CONTROL: rewording the schema reworded the register',
    mutated.includes('Well Done') && !mutated.includes('Try Again'), JSON.stringify(mutated));
}

console.log('\n=== EVERY HIT CLASSIFIED BEFORE IT IS COUNTED ===\n');
const files = walk(ROOT);
const hits = { ship: [], spec: [] };
for (const rel of files) {
  let body; try { body = readFileSync(join(ROOT, rel), 'utf8'); } catch (_) { continue; }
  const lines = body.split('\n');
  for (const term of TERMS) {
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    lines.forEach((l, i) => {
      const m = l.match(rx);
      if (!m) return;
      const c = classify(rel);
      /* Excerpt centred on the MATCH. Printing the first 90 bytes of the line
         showed evidence that did not contain the thing being reported — a
         reader has to take the hit on trust, which is how a gate's output stops
         being read. */
      const at = Math.max(0, l.indexOf(m[0]) - 30);
      const text = (at ? '…' : '') + l.slice(at, at + 90).trim() + (l.length > at + 90 ? '…' : '');
      if (c.role !== 'ignore') hits[c.role].push({ rel, line: i + 1, why: c.why, text });
    });
  }
}
console.log(`       files swept: ${files.length}   ship hits: ${hits.ship.length}   spec hits: ${hits.spec.length}`);

/* The hit that started this. It must land in `spec` — it IS the rule. */
const schemaHit = hits.spec.find(h => h.rel === 'schema/diagnostic-task.schema.json');
ok('the schema\'s own statement of the rule is classified spec, not flagged as a breach',
  !!schemaHit && !hits.ship.some(h => h.rel.startsWith('schema/')),
  schemaHit ? `${schemaHit.rel}:${schemaHit.line} — ${schemaHit.why}` : 'the schema hit was not found at all');

/* CONTROL — the classifier must be doing work in BOTH directions. Zero spec
   hits would make the assertion above vacuous; zero ship hits would mean the
   sweep matched nothing anywhere and proves nothing about scope. */
ok('CONTROL: the sweep is live on both sides', hits.ship.length > 0 && hits.spec.length > 0,
  `${hits.ship.length} ship, ${hits.spec.length} spec`);

/* CONTROL — role, not directory. These two files share a directory and must
   not share a role. A "skip tools/" exclusion passes every other assertion in
   this file and silently drops the served Tools Hub out of the sweep. */
ok('CONTROL: role beats directory — tools/index.html is shipped, tools/*.js is not',
  classify('tools/index.html').role === 'ship' && classify('tools/verify_surfaces.js').role === 'spec',
  `index.html=${classify('tools/index.html').role}, verify_surfaces.js=${classify('tools/verify_surfaces.js').role}`);

/* CONTROL — a term nobody uses must count zero, or the counts above are noise. */
{
  /* Built at run time, never written down. The first draft of this control
     spelled the sentinel out as a literal — and this gate sweeps the whole
     estate, including itself, so the phrase nobody uses was used, here, by the
     control asserting nobody used it. It failed, correctly, and it is the same
     shape as the schema hit that this whole file exists to classify. */
  const absent = ['zzq', 'no', 'such', 'phrase'].join('-') + '-' + 'zzq';
  const found = files.some(rel => { try { return readFileSync(join(ROOT, rel), 'utf8').includes(absent); } catch (_) { return false; } });
  ok('CONTROL: a phrase nobody uses returns nothing', !found, 'swept ' + files.length + ' files for an absent term');
}

console.log('\n=== SHIP-SIDE HITS — MATT\'S WORKLIST, NOT THIS GATE\'S VERDICT ===\n');
if (!hits.ship.length) console.log('       (none)');
for (const h of hits.ship) console.log(`       ${h.rel}:${h.line}  ${h.text}`);
console.log('\n=== SPEC-SIDE HITS — EXCLUDED BY ROLE, LISTED SO THE EXCLUSION IS VISIBLE ===\n');
for (const h of hits.spec) console.log(`       ${h.rel}:${h.line}  (${h.why})  ${h.text}`);

console.log(`\nregister sweep scope: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
