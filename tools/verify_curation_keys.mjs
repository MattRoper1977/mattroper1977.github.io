/*
 * Curation keys resolve, or this goes red.
 *
 * The defect this exists for: games/index.html used to key curation on TITLE
 * — TAKES[g.title], TOP.forEach(t => gs.find(x => x.title === t)) — and the
 * renderer guarded the lookup with `if (g)`. A title that failed to resolve
 * was therefore SKIPPED IN SILENCE. Renaming a game deleted its take and
 * shortened the Top Picks rail with nothing anywhere going red. That was
 * measured, not theorised: renaming Trail Runner in a scratch manifest took
 * the rail from 4 cards to 3 and raised no error, on a tree where every gate
 * was green.
 *
 * So curation is keyed on href now, and this asserts the property that makes
 * that safe: every curated key and every rail key resolves to EXACTLY ONE
 * live manifest entry. Not "at least one" — exactly one, because "Relicforge"
 * matched two entries by title and a key that matches twice is not a key.
 *
 * Two things about how it reads the file, both deliberate:
 *
 * 1. The record is pulled out of the ACORN AST, never by regex over the
 *    source. The comment block above CURATION in games/index.html names
 *    hrefs, `featured`, TAKES and TOP in prose. A regex scanner would count
 *    its own documentation and report keys that do not exist — and, worse,
 *    would go green on a `featured` reader that happened to sit in a comment.
 *    An AST cannot see a comment.
 *
 * 2. The `featured` claim is narrow enough to be provable. The claim is not
 *    "nothing anywhere reads featured" — this repository cannot prove that
 *    about the estate. It is: the pages here that fetch /Games/games.json are
 *    enumerated by sweeping the tree, and none of them reads `featured`. The
 *    enumeration is not assumed, and that matters: this limb was first written
 *    asserting there was exactly one such page, and it went red on its first
 *    run, because main/index.html fetches the shelf too. A hand-written list
 *    would have been wrong and silent. Both halves are measured, and the
 *    second is controlled by injecting a read and proving the scan reds.
 *
 * Usage: node tools/verify_curation_keys.mjs [repo-root]
 *        node tools/verify_curation_keys.mjs --emit   (canonical record only,
 *        for the cross-process determinism limb; prints nothing else)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
/* acorn is resolved, never assumed. node_modules is gitignored, so a runner
   has it only because the workflow installed it — and a MODULE_NOT_FOUND
   stack trace is a crash, not a judgement. If it cannot be found this exits 2
   and says so, because a gate that did not run must not be mistaken for one
   that passed. (It went red exactly this way on its first CI run.) */
let acorn;
for (const spec of ['acorn', path.join(HERE, '..', 'node_modules', 'acorn'), path.join(HERE, 'node_modules', 'acorn')]) {
  try { acorn = require_(spec); if (acorn) break; } catch (e) { /* next */ }
}
if (!acorn) {
  console.error('INCONCLUSIVE: acorn is not importable, so the record was never parsed.');
  console.error('Install it first:  npm i --no-save acorn@8.18.0');
  console.error('This gate did not judge anything. That is not a pass.');
  process.exit(2);
}

const EMIT = process.argv.includes('--emit');
const ROOT = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(HERE, '..');
const PAGE = path.join(ROOT, 'games', 'index.html');
const MANIFEST = path.join(ROOT, 'data', 'source-manifests', 'games.json');

/* ---------------- extraction (AST only) ---------------- */

const SCRIPT_RE = () => /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;

/* A <script type="application/ld+json"> is data, not code, and acorn rightly
   refuses it. Skipping it is correct; skipping it QUIETLY is not — a scanner
   that drops blocks it cannot read will one day drop the block that mattered.
   So non-JS types are recognised by their declared type, counted, and named
   in the output, and anything that is JS and still will not parse is a red. */
const JS_TYPE = /^(?:$|text\/javascript|application\/javascript|module)$/i;
const typeOf = attrs => (attrs.match(/\btype\s*=\s*["']?([^"'\s>]*)/i) || ['', ''])[1];

function scriptCarrying(html, needle) {
  const re = SCRIPT_RE();
  let m;
  while ((m = re.exec(html)) !== null) if (m[2].includes(needle)) return m[2];
  throw new Error(`no inline <script> carrying ${needle}`);
}

/* Count `featured` reads across EVERY inline script of a file. A script that
   will not parse is reported, never skipped: a scanner that silently drops
   the one block it could not read is a scanner that proves nothing. */
function featuredReadsIn(file) {
  const html = fs.readFileSync(file, 'utf8');
  const re = SCRIPT_RE();
  let m, reads = 0, blocks = 0;
  const unparsed = [], skipped = [];
  while ((m = re.exec(html)) !== null) {
    if (!m[2].trim()) continue;
    const t = typeOf(m[1]);
    if (!JS_TYPE.test(t)) { skipped.push(t || '(untyped)'); continue; }
    blocks++;
    let ast;
    try { ast = acorn.parse(m[2], { ecmaVersion: 2020 }); }
    catch (e) { unparsed.push(`offset ${m.index}: ${e.message}`); continue; }
    walk(ast, n => {
      if (n.type === 'MemberExpression') {
        const name = n.computed ? (n.property.type === 'Literal' ? n.property.value : null) : n.property.name;
        if (name === 'featured') reads++;
      }
      if (n.type === 'Property' && (n.key.name === 'featured' || n.key.value === 'featured')) reads++;
    });
  }
  return { reads, blocks, unparsed, skipped };
}

function walk(node, fn) {
  if (!node || typeof node.type !== 'string') return;
  fn(node);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => walk(c, fn));
    else if (v && typeof v.type === 'string') walk(v, fn);
  }
}

function literal(node) {
  if (node.type === 'Literal') return node.value;
  throw new Error(`expected a literal, got ${node.type} at ${node.start}`);
}

function declaratorInit(ast, name) {
  let found = null;
  walk(ast, n => {
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === name && !found) found = n.init;
  });
  if (!found) throw new Error(`no declaration of ${name}`);
  return found;
}

function readPage() {
  const html = fs.readFileSync(PAGE, 'utf8');
  const src = scriptCarrying(html, 'var CURATION=');
  const ast = acorn.parse(src, { ecmaVersion: 2020 });

  const curation = declaratorInit(ast, 'CURATION').elements.map(el => {
    const rec = {};
    for (const p of el.properties) rec[p.key.name || p.key.value] = literal(p.value);
    return rec;
  });

  const taxonomy = declaratorInit(ast, 'TAXONOMY').elements.map(el => {
    const rec = {};
    for (const pr of el.properties) {
      const k = pr.key.name || pr.key.value;
      rec[k] = pr.value.type === 'ArrayExpression' ? pr.value.elements.map(literal) : literal(pr.value);
    }
    return rec;
  });
  const genreOrder = declaratorInit(ast, 'GENRE_ORDER').elements.map(literal);
  const feelOrder = declaratorInit(ast, 'FEEL_ORDER').elements.map(el => literal(el.elements[0]));

  /* `tag` is the manifest's OTHER taxonomy. The genre record is authoritative,
     so the page must not read tag for display — two taxonomies on one page is
     the drift this record exists to end. Counted from the AST like `featured`. */
  let tagReads = 0;
  walk(ast, n => {
    if (n.type === 'MemberExpression') {
      const nm = n.computed ? (n.property.type === 'Literal' ? n.property.value : null) : n.property.name;
      if (nm === 'tag') tagReads++;
    }
  });

  /* Every read of a `.featured` / ['featured'] member, and any object literal
     key named featured. Comments are invisible to this by construction. */
  const featuredReads = [];
  walk(ast, n => {
    if (n.type === 'MemberExpression') {
      const name = n.computed
        ? (n.property.type === 'Literal' ? n.property.value : null)
        : n.property.name;
      if (name === 'featured') featuredReads.push(n.start);
    }
    if (n.type === 'Property' && (n.key.name === 'featured' || n.key.value === 'featured')) featuredReads.push(n.start);
  });

  return { curation, taxonomy, genreOrder, feelOrder, tagReads, featuredReads };
}

function canonical({ curation, taxonomy }) {
  /* Sorted and re-serialised, so the digest is a property of the RECORD and
     not of how the file happens to be laid out. */
  return JSON.stringify({
    curation: curation.map(c => ({ href: c.href, rail: c.rail ?? null, take: c.take })).sort((a, b) => a.href.localeCompare(b.href)),
    taxonomy: taxonomy.map(t => ({ href: t.href, genre: t.genre, feels: [...(t.feels || [])].sort() })).sort((a, b) => a.href.localeCompare(b.href))
  });
}

if (EMIT) { process.stdout.write(canonical(readPage())); process.exit(0); }

/* ---------------- the gate ---------------- */

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? `  ·  ${detail}` : ''}`);
  return ok;
};
const norm = h => String(h || '').replace(/^https?:\/\/[^/]*(?:mattroper1977\.github\.io|madebymatt\.uk)/i, '');

function manifestFrom(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return raw.games || raw;
}

/* The orphan rule, as a function so a scratch manifest can be run through the
   identical code path — a control that exercises a re-implementation proves
   nothing about the gate that ships. */
function orphans(record, games) {
  const byHref = new Map();
  for (const g of games) {
    const k = norm(g.href);
    byHref.set(k, (byHref.get(k) || 0) + 1);
  }
  const out = [];
  const claim = (kind, key) => {
    const n = byHref.get(norm(key)) || 0;
    if (n !== 1) out.push({ kind, key, matches: n });
  };
  record.curation.forEach(c => claim('curated', c.href));
  record.curation.filter(c => c.rail).forEach(c => claim('rail', c.href));
  record.taxonomy.forEach(t => claim('genre', t.href));
  return out;
}

const record = readPage();
const games = manifestFrom(MANIFEST);

console.log('=== CURATION KEYS RESOLVE ===\n');
console.log(`  manifest entries: ${games.length}   curated: ${record.curation.length}   railed: ${record.curation.filter(c => c.rail).length}   taxonomy entries: ${record.taxonomy.length}   genres: ${record.genreOrder.length}   feels: ${record.feelOrder.length}\n`);

const orph = orphans(record, games);
check(orph.length === 0, 'every curated / rail / theme key resolves to exactly one manifest entry',
  orph.length ? orph.map(o => `${o.kind} ${o.key} -> ${o.matches} matches`).join('; ') : `${record.curation.length + record.curation.filter(c => c.rail).length + record.taxonomy.length} keys, 0 orphans`);

const dupes = record.curation.map(c => norm(c.href)).filter((h, i, a) => a.indexOf(h) !== i);
check(dupes.length === 0, 'no href appears twice in the record', dupes.join(', ') || `${record.curation.length} distinct`);

const rails = record.curation.filter(c => c.rail).map(c => c.rail).sort((a, b) => a - b);
check(JSON.stringify(rails) === JSON.stringify(rails.map((_, i) => i + 1)),
  'rail positions are 1..N with no gap and no tie', `[${rails.join(', ')}]`);

const emptyTake = record.curation.filter(c => !String(c.take || '').trim());
check(emptyTake.length === 0, 'every curated entry carries a non-empty take',
  emptyTake.map(c => c.href).join(', ') || `${record.curation.length} takes`);

const railNoTake = record.curation.filter(c => c.rail && !String(c.take || '').trim());
check(railNoTake.length === 0, 'no rail slot without a take — the rail may not paint empty quotation marks',
  railNoTake.map(c => c.href).join(', ') || `${rails.length} rail slots, ${rails.length} takes`);

/* ---------------- the taxonomy ---------------- */

/* One genre per game, exactly — counted per href rather than trusted to the
   shape of the array, because an array can hold the same href twice and a map
   would silently keep only the last. Zero and two are both RED. */
function genreCensus(taxonomy, games) {
  const per = new Map();
  for (const t of taxonomy) {
    const k = norm(t.href);
    per.set(k, (per.get(k) || 0) + 1);
  }
  const twice = [...per].filter(([, n]) => n > 1).map(([h, n]) => `${h} x${n}`);
  const none = games.map(g => norm(g.href)).filter(h => !per.has(h));
  return { per, twice, none };
}

const cens = genreCensus(record.taxonomy, games);
check(cens.none.length === 0, 'every manifest game has a genre — none is left out',
  cens.none.join(', ') || `${games.length} games, ${record.taxonomy.length} taxonomy entries`);
check(cens.twice.length === 0, 'no game carries two genres',
  cens.twice.join(', ') || `${cens.per.size} games, each appearing exactly once`);

const byGenre = new Map();
for (const t of record.taxonomy) byGenre.set(t.genre, (byGenre.get(t.genre) || 0) + 1);
const undeclared = [...byGenre.keys()].filter(g => !record.genreOrder.includes(g));
check(undeclared.length === 0, 'every genre used is declared in GENRE_ORDER', undeclared.join(', ') || `${byGenre.size} genres`);
const empty = record.genreOrder.filter(g => !byGenre.has(g));
check(empty.length === 0, 'every declared genre has at least one game', empty.join(', ') || 'none empty');

/* The floor is 2, ruled hard: a genre below it is RED, not a warning. */
const FLOOR = 2;
const thin = [...byGenre].filter(([, n]) => n < FLOOR);
check(thin.length === 0, `no genre holds fewer than ${FLOOR} games`,
  thin.map(([g, n]) => `${g}=${n}`).join(', ') || [...byGenre].map(([g, n]) => `${g}=${n}`).join(' '));

const CATCH_ALL = /^(other|misc|miscellaneous|uncategoris?ed|general|everything else)$/i;
const bucket = record.genreOrder.filter(g => CATCH_ALL.test(g.trim()));
check(bucket.length === 0, 'no catch-all bucket genre', bucket.join(', ') || `${record.genreOrder.length} named genres`);

const feelsUsed = new Set(record.taxonomy.flatMap(t => t.feels || []));
const badFeels = [...feelsUsed].filter(f => !record.feelOrder.includes(f));
check(badFeels.length === 0, 'every feel used is declared in FEEL_ORDER', badFeels.join(', ') || [...feelsUsed].sort().join(' '));
const noFeel = record.taxonomy.filter(t => !(t.feels || []).length);
check(noFeel.length === 0, 'every game carries at least one feel', noFeel.map(t => t.href).join(', ') || `${record.taxonomy.length} games`);

/* Rule 6: the three themed grids were MIGRATED into feels, not discarded.
   Asserted member by member — the grids are gone from the page, so this is the
   only surviving evidence that the curation work came with them. */
const MIGRATED = [
  ['PHYSICS & GRAVITY', '/Lessons/Games/Orbital.html', 'gravity'],
  ['PHYSICS & GRAVITY', '/Lessons/Games/Marble.html', 'gravity'],
  ['REFLEX & SPEED', '/Lessons/Games/Trail_Runner.html', 'fast'],
  ['REFLEX & SPEED', '/Lessons/Games/Trekkers_Trail_Runner_Tees_Coast.html', 'fast'],
  ['REFLEX & SPEED', '/Lessons/Games/Grid_Chase.html', 'fast'],
  ['CALM & STRATEGY', '/Lessons/Games/Neon_Garden.html', 'calm'],
  ['CALM & STRATEGY', '/Lessons/Games/Neon_Siege.html', 'thinky']
];
const feelOf = new Map(record.taxonomy.map(t => [norm(t.href), t.feels || []]));
const lost = MIGRATED.filter(([, h, f]) => !(feelOf.get(norm(h)) || []).includes(f));
check(lost.length === 0, 'every former themed-grid member kept its migrated feel',
  lost.map(([r, h, f]) => `${r} ${h} lost '${f}'`).join('; ') || `${MIGRATED.length}/${MIGRATED.length} migrated`);

check(record.tagReads === 0, 'the page never reads the manifest `tag` field — one taxonomy, not two',
  `${record.tagReads} reads`);

/* Hrefs that must never be curated, and why. Under title-keying a third
   Slipstream could have drifted in on a near-match; this pins the ruling so
   the protection is asserted rather than merely argued in a comment. */
const NEVER_CURATED = [
  ['/hyperdraft/', 'Slipstream GP: Hyperdraft — a third Slipstream must not enter curation silently'],
  ['/neonbreach/', 'Neon Breach — the real game behind the "Neon Beach" typo, but it has no take'],
  ['/rallyvector3d/', 'Rally Vector 3D — matched by href so its title is irrelevant, but it has no take']
];
const curatedSet = new Set(record.curation.map(c => norm(c.href)));
const intruders = NEVER_CURATED.filter(([h]) => curatedSet.has(h));
check(intruders.length === 0, 'the hrefs ruled out of curation are absent from the record',
  intruders.map(([h]) => h).join(', ') || NEVER_CURATED.map(([h]) => h).join(' '));
check(NEVER_CURATED.every(([h]) => (games.filter(g => norm(g.href) === h).length === 1)),
  'and each of them is a real manifest entry, so the exclusion is about a game that exists',
  NEVER_CURATED.map(([h]) => `${h}=${games.filter(g => norm(g.href) === h).length}`).join(' '));

/* --- the featured claim, both halves --- */
const fetchers = [];
(function sweep(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'audit-output') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) sweep(f);
    else if (/\.html$/.test(e.name) && fs.readFileSync(f, 'utf8').includes('/Games/games.json')) fetchers.push(path.relative(ROOT, f));
  }
})(ROOT);
check(fetchers.includes('games/index.html') && fetchers.length > 0,
  'the shelf-fetching pages are enumerated, so the claim below covers all of them',
  `${fetchers.length}: ${fetchers.join(', ')}`);
const scans = fetchers.map(f => ({ f, ...featuredReadsIn(path.join(ROOT, f)) }));
const unparsed = scans.flatMap(s => s.unparsed.map(u => `${s.f} ${u}`));
check(unparsed.length === 0, 'every JS block in those pages parsed; non-JS blocks are named, not silently dropped',
  unparsed.join('; ') || `${scans.reduce((n, s) => n + s.blocks, 0)} JS blocks parsed, ${scans.reduce((n, s) => n + s.skipped.length, 0)} non-JS skipped [${scans.flatMap(s => s.skipped).join(', ') || 'none'}]`);
const totalReads = scans.reduce((n, s) => n + s.reads, 0);
check(totalReads === 0,
  'no shelf-fetching page reads `featured` (AST, so the record\'s own comment does not count)',
  scans.map(s => `${s.f}=${s.reads}`).join(' '));

/* --- cross-process determinism --- */
const here = canonical(record);
const child = execFileSync(process.execPath, [fileURLToPath(import.meta.url), ROOT, '--emit'], { encoding: 'utf8' });
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
check(sha(child) === sha(here),
  'the extracted record is identical in a SEPARATE process, not merely stable within this one',
  `${sha(here)} (this process) vs ${sha(child)} (child pid)`);

/* ---------------- controls ---------------- */

console.log('\n=== CONTROLS ===\n');

const scratchManifest = (mutate) => {
  const copy = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  mutate(copy.games || copy);
  const f = path.join(fs.mkdtempSync('/tmp/curation-'), 'games.json');
  fs.writeFileSync(f, JSON.stringify(copy));
  return f;
};

/* Positive control, direction one: the gate is not always-green. Break the
   manifest the way the OLD keying broke — take the href away. */
{
  /* Two games, because no single one is curated AND railed AND themed, and a
     control that exercises one key kind says nothing about the other two.
     /apexkick/ is curated + railed; Trail Runner is curated + themed. Between
     them every kind the orphan rule emits is driven red at least once, and
     that is asserted rather than assumed. */
  const MOVE = ['/apexkick/', '/Lessons/Games/Trail_Runner.html'];
  const found = MOVE.flatMap(href => {
    const f = scratchManifest(gs => { gs.find(g => g.href === href).href = href.replace(/\/?$/, '') + '_MOVED/'; });
    return orphans(record, manifestFrom(f)).filter(x => x.key === href);
  });
  const kinds = new Set(found.map(x => x.kind.split(':')[0]));
  check(found.length > 0 && kinds.has('curated') && kinds.has('rail') && kinds.has('genre'),
    'CONTROL: move a game\'s href and the gate goes RED — on every kind of key it holds',
    found.map(x => `${x.kind} ${x.key} -> ${x.matches}`).join('; ') || 'stayed green — the gate is a no-op');
}

/* Direction two: a key that matches TWICE is caught, not silently taking the
   first hit. This is the "Relicforge" case that title-keying could not see. */
{
  const f = scratchManifest(gs => { gs.push({ ...gs.find(g => g.href === '/apexkick/'), title: 'Apex Kick (duplicate)' }); });
  const o = orphans(record, manifestFrom(f));
  check(o.some(x => x.key === '/apexkick/' && x.matches === 2),
    'CONTROL: a key matching two manifest entries is RED, not first-wins',
    o.filter(x => x.key === '/apexkick/').map(x => `${x.matches} matches`).join('') || 'not caught');
}

/* Direction three: the thing the whole re-keying was for. A pure TITLE rename
   must now be a non-event. If this ever reds, href-keying has been undone. */
{
  const f = scratchManifest(gs => { gs.find(g => g.href === '/Lessons/Games/Trail_Runner.html').title = 'Trail Runner RENAMED'; });
  const o = orphans(record, manifestFrom(f));
  check(o.length === 0,
    'CONTROL: renaming a game\'s TITLE is now a non-event — the defect this replaced',
    `${o.length} orphans after the rename that used to shrink the rail 4 -> 3`);
}

/* The exclusion list must be able to fail too, or it is decoration. */
{
  const smuggled = { curation: [...record.curation, { href: '/hyperdraft/', take: 'x' }], taxonomy: record.taxonomy };
  const set = new Set(smuggled.curation.map(c => norm(c.href)));
  check(NEVER_CURATED.some(([h]) => set.has(h)),
    'CONTROL: smuggle /hyperdraft/ into the record and the exclusion limb catches it',
    `${NEVER_CURATED.filter(([h]) => set.has(h)).length} intruder(s) detected, shipped tree has ${intruders.length}`);
}

/* The taxonomy limbs must each be able to fail. Every mutation below runs
   through genreCensus / the same counters the shipping limbs use — a control
   that exercises a re-implementation proves nothing about the gate. */
{
  const two = [...record.taxonomy, { href: '/voxel/', genre: 'Sports', feels: ['calm'] }];
  const c = genreCensus(two, games);
  check(c.twice.length === 1 && c.twice[0].startsWith('/voxel/'),
    'CONTROL: a game placed in TWO genres is caught',
    c.twice.join(', ') || 'not caught — the one-genre limb is a no-op');
}
{
  const dropped = record.taxonomy.filter(t => norm(t.href) !== '/voxel/');
  const c = genreCensus(dropped, games);
  check(c.none.length === 1 && c.none[0] === '/voxel/',
    'CONTROL: a game removed from EVERY genre is caught',
    c.none.join(', ') || 'not caught — the zero-genre limb is a no-op');
}
{
  /* Action & Survival holds exactly 2, so removing one puts it under the floor.
     Picking the genre with the least headroom is deliberate: a control that
     removes a game from a genre of ten proves the arithmetic, not the floor. */
  const victimGenre = [...byGenre].sort((a, b) => a[1] - b[1])[0][0];
  const victim = record.taxonomy.find(t => t.genre === victimGenre);
  const reduced = record.taxonomy.filter(t => t !== victim);
  const counts = new Map();
  for (const t of reduced) counts.set(t.genre, (counts.get(t.genre) || 0) + 1);
  const nowThin = [...counts].filter(([, n]) => n < FLOOR);
  check(nowThin.some(([g]) => g === victimGenre),
    `CONTROL: deleting a game from the smallest genre (${victimGenre}, ${byGenre.get(victimGenre)}) drops it under the floor and reds`,
    nowThin.map(([g, n]) => `${g}=${n}`).join(', ') || 'floor did not fire');
}
{
  const renamed = record.genreOrder.map(g => g);
  const withBucket = { genreOrder: [...renamed, 'Other'] };
  check(withBucket.genreOrder.some(g => CATCH_ALL.test(g)),
    'CONTROL: an "Other" bucket would be caught by the catch-all test',
    `${withBucket.genreOrder.filter(g => CATCH_ALL.test(g)).join(', ')} detected, shipped tree has ${bucket.length}`);
}

/* The featured scan must be able to fail. Inject a real read into a copy of
   the page and re-run the identical extraction over it. */
{
  const html = fs.readFileSync(PAGE, 'utf8');
  const needle = 'function takeOf(g){return TAKE[keyOf(g)]||""}';
  const injected = html.replace(needle, needle + '\nvar __c=function(g){return g.featured};');
  const dir = fs.mkdtempSync('/tmp/curation-page-');
  fs.mkdirSync(path.join(dir, 'games'));
  fs.writeFileSync(path.join(dir, 'games', 'index.html'), injected);
  const before = html.length, after = injected.length;
  check(after > before, 'CONTROL: the injection is real, not a no-op replace', `${before} B -> ${after} B`);
  /* Through the SHIPPING scanner, not a re-implementation of it. */
  const probe = featuredReadsIn(path.join(dir, 'games', 'index.html'));
  check(probe.reads === 1, 'CONTROL: with one `g.featured` read injected, the shipping scanner finds exactly 1',
    `${probe.reads} found (shipped tree: ${totalReads})`);
  const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), dir, '--emit'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  check(probe.unparsed.length === 0 && out.length > 0,
    'CONTROL: and the injected copy still parses, so the red is the read and not a syntax error',
    `${probe.blocks} blocks, ${probe.unparsed.length} unparsed, ${out.length} B of record extracted`);
}

/* ---------------- rendered ---------------- */

/* The static limbs above prove the record's keys resolve. They cannot prove
   the RENDERER uses them — a re-keyed record with a title-keyed renderer left
   behind would pass every check above and still paint the old, fragile rail.
   So the rail is read out of a real browser, and the rename that used to
   shrink it 4 -> 3 is replayed there. */

let chromium;
for (const spec of ['playwright', process.env.MBM_PLAYWRIGHT,
  '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
  try {
    const mod = await import(spec);
    chromium = mod.chromium || (mod.default && mod.default.chromium);
    if (chromium) break;
  } catch (e) { /* next */ }
}

if (!chromium) {
  console.log('\n=== RENDERED ===\n');
  console.log('  [INCONCLUSIVE] playwright is not importable, so no rail was painted.');
  fail++;
} else {
  const http = await import('node:http');
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
    '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2' };

  async function railOf(manifestFile) {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/Games/games.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(fs.readFileSync(manifestFile)); return; }
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      try {
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('nf'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
        res.end(fs.readFileSync(f));
      } catch (e) { res.writeHead(500).end(String(e)); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch();
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/games/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => document.querySelectorAll('a.pick').length).catch(() => 0)) break;
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(500);
    const out = await page.evaluate(() => {
      /* PAINTED, never node-counted. A section hidden by [hidden] keeps its
         nodes, so querySelectorAll().length reports cards nobody can see —
         this instrument reported 20 cards for a 12-game filter until it was
         corrected, which is the same class of error as the 300x150 canvas. */
      const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const n = h => String(h || '').replace(/^https?:\/\/[^/]*(?:mattroper1977\.github\.io|madebymatt\.uk)/i, '');
      const all = [...document.querySelectorAll('a.pick,a.gcard')].filter(vis);
      const per = {};
      all.map(e => n(e.getAttribute('href'))).forEach(h => { per[h] = (per[h] || 0) + 1; });
      return {
        picks: [...document.querySelectorAll('a.pick')].filter(vis).map(a => {
          const b = a.getBoundingClientRect();
          return {
            title: (a.querySelector('h3') || {}).textContent || '',
            href: n(a.getAttribute('href')),
            take: ((a.querySelector('.take span') || {}).textContent || '').replace(/[\u201C\u201D"]/g, '').trim(),
            label: (a.querySelector('.tagc') || {}).textContent || '',
            painted: b.width > 0 && b.height > 0
          };
        }),
        cards: all.length,
        distinct: new Set(all.map(e => n(e.getAttribute('href')))).size,
        per,
        genres: [...document.querySelectorAll('#genreSections details.gsec')].map(d => ({
          name: d.querySelector('.gname').textContent,
          label: d.querySelector('.gnum').textContent,
          cards: [...d.querySelectorAll('a.gcard')].filter(vis).length,
          open: d.open
        })),
        badges: [...document.querySelectorAll('#genreSections .gcard .mini')].filter(vis).length,
        shelfSub: (document.getElementById('shelfSub') || {}).textContent || '',
        countline: (document.getElementById('countline') || {}).textContent || '',
        feels: [...document.querySelectorAll('#feels .chip')].map(c => c.textContent.trim())
      };
    });
    await browser.close(); server.close();
    return out;
  }

  console.log('\n=== RENDERED ===\n');
  const wantTop = record.curation.filter(c => c.rail).sort((a, b) => a.rail - b.rail).map(c => c.href);
  const live = await railOf(MANIFEST);
  live.picks.forEach((p, i) => console.log(`  ${i + 1}. ${p.title.padEnd(18)} ${String(p.href).padEnd(36)} take=${p.take ? 'yes' : 'EMPTY'}`));
  console.log();

  check(live.picks.length === wantTop.length, 'the painted rail has one card per rail slot',
    `${live.picks.length} painted, ${wantTop.length} declared`);
  check(JSON.stringify(live.picks.map(p => p.href)) === JSON.stringify(wantTop),
    'and they are the declared hrefs, in the declared order', live.picks.map(p => p.href).join(' · '));
  check(live.picks.every(p => p.painted && p.take), 'every painted card occupies space and carries a take',
    `${live.picks.filter(p => p.painted).length} painted, ${live.picks.filter(p => p.take).length} with takes`);
  check(live.cards === 60 && live.distinct === 52,
    'the hub paints 60 cards for 52 distinct games — down from 82 for 52',
    `${live.cards} cards, ${live.distinct} distinct`);
  const twice = Object.entries(live.per).filter(([, n]) => n > 1);
  check(twice.every(([, n]) => n === 2), 'no game is painted more than twice',
    twice.map(([h, n]) => `${h}x${n}`).join(' ') || 'none twice');
  check(JSON.stringify(twice.map(t => t[0]).sort()) === JSON.stringify(live.picks.map(p => p.href).sort()),
    'and every game painted twice IS in TOP — the one permitted duplication',
    `${twice.length} twice, ${live.picks.length} picks`);
  check(live.distinct === record.taxonomy.length,
    'distinct games painted == distinct games in the record',
    `${live.distinct} painted, ${record.taxonomy.length} in record`);
  check(live.genres.length === record.genreOrder.length && live.genres[0] && live.genres[0].open
        && live.genres.slice(1).every(g => !g.open),
    'nine genre accordions, the first open and the rest shut',
    `${live.genres.length} sections, ${live.genres.filter(g => g.open).length} open`);
  const labelDrift = live.genres.filter(g => {
    const want = record.taxonomy.filter(t => t.genre === g.name).length;
    return g.cards !== want || g.label !== `${want} game${want === 1 ? '' : 's'}`;
  });
  check(labelDrift.length === 0, 'every genre\'s heading count is recomputed from the record, not written down',
    labelDrift.map(g => `${g.name} shows "${g.label}" for ${g.cards}`).join('; ')
      || live.genres.map(g => `${g.name}=${g.cards}`).join(' '));
  check(live.badges === record.curation.length,
    'one MATT\'S PICK badge per curated game in the genre sections',
    `${live.badges} badges, ${record.curation.length} curated entries`);
  check(live.picks.every(p => p.label && record.genreOrder.includes(p.label)),
    'each pick card labels itself with its GENRE, not the manifest tag',
    live.picks.map(p => p.label).join(' · '));

  /* The authored takes, byte-for-byte, read off the PAINTED card.
     A take is Matt's voice. The failure mode is not deletion — it is a
     helpful tidy-up: a full stop added to a line that deliberately has none,
     a straight apostrophe curled, a hyphen promoted to an em dash. Every one
     of those survives a "the take is non-empty" check and every one of them
     is a rewrite. So this compares bytes, with Buffer.byteLength rather than
     string length, because two strings of equal length can differ by an
     encoding and a length check would call that identical. */
  const AUTHORED = [
    ['/emberwild/', 'Madebymatt meets creature collecting - shh, you know the one.'],
    ['/olympics/', "The weather's too hot and you're not a pro - enjoy athletics at home."],
    ['/apexpool/', 'Good at pool - be great with Apex Pool'],
    ['/relicforge/', 'Be a warrior and solve the quest.'],
    ['/auroralinks/', "Can't afford your own clubs - the realism means you don't need any."]
  ];
  const painted = new Map(live.picks.map(p => [p.href, p.take]));
  const drift = AUTHORED.filter(([h, t]) => painted.get(h) !== t);
  check(drift.length === 0, 'each of the five new takes is on the page character-for-character as authored',
    drift.length
      ? drift.map(([h, t]) => `${h}: authored ${Buffer.byteLength(t)}B "${t}" vs painted ${Buffer.byteLength(painted.get(h) || '')}B "${painted.get(h)}"`).join(' | ')
      : AUTHORED.map(([h, t]) => `${h}=${Buffer.byteLength(t)}B`).join(' '));

  /* …and that comparison must be able to fail, or it is a no-op that says
     yes to anything. The mutation is the smallest real one: a single full
     stop appended to the take that deliberately ends without one. */
  {
    const [h, t] = AUTHORED.find(([k]) => k === '/apexpool/');
    const tidied = t + '.';
    check(Buffer.byteLength(tidied) === Buffer.byteLength(t) + 1 && tidied !== t,
      'CONTROL: the mutation is real — one full stop added to the take that has none',
      `${Buffer.byteLength(t)}B -> ${Buffer.byteLength(tidied)}B`);
    check(painted.get(h) !== tidied,
      'CONTROL: and the comparison rejects it, so a helpful tidy-up cannot pass',
      `painted "${painted.get(h)}" !== tidied "${tidied}"`);
  }

  /* Rename a game that is ON the rail — renaming one that has left it would
     prove nothing about the rail, and this control first failed for exactly
     that reason when Trail Runner moved off in favour of the intended eight. */
  const RENAME_HREF = '/apexkick/';
  /* Feel filters. The rule they exist to keep: a filter may change WHICH cards
     show, and may never give any single game a second card. The old page broke
     exactly this — four rails each drew their own copy — and the first version
     of this build broke it again in a subtler way, by leaving the Top Picks
     rail up while filtering, so a game in TOP that matched painted twice. */
  const feelProbe = async () => {
    const server = http.createServer((req, res) => {
      let pth = decodeURIComponent(req.url.split('?')[0]);
      if (pth === '/Games/games.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(fs.readFileSync(MANIFEST)); return; }
      if (pth.endsWith('/')) pth += 'index.html';
      const f = path.join(ROOT, pth);
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('nf'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const browser = await chromium.launch();
    const pg = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await pg.goto(`http://127.0.0.1:${server.address().port}/games/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    for (let i = 0; i < 60; i++) { if (await pg.evaluate(() => document.querySelectorAll('a.gcard').length).catch(() => 0)) break; await pg.waitForTimeout(250); }
    await pg.waitForTimeout(400);
    const READ = `(()=>{const vis=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
      const n=h=>String(h||'').replace(/^https?:\\/\\/[^/]*(?:mattroper1977\\.github\\.io|madebymatt\\.uk)/i,'');
      const a=[...document.querySelectorAll('a.pick,a.gcard')].filter(vis);const per={};
      a.map(e=>n(e.getAttribute('href'))).forEach(h=>{per[h]=(per[h]||0)+1});
      return {cards:a.length,distinct:new Set(a.map(e=>n(e.getAttribute('href')))).size,max:Math.max(0,...Object.values(per))};})()`;
    const out = [];
    for (const [key] of record.feelOrder.map(f => [f])) {
      await pg.evaluate(k => {
        const b = [...document.querySelectorAll('#feels .chip')].find(c => c.getAttribute('aria-label').toLowerCase().startsWith(k.replace('-', ' ')));
        if (b) b.click();
      }, key);
      await pg.waitForTimeout(200);
      const m = await pg.evaluate(READ);
      out.push({ key, ...m, want: record.taxonomy.filter(t => (t.feels || []).includes(key)).length });
      await pg.evaluate(k => {
        const b = [...document.querySelectorAll('#feels .chip')].find(c => c.getAttribute('aria-pressed') === 'true');
        if (b) b.click();
      }, key);
      await pg.waitForTimeout(150);
    }
    /* Tap targets with every accordion opened, so nothing hides behind a shut
       section. WCAG 2.5.8 exempts a target inside a sentence, whose size is
       constrained by the line-height of the prose around it; those are listed
       separately rather than silently dropped. */
    await pg.evaluate(() => document.querySelectorAll('details.gsec').forEach(d => { d.open = true; }));
    await pg.waitForTimeout(250);
    const targets = await pg.evaluate(() => {
      /* WCAG 2.5.8's inline exception, tested by structure rather than by tag
         name: a target is 'in a sentence' when its parent carries text of its
         own around it, so its height is set by the prose line-height. A
         closest('p') test missed the footer email, which sits in a div. */
      const inSentence = e => {
        const par = e.parentElement; if (!par) return false;
        const around = (par.textContent || '').replace(e.textContent || '', '').trim();
        return around.length > 0;
      };
      return [...document.querySelectorAll('a,button,summary,select,input')]
        .map(e => ({ e, r: e.getBoundingClientRect() }))
        .filter(o => o.r.width > 0 && o.r.height > 0 && (o.r.height < 44 || o.r.width < 44))
        .map(o => ({ tag: o.e.tagName, inline: inSentence(o.e), w: Math.round(o.r.width), h: Math.round(o.r.height),
                     text: (o.e.textContent || '').trim().slice(0, 30) }));
    });
    await browser.close(); server.close();
    return { out, targets };
  };
  const probe = await feelProbe();
  console.log();
  probe.out.forEach(f => console.log(`  feel ${f.key.padEnd(10)} cards ${String(f.cards).padStart(3)}  distinct ${String(f.distinct).padStart(3)}  max/game ${f.max}  record says ${f.want}`));
  check(probe.out.every(f => f.max <= 1), 'no feel filter gives any single game more than one card',
    probe.out.map(f => `${f.key}=${f.max}`).join(' '));
  check(probe.out.every(f => f.cards === f.want && f.distinct === f.want),
    'each feel paints exactly as many cards as the record says carry it',
    probe.out.map(f => `${f.key} ${f.cards}/${f.want}`).join('  '));
  const distinctCounts = new Set(probe.out.map(f => f.cards));
  check(distinctCounts.size > 1, 'CONTROL: the filters are not all showing the same set — they really filter',
    `${distinctCounts.size} distinct result sizes across ${probe.out.length} feels: ${[...distinctCounts].sort((a, b) => a - b).join(', ')}`);
  const blocking = probe.targets.filter(t => !t.inline);
  check(blocking.length === 0, 'every non-inline target is at least 44px at 390px',
    blocking.map(t => `${t.tag} ${t.w}x${t.h} "${t.text}"`).join('; ')
      || `0 under 44px; ${probe.targets.length} inline-in-sentence link(s) exempt under WCAG 2.5.8: ${probe.targets.map(t => `"${t.text}"`).join(', ')}`);

  const renamed = scratchManifest(gs => { gs.find(g => g.href === RENAME_HREF).title = 'Apex Kick RENAMED'; });
  const after = await railOf(renamed);
  check(after.picks.length === live.picks.length,
    'CONTROL (browser): a rename of a railed game leaves the rail its full length',
    `${live.picks.length} -> ${after.picks.length} cards (title-keying took it 4 -> 3)`);
  const slot = after.picks.find(p => p.href === RENAME_HREF);
  const before = painted.get(RENAME_HREF);
  check(!!slot && slot.title === 'Apex Kick RENAMED' && slot.take === before,
    'CONTROL (browser): the renamed game keeps its slot AND its take, byte-identical — the take followed the href, not the title',
    slot ? `"${slot.title}" · take ${Buffer.byteLength(slot.take)}B, was ${Buffer.byteLength(before || '')}B` : 'slot vanished');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
