/*
 * F4.2 — the genre record has exactly TWO participants, and the estate can
 * prove it rather than believing it.
 *
 * WHAT WAS ALREADY PROVEN, AND WHAT WAS NOT
 * -----------------------------------------
 * verify_pupil_genres.mjs proves the two pages read ONE record, and proves it
 * properly: it edits /apexkick/'s genre in a scratch copy, re-renders, and
 * requires BOTH /games/ and /for/pupils/ to move (Sandbox & Creative 4 -> 5 on
 * each). That is agreement demonstrated by change, not by comparing two outputs
 * and calling the match a shared source.
 *
 * It does not bound the number of participants. A THIRD page could start
 * painting genres from a copied list tomorrow and every existing gate would
 * stay green — the two known pages would still agree, still from one record,
 * while a third drifted quietly beside them. That is the shape of the defect
 * this whole taxonomy collapse existed to end: `featured`, TAKES and TOP were
 * three sources where the page read two.
 *
 * WHY THE SWEEP LOOKS FOR TWO SIGNALS
 * -----------------------------------
 * The two participants paint the same record by different mechanisms, so no
 * single marker finds both:
 *
 *   /games/         builds <div id="genreSections"> at RUNTIME from TAXONOMY.
 *                   Its HTML contains no genre names at all.
 *   /for/pupils/    is pre-rendered by tools/render_audience_homepages.py, so
 *                   its genre names are baked into <summary> elements and its
 *                   script references nothing.
 *
 * A scan for either signal alone would miss one of them and report "exactly
 * one participant" — a green built on half a sweep. So a candidate is any page
 * that shows EITHER signal:
 *
 *   script   an inline script that references TAXONOMY / GENRE_ORDER / genreOf,
 *            counted from the AST so the record's own long comment about the
 *            taxonomy — which names all of these — cannot be mistaken for a use
 *   headings at least HEADING_FLOOR of the record's own genre names appearing
 *            as the text of a <summary> or <h1>-<h6>
 *
 * The genre names are read from the record, never listed here. A gate holding
 * its own copy of the thing it checks is a third source.
 *
 * Usage:  node tools/verify_genre_participants.mjs [repo-root]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv[2] || path.resolve(HERE, '..');
const PAGE = path.join(ROOT, 'games', 'index.html');

/* acorn is resolved, never assumed — same reasoning as verify_curation_keys.mjs.
   node_modules is gitignored, so a runner has it only if the workflow installed
   it, and a MODULE_NOT_FOUND stack trace is a crash rather than a judgement. */
let acorn;
for (const spec of ['acorn', path.join(HERE, '..', 'node_modules', 'acorn'), path.join(HERE, 'node_modules', 'acorn')]) {
  try { acorn = require_(spec); if (acorn) break; } catch (e) { /* next */ }
}
if (!acorn) {
  console.error('INCONCLUSIVE: acorn is not importable, so no page was parsed.');
  console.error('Install it first:  npm i --no-save acorn@8.18.0');
  console.error('This gate did not judge anything. That is not a pass.');
  process.exit(2);
}

let passed = 0, failed = 0;
const check = (ok, what, detail = '') => {
  if (ok) { passed++; console.log(`  [PASS] ${what}${detail ? '  ·  ' + detail : ''}`); }
  else { failed++; console.log(`  [FAIL] ${what}${detail ? '  ·  ' + detail : ''}`); }
};

const SCRIPT_RE = () => /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const JS_TYPE = /^(?:$|text\/javascript|application\/javascript|module)$/i;
const typeOf = attrs => (attrs.match(/\btype\s*=\s*["']?([^"'\s>]*)/i) || ['', ''])[1];
const RECORD_NAMES = new Set(['TAXONOMY', 'GENRE_ORDER', 'genreOf']);
// Two of nine. High enough that a page mentioning one genre in passing is not a
// participant; low enough that a page painting the taxonomy cannot slip under it
// by renaming a section. The control below drives a page across this line.
const HEADING_FLOOR = 2;

function walk(node, fn) {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, fn));
    else if (v && typeof v.type === 'string') walk(v, fn);
  }
}

/* The nine genre names, taken from the record itself. */
function genreNames() {
  const html = fs.readFileSync(PAGE, 'utf8');
  const re = SCRIPT_RE();
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!JS_TYPE.test(typeOf(m[1]))) continue;
    let ast;
    try { ast = acorn.parse(m[2], { ecmaVersion: 2020 }); } catch (e) { continue; }
    let found = null;
    walk(ast, n => {
      if (found) return;
      if (n.type === 'VariableDeclarator' && n.id.name === 'GENRE_ORDER' && n.init && n.init.type === 'ArrayExpression')
        found = n.init.elements.map(e => e && e.value).filter(v => typeof v === 'string');
    });
    if (found && found.length) return found;
  }
  throw new Error('GENRE_ORDER could not be read from the record');
}

const HEADING_RE = /<(summary|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                     .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

/* Both signals for one file. Returns which fired and why, so a candidate can be
   explained rather than merely counted. */
function signalsOf(file, names) {
  const html = fs.readFileSync(file, 'utf8');
  let scriptRefs = 0;
  const unparsed = [];
  const re = SCRIPT_RE();
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!JS_TYPE.test(typeOf(m[1]))) continue;
    let ast;
    try { ast = acorn.parse(m[2], { ecmaVersion: 2020 }); }
    catch (e) { unparsed.push(e.message.slice(0, 60)); continue; }
    walk(ast, n => {
      if (n.type === 'Identifier' && RECORD_NAMES.has(n.name)) scriptRefs++;
    });
  }
  const headings = new Set();
  let h;
  const hre = new RegExp(HEADING_RE.source, 'gi');
  while ((h = hre.exec(html)) !== null) {
    /* Match the genre name against each TEXT RUN inside the heading, not against
       the heading flattened whole. /for/pupils/ renders
         <summary><span class=gname>Arcade &amp; Reflex</span><span class=gnum>10 games</span></summary>
       with no whitespace between the spans, so flattening gives
       "Arcade & Reflex10 games" and equality fails — the gate reported the pupil
       page as a non-participant, which is the opposite of the truth. Splitting on
       tags asks "is this name the entire content of some element inside a
       heading", which is the structural question, and still refuses a name that
       merely appears inside a longer sentence. */
    for (const run of h[2].split(/<[^>]+>/)) {
      const text = decode(run);
      if (!text) continue;
      for (const n of names) if (text === n) headings.add(n);
    }
  }
  return { scriptRefs, headings: headings.size, unparsed };
}

function sweep(root) {
  const out = [];
  (function rec(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'audit-output', '_reference', '_served'].includes(e.name)) continue;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) rec(f);
      else if (/\.html$/i.test(e.name)) out.push(f);
    }
  })(root);
  return out;
}

function participants(root, names) {
  const files = sweep(root);
  const rows = [];
  for (const f of files) {
    const s = signalsOf(f, names);
    if (s.scriptRefs > 0 || s.headings >= HEADING_FLOOR)
      rows.push({ file: path.relative(root, f), ...s });
  }
  return { rows, scanned: files.length };
}

const names = genreNames();
console.log(`genre record: ${names.length} genres, read from GENRE_ORDER in games/index.html`);
console.log(`  ${names.join(' · ')}\n`);

const { rows, scanned } = participants(ROOT, names);
check(names.length === 9, 'the record declares nine genres', `${names.length}`);

/* Exactly one file may DECLARE the record. */
const declarers = sweep(ROOT).filter(f => {
  const html = fs.readFileSync(f, 'utf8');
  const re = SCRIPT_RE(); let m;
  while ((m = re.exec(html)) !== null) {
    if (!JS_TYPE.test(typeOf(m[1]))) continue;
    let ast; try { ast = acorn.parse(m[2], { ecmaVersion: 2020 }); } catch (e) { continue; }
    let hit = false;
    walk(ast, n => { if (n.type === 'VariableDeclarator' && n.id.name === 'TAXONOMY') hit = true; });
    if (hit) return true;
  }
  return false;
}).map(f => path.relative(ROOT, f));
check(declarers.length === 1 && declarers[0] === 'games/index.html',
  'exactly ONE file declares the genre record',
  declarers.join(', ') || 'none');

const unparsedAny = rows.flatMap(r => r.unparsed.map(u => `${r.file}: ${u}`));
check(unparsedAny.length === 0,
  'every JS block in every candidate parsed — nothing was skipped silently',
  unparsedAny.join('; ') || `${scanned} .html files scanned`);

const EXPECTED = ['games/index.html', 'for/pupils/index.html'];
const got = rows.map(r => r.file).sort();
check(rows.length === 2 && JSON.stringify(got) === JSON.stringify([...EXPECTED].sort()),
  'exactly TWO pages participate in the genre record',
  rows.map(r => `${r.file} (script=${r.scriptRefs} headings=${r.headings})`).join(' | ') || 'none');

/* Each participant must fire the signal it is supposed to fire. A page that
   qualified on the wrong signal would mean the sweep found it by accident. */
const hub = rows.find(r => r.file === 'games/index.html');
const pupil = rows.find(r => r.file === 'for/pupils/index.html');
check(!!hub && hub.scriptRefs > 0,
  '/games/ participates by reading the record at runtime',
  hub ? `${hub.scriptRefs} references, ${hub.headings} baked headings (it builds them in JS)` : 'not found');
check(!!pupil && pupil.headings === names.length,
  '/for/pupils/ participates by carrying every genre as a rendered heading',
  pupil ? `${pupil.headings} of ${names.length} headings, ${pupil.scriptRefs} script references` : 'not found');

console.log('\n=== CONTROLS ===\n');

const scratch = fs.mkdtempSync('/tmp/genre-participants-');
const copyTree = (src, dst) => {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (['node_modules', '.git', 'audit-output', '_reference', '_served'].includes(e.name)) continue;
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyTree(a, b);
    else if (/\.(html)$/i.test(e.name)) fs.copyFileSync(a, b);
  }
};
copyTree(ROOT, scratch);
const baseline = participants(scratch, names).rows.length;
check(baseline === 2, 'CONTROL: the scratch copy reproduces the shipped result before anything is changed', `${baseline} participants`);

/* POSITIVE: a third page starts painting genres. It must go red. */
{
  const third = path.join(scratch, 'third-participant.html');
  fs.writeFileSync(third,
    '<!doctype html><html><body>' +
    names.map(n => `<details><summary>${n.replace(/&/g, '&amp;')}</summary><p>x</p></details>`).join('') +
    '</body></html>');
  const r = participants(scratch, names);
  const found = r.rows.find(x => x.file === 'third-participant.html');
  check(r.rows.length === 3 && !!found,
    'CONTROL: a THIRD page painting the genres is detected — the gate can go red',
    `${r.rows.length} participants; the new one fired headings=${found ? found.headings : 0}`);
  fs.unlinkSync(third);
}

/* NEGATIVE: the same nine names as PROSE, not headings, and no script. A gate
   that is really a substring scanner would count this. */
{
  const prose = path.join(scratch, 'prose-only.html');
  fs.writeFileSync(prose,
    '<!doctype html><html><body><p>' +
    'Our games span ' + names.map(n => n.replace(/&/g, '&amp;')).join(', ') + '. ' +
    'That is every genre named in one sentence, and this page paints none of them.' +
    '</p></body></html>');
  const r = participants(scratch, names);
  check(r.rows.length === 2 && !r.rows.some(x => x.file === 'prose-only.html'),
    'CONTROL: all nine genre names in PROSE do not make a participant — the sweep is structural, not a substring match',
    `${r.rows.length} participants, prose page absent`);
  fs.unlinkSync(prose);
}

/* NEGATIVE: the record's own vocabulary inside a COMMENT. games/index.html
   carries a long comment naming TAXONOMY and GENRE_ORDER; this proves such a
   comment cannot by itself qualify a page. */
{
  const commented = path.join(scratch, 'comment-only.html');
  fs.writeFileSync(commented,
    '<!doctype html><html><body><script>\n' +
    '/* This page discusses TAXONOMY, GENRE_ORDER and genreOf at length,\n' +
    '   the way games/index.html does above its record, and reads none of them. */\n' +
    'var unrelated = 1;\n' +
    '</script></body></html>');
  const s = signalsOf(commented, names);
  const r = participants(scratch, names);
  check(s.scriptRefs === 0 && r.rows.length === 2,
    'CONTROL: a comment naming TAXONOMY / GENRE_ORDER / genreOf is invisible to the AST sweep',
    `scriptRefs=${s.scriptRefs}, participants still ${r.rows.length}`);
  fs.unlinkSync(commented);
}

/* POSITIVE: a third page that reads the record in CODE rather than painting it. */
{
  const reader = path.join(scratch, 'code-reader.html');
  fs.writeFileSync(reader,
    '<!doctype html><html><body><script>\n' +
    'var out = TAXONOMY.filter(function(t){ return genreOf(t) === GENRE_ORDER[0] });\n' +
    '</script></body></html>');
  const r = participants(scratch, names);
  const found = r.rows.find(x => x.file === 'code-reader.html');
  check(r.rows.length === 3 && !!found && found.scriptRefs >= 3,
    'CONTROL: a third page READING the record in code is caught too, not only one painting it',
    `${r.rows.length} participants; the new one fired script=${found ? found.scriptRefs : 0}`);
  fs.unlinkSync(reader);
}

fs.rmSync(scratch, { recursive: true, force: true });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
