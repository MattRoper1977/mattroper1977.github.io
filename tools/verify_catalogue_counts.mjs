/* No served surface may state a catalogue count that its own source disagrees
 * with — and by preference, may not state one at all.
 *
 * THE SPECIES. This estate's register already holds two forms of the
 * second-literal trap: a gate holding its own copy of a value the source owns,
 * and a control retyping a token. This is the third: a CATALOGUE COUNT COPIED
 * INTO PROSE. /for/schools-semh/ served "Search all 511 canonical internal
 * destinations" while the index held 715 — a number typed once, true once, and
 * drifting silently ever since. No subset of the category counts summed to 511
 * either; the only other 511 in the tree is a comment recording an old entry
 * count, so the copy had simply never been re-derived.
 *
 * WHY THE RULE IS DELETE, NOT UPDATE. Retyping 715 buys accuracy until the
 * 716th entry lands, and then it is the same defect with a fresher number. A
 * sentence with no numeral in it cannot go stale. So the assertion here is
 * primarily an ABSENCE check over the copy this repository owns, and a
 * correctness check for the one place a figure is genuinely rendered.
 *
 * DERIVED IS FINE, AND IS THE POINT. /education-hub/ says "40 curated external
 * resources" and is correct BY CONSTRUCTION — render_discovery_hubs.py computes
 * len(education["resources"]) into {external_count}. The pupil page's "54 games"
 * and its per-genre counts are computed the same way. Neither is a violation and
 * neither is asserted against a literal here; what is asserted is that the
 * rendered figure equals the source, so the derivation cannot rot either.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = [];
const check = (ok, what, detail = '') => {
  rows.push(ok);
  console.log(`  ${ok ? '[ ok ]' : '[FAIL]'} ${what}${detail ? '  — ' + detail : ''}`);
};

const audience = JSON.parse(readFileSync(join(ROOT, 'data/audience-homepages.json'), 'utf8'));
const index = JSON.parse(readFileSync(join(ROOT, 'data/mbm-search-index.json'), 'utf8'));
const education = JSON.parse(readFileSync(join(ROOT, 'data/education-hub.json'), 'utf8'));
const shelf = JSON.parse(readFileSync(join(ROOT, 'data/source-manifests/games.json'), 'utf8')).games;

/* ---- 1. the copy this repository owns states no bare catalogue count ------ */
const NOUNS = /(games?|lessons?|resources?|destinations?|entries|entry|pathways?|tools?|apps?|routes?)/i;
const offenders = [];
const noteKey = k => k.startsWith('_');
const walk = (node, path) => {
  /* Underscore-prefixed keys are this record's convention for note fields —
     architecture prose that documents the page, never rendered into it. They
     legitimately contain historical figures ("the other 42 were hidden"), so
     they are skipped. The exclusion is CLOSED below by asserting they really
     are unserved: an exclusion nobody checks is how a loophole starts. */
  if (path.split('.').some(noteKey)) return;
  if (typeof node === 'string') {
    /* Ordinals like "01" that number a card, and years, are not counts. */
    const m = node.match(/\b(\d{2,6})\b/g);
    if (m && NOUNS.test(node)) {
      for (const n of m) {
        if (/^(19|20)\d\d$/.test(n)) continue;          // a year
        if (/^0\d$/.test(n)) continue;                   // a card ordinal
        offenders.push({ path, value: n, text: node.slice(0, 110) });
      }
    }
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) walk(node[k], path ? `${path}.${k}` : k);
  }
};
walk(audience.audiences, 'audiences');
check(offenders.length === 0,
  'no audience-homepage copy states a hardcoded catalogue count',
  offenders.map(o => `${o.path} = ${o.value} :: "${o.text}"`).join(' | '));

/* ---- 1b. and the exclusion above is not a hiding place -------------------- */
const servedHtml = ['index.html', 'main/index.html',
  ...Object.values(audience.audiences).map(a => a.route.replace(/^\//, '') + 'index.html')]
  .map(f => { try { return readFileSync(join(ROOT, f), 'utf8'); } catch (e) { return ''; } }).join('\n');
const leaked = [];
const findNotes = (node, path) => {
  if (typeof node === 'string') {
    if (path.split('.').some(noteKey) && node.length > 40 && servedHtml.includes(node.slice(0, 60)))
      leaked.push(path);
  } else if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) findNotes(node[k], path ? `${path}.${k}` : k);
  }
};
findNotes(audience.audiences, 'audiences');
check(leaked.length === 0,
  'no underscore-prefixed note field is rendered into a served page',
  leaked.join(', '));

/* ---- 2. where a figure IS rendered, it equals its source ------------------ */
const hub = readFileSync(join(ROOT, 'education-hub/index.html'), 'utf8');
const externalCount = education.resources.length;
check(hub.includes(`${externalCount} curated external resources`),
  `/education-hub/ states the derived external count (${externalCount})`,
  (hub.match(/(\d+) curated external resources/) || [])[0] || 'not found');

const pupil = readFileSync(join(ROOT, 'for/pupils/index.html'), 'utf8');
check(pupil.includes(`All ${shelf.length} games`),
  `/for/pupils/ states the derived shelf total (${shelf.length})`,
  (pupil.match(/All (\d+) games/) || [])[0] || 'not found');

/* Per-genre labels: each must equal the cards actually painted under it. This
   is the assertion that would catch a genre count going stale independently. */
const genreLabels = [...pupil.matchAll(
  /<span class="mf-pupil-gname">([^<]+)<\/span><span class="mf-pupil-gnum">(\d+) games?<\/span>/g)];
const genreDrift = genreLabels.filter(([whole, name, n]) => {
  const after = pupil.slice(pupil.indexOf(whole));
  const block = after.slice(0, after.indexOf('</details>'));
  return (block.match(/class="mf-pupil-game"/g) || []).length !== Number(n);
});
check(genreLabels.length > 0 && genreDrift.length === 0,
  `every pupil genre label equals the cards beneath it (${genreLabels.length} genres)`,
  genreDrift.map(g => `${g[1]} says ${g[2]}`).join(', '));

/* ---- 3. the index is not described by a figure anywhere in owned copy ----- */
const total = index.counts.total;
const idxClaims = JSON.stringify(audience.audiences).match(new RegExp(`\\b${total}\\b`, 'g')) || [];
check(idxClaims.length === 0,
  `no page hardcodes the index total (${total}) — deleting beats updating`,
  `${idxClaims.length} occurrence(s)`);

const bad = rows.filter(r => !r).length;
console.log(`\ncatalogue counts: ${rows.length - bad}/${rows.length} passed`);
if (bad) { console.error(`${bad} FAILED`); process.exit(1); }
