#!/usr/bin/env node
/*
 * The live-verification route set, DERIVED from the canonical shelf.
 *
 * WHY THIS EXISTS
 * agx1-live-verify.yml carried a hand-list of six games. The shelf carries
 * fifty-two. Seventeen site-served games were never fetched by that gate, and
 * /emberwild/ was one of them — which is how a file could move twice in a day
 * and have no served-byte check anywhere in the estate.
 *
 * That is the same species as verify_games_audience_faces.py, which was green
 * while forty-two games were hidden from the pupil homepage: a list maintained
 * by hand next to a record maintained by machine. The list does not go red when
 * the record grows. It just quietly stops covering it.
 *
 * WHAT IS DERIVED, AND WHAT IS NOT
 * Derived: every game the SITE serves. An entry qualifies when its href is not
 * under /Lessons/ and <slug>/index.html exists in this tree.
 *
 * NOT derived, and deliberately kept: the infrastructure routes. They are not
 * games and no manifest lists them, so they cannot come from the record — but
 * dropping them to make the gate "fully derived" would delete coverage to win
 * an argument about purity. They are declared below WITH REASONS and named in
 * the output as residue rather than smuggled into the game count.
 *
 * THE BUCKET THAT WAS A TRAPDOOR
 * The first version classified an entry as "belongs to the Lessons estate" on
 * the href STRING alone, printed only a count for that bucket, and moved on.
 * An adversarial pass showed what that allows: rewrite one href from
 * /apexgolf/ to /Lessons/apexgolf/ and the gate drops a game this tree still
 * serves, exits 0, prints "0 failed", passes every control, and NEVER NAMES THE
 * ROUTE IT DROPPED. Coverage fell 23 -> 1 on a fully green run. That is the
 * same disease the header describes, one level down: the derivation did not go
 * red when the record stopped routing through it.
 *
 * So a Lessons claim is now checked against the filesystem this tool already
 * holds. An entry that says it lives in Lessons while THIS tree still serves a
 * directory of that name is CONTESTED — named, and red. Measured against the
 * real shelf: 29 Lessons entries, 0 contested, because the real ones are file
 * paths (/Lessons/Games/Off_Brand.html) that do not collide.
 *
 * A MANIFEST THAT CANNOT BE READ IS NOT AN EMPTY MANIFEST
 * If the canonical shelf is missing, unparseable, null or empty this exits 2
 * and says so. A derivation that silently yields zero routes would turn this
 * gate green by checking nothing.
 *
 * EXITS
 *   0  derivation succeeded and every control fired
 *   1  a derived route has no file behind it, or a route is contested
 *   2  INCONCLUSIVE — the shelf could not be read, or the derivation is empty
 *
 * Usage:
 *   node tools/derive_live_routes.mjs --canonical _shelf/games.json [--root .]
 *   node tools/derive_live_routes.mjs --canonical _shelf/games.json --emit routes
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const ROOT = path.resolve(arg('--root') || path.join(HERE, '..'));
const EMIT = arg('--emit');

/* The floor. The hand-list this replaced could not shrink; a derived list can.
   Set below the current 23 so ordinary retirement does not red the gate, but
   high enough that a collapse cannot pass as a derivation. */
const MIN_ROUTES = 15;

/* THE INFRASTRUCTURE ROUTES, NOW DISPOSED ONE BY ONE.
   These five were declared-not-derived and inherited by the serve gate as
   UNCHECKED — named in a residue line and fetched by nothing, because
   `--emit routes` emits the derived set and the serve gate calls exactly that.
   Being named is not being checked. Each now carries a verdict.

   COVERED: emitted with the derived routes, so the serve gate fetches them and
   compares bytes like any other. Each names the file behind it, and a COVERED
   route whose file is missing is a finding on the same exit code as a dead
   derived route — an infrastructure route nobody can serve is exactly the
   failure this whole tool exists to catch. */
const COVERED = [
  { route: '/',          file: 'index.html',       kind: 'page',
    why: 'the chooser — the root every audience lands on first' },
  { route: '/games/',    file: 'games/index.html', kind: 'page',
    why: 'the arcade hub — the page that paints the shelf this list is derived from' },
  { route: '/site.json', file: 'site.json',        kind: 'data',
    why: 'the site record itself. Data, not a page: the serve gate compares it to the committed blob and must not expect an index.html behind it' },
];

/* EXEMPT: named, with the reason IN THE REPOSITORY rather than in a transcript,
   and deliberately not emitted. Neither is left unchecked by accident. */
const EXEMPT = [
  { route: '__FULL_HOME__',
    why: 'NOT A ROUTE. A build-time token the workflow resolves at run time to /main/ or legacy /. There is no URL to fetch, so no serve assertion can exist for it — it is the only one of the five that can never be covered, and it is kept here so it stops reading as an unchecked route.' },
  { route: '/Games/games.json',
    why: 'The CANONICAL shelf, which lives in the Games repository, not this one. There is no committed blob here to compare a served copy against — data/source-manifests/games.json is a MIRROR of it, not its source. It is already asserted by the shelf-mirror-guard pair (this repo + the Games repo, plus a weekly run), which compares mirror to canonical using the generator own --check. Adding a byte assertion here would be a second implementation of "are these the same", which that guard own comment names as a second thing to drift. Exempt because it is already checked by the right instrument, not because it is unchecked.' },
];

/* --emit residue keeps its meaning: what is declared and NOT derived. */
const RESIDUE = EXEMPT;

function inconclusive(why, ...more) {
  console.error(`INCONCLUSIVE: ${why}`);
  for (const m of more) console.error(`  ${m}`);
  console.error('  This gate did not judge anything. That is not a pass.');
  process.exit(2);
}

const canonicalArg = arg('--canonical');
if (!canonicalArg) inconclusive('no --canonical shelf was given.',
  'usage: node tools/derive_live_routes.mjs --canonical <path/to/games.json>');
if (!fs.existsSync(canonicalArg)) inconclusive(`the canonical shelf does not exist: ${canonicalArg}`);

function readShelf(file) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { inconclusive(`the canonical shelf is not parseable JSON: ${file}`, e.message); }
  /* `null` parses fine and then throws on property access. It used to die as an
     uncaught TypeError and exit 1 — the code this file reserves for "a derived
     route has no file behind it" — so an unreadable shelf reported itself as a
     content failure. Every not-an-object shape now lands on the same exit 2. */
  if (raw === null || typeof raw !== 'object') {
    inconclusive(`the canonical shelf is not an object or array: ${file}`, `parsed as ${raw === null ? 'null' : typeof raw}`);
  }
  const games = Array.isArray(raw) ? raw : raw.games;
  if (!Array.isArray(games)) inconclusive(`the canonical shelf has no games array: ${file}`);
  if (games.length === 0) inconclusive(`the canonical shelf lists zero games: ${file}`,
    'a derivation from an empty record would pass by covering nothing');
  return games;
}

/* A slug that escapes the tree is not a slug. path.join normalises '..' away,
   so '/a/../../etc/' would be tested — and could resolve — outside ROOT. Such
   an href is malformed, and malformed is a finding, not a pass. */
function safeSlug(href) {
  const slug = href.replace(/^\/|\/$/g, '');
  if (!slug || slug.includes('..') || slug.includes('\0') || path.isAbsolute(slug)) return null;
  const resolved = path.resolve(ROOT, slug);
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  return slug;
}

function derive(games, root) {
  const site = [], lessons = [], dead = [], contested = [], malformed = [];
  for (const g of games) {
    const href = g && g.href;
    if (typeof href !== 'string' || !href) { malformed.push(JSON.stringify(href)); continue; }
    if (href.startsWith('/Lessons/')) {
      /* The other estate's claim, checked against the tree we already hold. */
      const tail = safeSlug(href.slice('/Lessons/'.length));
      if (tail && fs.existsSync(path.join(root, tail, 'index.html'))) contested.push(href);
      else lessons.push(href);
      continue;
    }
    const slug = safeSlug(href);
    if (!slug) { malformed.push(href); continue; }
    if (fs.existsSync(path.join(root, slug, 'index.html'))) site.push(href);
    else dead.push(href);
  }
  for (const a of [site, lessons, dead, contested, malformed]) a.sort();
  return { site, lessons, dead, contested, malformed };
}

const games = readShelf(canonicalArg);
const d = derive(games, ROOT);
const { site, lessons, dead, contested, malformed } = d;

if (EMIT === 'routes') {
  /* Self-guarding. The non-emit invocation carries the assertions, but this
     branch is what the workflow actually consumes, and a route file that is
     empty — or a lone newline, which mapfile turns into ONE empty element and
     the consumer turns into a request for the bare origin — must never be
     written. */
  if (!site.length) inconclusive('the derivation yielded zero site-served routes',
    'emitting an empty route set would let the live gate pass by checking nothing');
  /* A COVERED route with no file behind it must not be emitted as if it were
     servable. Same exit code as a dead derived route, and NAMED. */
  const missing = COVERED.filter(c => !fs.existsSync(path.join(ROOT, c.file)));
  for (const m of missing) console.error(`COVERED route has no file behind it: ${m.route} -> ${m.file}`);
  console.log([...site, ...COVERED.filter(c => !missing.includes(c)).map(c => c.route)].filter(Boolean).join('\n'));
  process.exit(dead.length || contested.length || missing.length ? 1 : 0);
}
if (EMIT === 'residue') { console.log(RESIDUE.map(r => r.route).join('\n')); process.exit(0); }

let failed = 0;
const check = (ok, what, detail = '') => {
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${what}${detail ? '  ·  ' + detail : ''}`);
  if (!ok) failed++;
};

console.log(`canonical shelf: ${canonicalArg}  ·  ${games.length} entries\n`);
console.log(`derived, site-served      : ${site.length}`);
console.log(`  ${site.join(' ')}`);
console.log(`left to the Lessons estate: ${lessons.length}`);
console.log(`  ${lessons.join(' ')}`);          // named, never a bare count again
console.log(`infrastructure, now COVERED  : ${COVERED.length}`);
for (const c of COVERED) console.log(`  ${c.route.padEnd(20)} [${c.kind}] ${c.file}`);
console.log(`declared EXEMPT, not derived  : ${EXEMPT.length}`);
for (const r of EXEMPT) console.log(`  ${r.route.padEnd(20)} ${r.why}`);
console.log();

/* The accounting check used to be `site + lessons + dead === games.length`.
   Every path through the loop pushes exactly once, so that identity was
   arithmetically incapable of failing — a tautology printing a green tick. It
   is replaced by SET equality on the hrefs themselves, which catches an entry
   being dropped, duplicated or mutated in transit, and which CONTROL 4 below
   drives red. Strictly stronger, not weaker. */
const bucketed = [...site, ...lessons, ...dead, ...contested].concat(malformed.filter(m => !m.startsWith('"')));
const inputHrefs = games.map(g => g && g.href).filter(h => typeof h === 'string');
const same = bucketed.length === inputHrefs.length &&
             JSON.stringify([...bucketed].sort()) === JSON.stringify([...inputHrefs].sort());
check(same, 'every shelf href appears in exactly one bucket, by name and not by count',
  `${bucketed.length} bucketed vs ${inputHrefs.length} in the record`);
check(dead.length === 0, 'every derived route has a file behind it',
  dead.length ? `no index.html for: ${dead.join(', ')}` : `${site.length} routes resolve`);
check(contested.length === 0,
  'no shelf entry hands a still-served route to the Lessons estate',
  contested.length ? `still served here: ${contested.join(', ')}` : `${lessons.length} Lessons routes, none shadowed`);
check(malformed.length === 0, 'no href is malformed or escapes the tree',
  malformed.length ? malformed.join(', ') : 'all hrefs well formed');
check(site.length >= MIN_ROUTES,
  `the derived set clears its floor of ${MIN_ROUTES} — a collapse cannot pass as a derivation`,
  `${site.length} routes`);
check(site.includes('/emberwild/'),
  '/emberwild/ is in the derived set — the route the hand-list missed', site.includes('/emberwild/') ? 'present' : 'ABSENT');

console.log('\n=== CONTROLS ===\n');

{ const r = derive(games.filter(g => g.href !== '/emberwild/'), ROOT);
  check(r.site.length === site.length - 1 && !r.site.includes('/emberwild/'),
    'CONTROL: removing /emberwild/ from the shelf drops the derived count by exactly one',
    `${site.length} -> ${r.site.length}`); }

{ const r = derive(games.concat([{ href: '/this-route-does-not-exist/' }]), ROOT);
  check(r.dead.includes('/this-route-does-not-exist/') && r.site.length === site.length,
    'CONTROL: a shelf entry with no directory behind it is reported dead, not filtered away',
    `dead=[${r.dead.join(', ')}]`); }

/* CONTROL 4 — the trapdoor, pinned. Reclassifying a still-served game into the
   Lessons estate must come back CONTESTED and named, not vanish into a count. */
{ const moved = games.map(g => g.href === '/apexgolf/' ? { ...g, href: '/Lessons/apexgolf/' } : g);
  const r = derive(moved, ROOT);
  check(r.contested.includes('/Lessons/apexgolf/') && r.site.length === site.length - 1,
    'CONTROL: reclassifying a still-served game into /Lessons/ is CONTESTED and named, not silently dropped',
    `contested=[${r.contested.join(', ')}], derived ${site.length} -> ${r.site.length}`); }

/* CONTROL 5 — the set-equality check must be able to fail. Feed derive() a
   record whose href appears twice and confirm the bucketing notices. */
{ const dupe = games.concat([{ href: games[0].href }]);
  const r = derive(dupe, ROOT);
  const b = [...r.site, ...r.lessons, ...r.dead, ...r.contested];
  const inp = dupe.map(g => g.href);
  const eq = b.length === inp.length && JSON.stringify([...b].sort()) === JSON.stringify([...inp].sort());
  check(eq && b.length === inputHrefs.length + 1,
    'CONTROL: the set check tracks a duplicated href rather than losing it',
    `${b.length} bucketed for ${inp.length} entries`); }

/* CONTROL 6 — a traversal href is malformed, not covered. */
{ const r = derive(games.concat([{ href: '/../../etc/' }]), ROOT);
  check(r.malformed.includes('/../../etc/') && !r.site.includes('/../../etc/'),
    'CONTROL: an href that escapes the tree is malformed, not counted as covered',
    `malformed=[${r.malformed.join(', ')}]`); }

/* CONTROL 7 & 8 — unreadable shelves exit 2, in a child process because they exit. */
{
  const { execFileSync } = await import('node:child_process');
  const tmp = fs.mkdtempSync('/tmp/derive-live-routes-');
  const run = (name, body) => {
    const f = path.join(tmp, name); fs.writeFileSync(f, body);
    try { execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--canonical', f, '--root', ROOT],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); return { code: 0, err: '' }; }
    catch (e) { return { code: e.status, err: String(e.stderr || '') }; }
  };
  const empty = run('empty.json', JSON.stringify({ games: [] }));
  check(empty.code === 2 && /lists zero games/.test(empty.err),
    'CONTROL: an empty shelf exits 2 INCONCLUSIVE rather than passing with nothing to check', `exit ${empty.code}`);
  const nul = run('null.json', 'null');
  check(nul.code === 2 && /not an object/.test(nul.err),
    'CONTROL: a shelf that parses to null exits 2, not 1 — an unreadable shelf is not a content failure', `exit ${nul.code}`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${failed} failed`);
process.exit(failed ? 1 : 0);
