#!/usr/bin/env node
/*
 * verify_takes_pin.mjs — Matt's curation voice, pinned.
 *
 * WHY THIS EXISTS, AND WHY IT IS SHAPED LIKE THIS.
 *
 * A pass renamed the Top Picks rail. It was authorised to change the heading.
 * It also rewrote the line underneath it — Matt's own first-person sentence
 * about his own curation — and then edited tools/verify_games_audience_faces.py
 * so that gate EXPECTED the new sentence. The gate went green. A gate that is
 * updated to agree with the diff has stopped being evidence; it adopted the
 * change it existed to catch. That is the fourth instance of this family in
 * this estate, so it is treated here as a class and not as an incident.
 *
 * The defence has three properties, and each one is doing work:
 *
 *  1. The reference is a HASH PINNED IN A SEPARATE RECORD (data/takes-pin.json),
 *     not a copy of the prose. Nothing here restates a take, so this file can
 *     never drift from the words and can never be "corrected" into agreement by
 *     someone editing copy.
 *
 *  2. The content is resolved from the COMMITTED BLOB — `git show HEAD:<path>` —
 *     never from the working tree. A renderer, a formatter or a sed in a build
 *     step can rewrite a file on disk; none of them can rewrite what is already
 *     committed at the commit under test. In CI, HEAD is exactly the thing being
 *     merged.
 *
 *  3. If the blob cannot be read, this FAILS. It does not fall back to the file.
 *     A gate that silently degrades to the weaker source is the same defect
 *     wearing a different hat.
 *
 * Moving a take is therefore a deliberate two-part act — change the words, and
 * change the pin — and the pin change is a visible line in the diff that a
 * reviewer must accept. That is the whole point: not to make edits impossible,
 * but to make them impossible to make BY ACCIDENT or as a side effect.
 *
 *   node tools/verify_takes_pin.mjs
 *   node tools/verify_takes_pin.mjs --print   # show current hashes, to re-pin
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PIN = join(ROOT, 'data/takes-pin.json');

const rows = [];
const check = (ok, name, detail = '') => {
  rows.push(ok);
  console.log(`  [${ok ? ' ok ' : 'FAIL'}] ${name}${detail ? '  — ' + detail : ''}`);
};
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

/* The committed blob. No try/return-empty: if this throws the gate dies loudly,
   which is the correct outcome — see property 3 above. */
function blobAtHead(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/* Region extraction. Both regions are delimited by text that is part of the
   page's structure rather than its prose, so re-wording a take moves the
   CONTENT of a region without moving its boundaries. */
function region(src, startNeedle, endNeedle, label) {
  const i = src.indexOf(startNeedle);
  if (i < 0) throw new Error(`${label}: start marker not found (${startNeedle}) — the page shape moved, fix the extractor before trusting any hash`);
  const j = src.indexOf(endNeedle, i + startNeedle.length);
  if (j < 0) throw new Error(`${label}: end marker not found (${endNeedle})`);
  return src.slice(i, j + endNeedle.length);
}

const REGIONS = [
  { key: 'curation', file: 'games/index.html', start: 'var CURATION=[', end: '\n];',
    what: "the per-game takes and rail slots" },
  { key: 'picksVoice', file: 'games/index.html', start: '<section class="sec" id="picks">', end: '</section>',
    what: "the Top Picks heading and the line under it" },
  /* LOCKED CHOOSER COPY. Not Matt's voice — the platform's promises about what
     choosing a homepage does and does not do. verify_games_audience_faces.py
     asserts these sentences by holding literal copies of them, and the control
     that guards it deletes a DIFFERENT sentence: it proves the guard can fire,
     not that the guard's expectation is immune to being co-updated. So the same
     class applies, and the same defence: the reference is a hash of the
     committed blob, not a copy of the words. */
  { key: 'chooserPromise', file: 'index.html', start: '<div class="mf-choice-intro">', end: '</nav>',
    what: "what choosing a homepage does and does not do" },
  { key: 'devicePreference', file: 'index.html', start: '<b>Last used on this device</b>', end: '</small>',
    what: "the on-device preference privacy sentence" },
];

const printing = process.argv.includes('--print');

console.log('\n=== MATT\'S TAKES ARE WHAT THE PIN SAYS THEY ARE ===\n');

let pin = null;
try {
  pin = JSON.parse(readFileSync(PIN, 'utf8'));
} catch (e) {
  if (!printing) { console.error(`  [FAIL] the pin record is unreadable — ${e.message}`); process.exit(1); }
}

const current = {};
let fatal = false;
for (const r of REGIONS) {
  let src;
  try {
    src = blobAtHead(r.file);
  } catch (e) {
    check(false, `${r.file}: readable as a committed blob at HEAD`,
      `${String(e.message).split('\n')[0]} — refusing to fall back to the working tree`);
    fatal = true;
    continue;
  }
  check(src.length > 0, `${r.file}: the committed blob is not empty`, `${src.length} B at HEAD`);
  const text = region(src, r.start, r.end, r.key);
  check(text.length > 0, `${r.key}: ${r.what} — region extracted`, `${text.length} B`);
  current[r.key] = sha(text);
}

if (printing) {
  console.log('\ncurrent hashes (paste into data/takes-pin.json to re-pin deliberately):');
  console.log(JSON.stringify({ regions: current }, null, 2));
  process.exit(0);
}
if (fatal) { console.error('\n1 FAILED'); process.exit(1); }

/* Non-vacuity: an empty pin record would make "every region matches" trivially
   true by having nothing to match. */
const pinned = (pin && pin.regions) || {};
check(Object.keys(pinned).length === REGIONS.length,
  'the pin record covers every region this gate extracts',
  `${Object.keys(pinned).length} pinned, ${REGIONS.length} extracted`);

for (const r of REGIONS) {
  const got = current[r.key], want = pinned[r.key];
  check(!!want, `${r.key}: has a pinned hash to be measured against`, want ? want.slice(0, 16) + '…' : 'NOT PINNED');
  if (!want) continue;
  check(got === want, `${r.key}: ${r.what} is unchanged from the pin`,
    got === want ? `${got.slice(0, 16)}…` : `HEAD ${got.slice(0, 16)}… vs pin ${want.slice(0, 16)}…`);
}

const pass = rows.filter(Boolean).length;
console.log(`\ntakes pin: ${pass}/${rows.length} passed`);
if (pass !== rows.length) {
  console.error(`${rows.length - pass} FAILED`);
  console.error("If a take was changed ON PURPOSE: re-run with --print and update data/takes-pin.json in the same commit, so the change is visible in the diff.");
  process.exit(1);
}
