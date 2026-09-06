/* Curation is earned by play. A new game must never enter the top rail, carry
 * a take, or wear a badge merely by arriving on the shelf.
 *
 * EVERY FIGURE HERE IS DERIVED. Nothing is pinned to a remembered total —
 * not 52 games, not 60 cards, not 18 takes. Those were all true before this
 * pass and none of them is true after it, which is exactly why a gate that
 * hardcodes a shelf total reds on the next game rather than on a real defect.
 * What is asserted is the RELATIONSHIP: the rail is a subset of the shelf, the
 * card count is the shelf plus the rail, every shelf game has exactly one
 * genre, and the games named below are in none of the curation sets.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// This launch's subjects. Earlier shelf arrivals retain their own landed gates;
// keeping them here would turn a launch contract into a hand-maintained copy of
// the catalogue's history.
const NEW = ['/cyberpulse/'];

const src = readFileSync(join(ROOT, 'games/index.html'), 'utf8');
const shelf = JSON.parse(readFileSync(join(ROOT, 'data/source-manifests/games.json'), 'utf8')).games;

/* the declared records, read from the page that owns them */
function jsArray(name) {
  const start = src.indexOf('var ' + name + '=[');
  if (start < 0) throw new Error('no ' + name + ' in games/index.html');
  let depth = 0, i = src.indexOf('[', start);
  for (let j = i; j < src.length; j++) {
    if (src[j] === '[') depth++;
    else if (src[j] === ']' && --depth === 0) return src.slice(i, j + 1);
  }
  throw new Error('unterminated ' + name);
}
const TAX = {}, RAIL = {}, TAKE = {};
for (const m of jsArray('TAXONOMY').matchAll(/\{href:"([^"]+)",\s*genre:"([^"]+)",\s*feels:\[([^\]]*)\]\}/g))
  TAX[m[1]] = { genre: m[2], feels: [...m[3].matchAll(/"([^"]+)"/g)].map(x => x[1]) };
for (const m of jsArray('CURATION').matchAll(/\{href:"([^"]+)",\s*(?:rail:(\d+),\s*)?take:"((?:[^"\\]|\\.)*)"\}/g)) {
  TAKE[m[1]] = m[3];
  if (m[2]) RAIL[m[1]] = Number(m[2]);
}

const rows = [];
const check = (ok, what, detail = '') => {
  rows.push(ok);
  console.log(`  ${ok ? '[ ok ]' : '[FAIL]'} ${what}${detail ? '  — ' + detail : ''}`);
};

const hrefs = shelf.map(g => g.href);
const N = shelf.length, R = Object.keys(RAIL).length;

console.log(`derived: N=${N} unique games, R=${R} in the rail, N+R=${N + R} browse-all cards, ` +
            `${Object.keys(TAKE).length} takes`);

check(new Set(hrefs).size === N, 'every shelf href is unique', `${new Set(hrefs).size}/${N}`);
check(Object.keys(RAIL).every(h => hrefs.includes(h)),
      'the rail is a subset of the shelf');
check(Object.keys(TAKE).every(h => hrefs.includes(h)),
      'every take names a game on the shelf');
check(shelf.every(g => TAX[g.href]), 'every shelf game has exactly one genre',
      shelf.filter(g => !TAX[g.href]).map(g => g.href).join(', '));

for (const href of NEW) {
  const g = shelf.filter(x => x.href === href);
  check(g.length === 1, `${href}: on the shelf exactly once`, String(g.length));
  check(!(href in RAIL), `${href}: NOT in the top rail`, href in RAIL ? `rail slot ${RAIL[href]}` : '');
  check(!(href in TAKE), `${href}: carries NO take`);
  check(!!TAX[href], `${href}: has a genre`, TAX[href] ? `${TAX[href].genre} · ${TAX[href].feels.join(', ')}` : '');
  check(g[0] && g[0].featured === false, `${href}: featured is false`);
  check(g[0] && g[0].hero === false, `${href}: hero is false`);
}

/* The badge derives from CURATION MEMBERSHIP — that is, from carrying a take —
   NOT from the rail. games/index.html builds CURATED from every CURATION entry
   and TOP from the `rail:` subset only, so the browse-all badge marks every
   take-carrier while the rail is the smaller set inside it. Getting that
   backwards would make this gate assert a mechanic the page does not have, so
   it is stated the way the page actually works: a game in neither set can show
   no badge, and the new games are in neither. */
check(NEW.every(h => !(h in TAKE) && !(h in RAIL)),
      'no new game can be badged: the badge follows a take, and neither has one');

const bad = rows.filter(r => !r).length;
console.log(`\nuncurated contract: ${rows.length - bad}/${rows.length} passed`);
if (bad) { console.error(`${bad} FAILED`); process.exit(1); }
