#!/usr/bin/env node
/*
 * verify_accent_parity.mjs — a game's declared accent equals its shelf card hue.
 *
 * WHY. The shelf card colour lives in the canonical games.json; the in-game
 * accent lived as scattered hex literals inside each game. Nothing connected
 * them, so when the card hue was corrected the two silently diverged and the
 * only reason anyone noticed was a human reading a PR body.
 *
 * Each game now declares its accent ONCE (`const ACCENT='#...'`, plus a CSS
 * `--accent` token where the UI uses one) and this gate asserts that value
 * against the manifest. Nothing is pinned here: the expectation is READ from
 * data/source-manifests/games.json, which has its own gate asserting it is
 * byte-identical to the canonical shelf.
 *
 * THE SPLIT. Apex Velodrome's accent deliberately does NOT reach its rider
 * jerseys. Measured against that game's own rider palette the card hue lands
 * ΔE00 12.1 from #ba8cff and 16.0 from #f48fb1 — two rivals the player has to
 * tell themselves apart from — and no accent-grade hue clears ΔE00 25 against
 * both the nine-member Sports rail and that seven-colour rider set. So the
 * accent takes the centripetal/overlay role and the riders keep their
 * categorical palette. That split is asserted here too, so it stays deliberate
 * rather than becoming drift somebody later "fixes".
 *
 *   node tools/verify_accent_parity.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = [];
const check = (ok, name, detail = '') => {
  rows.push(ok);
  console.log(`  [${ok ? ' ok ' : 'FAIL'}] ${name}${detail ? '  — ' + detail : ''}`);
};

const games = JSON.parse(readFileSync(join(ROOT, 'data/source-manifests/games.json'), 'utf8')).games;

/* Games that declare an accent token. A game is listed here because it HAS one,
   and the first assertion below is that the token is actually there — a route
   that quietly stopped declaring it must go red, not drop out of the loop. */
const DECLARING = [
  { route: '/apexcurl/', file: 'apexcurl/index.html', css: true, split: null },
  {
    route: '/apexvelodrome/', file: 'apexvelodrome/index.html', css: false,
    /* the rider palette this accent must NOT be given to */
    split: { keeps: '#5fb6ff', role: 'rider jerseys' },
  },
];

console.log('\n=== EACH GAME\'S DECLARED ACCENT IS ITS SHELF CARD HUE ===\n');

check(games.length > 0, 'the manifest carries games to check against', `${games.length} entries`);
check(DECLARING.length > 0, 'there are declaring games to check', `${DECLARING.length}`);

for (const g of DECLARING) {
  const html = readFileSync(join(ROOT, g.file), 'utf8');
  const entry = games.find(x => x.href === g.route);
  check(!!entry, `${g.route}: has a manifest entry to be measured against`, entry ? entry.hue : 'MISSING');
  if (!entry) continue;

  const js = html.match(/const ACCENT\s*=\s*'(#[0-9a-fA-F]{6})'/);
  check(!!js, `${g.route}: declares its accent exactly once in script`, js ? js[1] : 'no `const ACCENT` found');
  if (js) {
    const all = [...html.matchAll(/const ACCENT\s*=/g)];
    check(all.length === 1, `${g.route}: and only once`, `${all.length} declaration(s)`);
    check(js[1].toLowerCase() === entry.hue.toLowerCase(),
      `${g.route}: script accent equals the shelf card hue`, `${js[1]} vs manifest ${entry.hue}`);
  }

  if (g.css) {
    const css = html.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
    check(!!css, `${g.route}: declares a --accent CSS token`, css ? css[1] : 'not found');
    if (css) check(css[1].toLowerCase() === entry.hue.toLowerCase(),
      `${g.route}: CSS accent token equals the shelf card hue`, `${css[1]} vs manifest ${entry.hue}`);
  }

  if (g.split) {
    /* The deliberate part. If someone "tidies" the riders onto the accent this
       goes red, and the comment in the game says why it must not happen. */
    /* Count the QUOTED literal only. The first version of this limb matched the
       bare hex anywhere in the file, which included the comment above explaining
       the split — so it counted 11 where there are 9 real sites and could never
       reach zero. A guard that matches its own explanation cannot go red. */
    const keeps = new RegExp("'" + g.split.keeps + "'", 'ig');
    const n = (html.match(keeps) || []).length;
    check(n > 0, `${g.route}: the declared split survives — ${g.split.role} keep ${g.split.keeps}`, `${n} code site(s)`);
    check(html.includes('SPLIT, and deliberately so'),
      `${g.route}: and the reason for it is recorded beside the token`);
  }
}

const pass = rows.filter(Boolean).length;
console.log(`\naccent parity: ${pass}/${rows.length} passed`);
if (pass !== rows.length) { console.error(`${rows.length - pass} FAILED`); process.exit(1); }
