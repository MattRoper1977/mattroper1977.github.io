#!/usr/bin/env node
'use strict';
/**
 * Homepage doors[] baseline — DERIVED, never pinned.
 *
 * WHY THIS EXISTS. `apexpool-home-verify.yml` used to assert a hardcoded
 * `doors.length !== 12`. Doors went to 14 at 6e8ab12 (site#44) and the step has
 * been RED ON MAIN'S OWN BASELINE ever since — every pull request touching
 * index.html or site.json failed on it, on a fact about main rather than about
 * the change under review.
 *
 * Re-pinning at 14 would be the identical defect one number later: the Apex
 * Golf branch removes a door and takes the count to 13, so a re-pin goes red
 * the moment that merges. A known pending change is the proof that pinning is
 * the wrong shape.
 *
 * So: the count is DERIVED and reported, and what is ASSERTED is structure —
 * things that must hold at 12, 13, 14 or 35 doors alike. This is the third
 * instance of the A-6 shape on this estate. Workflow assertions derive or die.
 */
const fs = require('fs');

function invariants(site, label) {
  const problems = [];
  const doors = site && site.doors;
  if (!Array.isArray(doors)) return { problems: ['doors is not an array'], count: 0 };
  if (doors.length === 0) problems.push('doors is empty');

  const hrefs = [], keys = [];
  doors.forEach((d, i) => {
    const at = `doors[${i}]${d && d.title ? ` "${d.title}"` : ''}`;
    if (!d || typeof d !== 'object') { problems.push(`${at}: not an object`); return; }
    if (!d.title || !String(d.title).trim()) problems.push(`${at}: missing title`);
    if (!d.href || !String(d.href).trim()) problems.push(`${at}: missing href`);
    else {
      // the estate's measured convention: door hrefs are RELATIVE
      if (/^(https?:)?\/\//i.test(d.href) || String(d.href).startsWith('/')) {
        problems.push(`${at}: href "${d.href}" is not relative`);
      }
      hrefs.push(d.href);
    }
    if (d.countKey) keys.push(d.countKey);
    if (d.image && !String(d.image).trim()) problems.push(`${at}: empty image path`);
  });

  const dupHref = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
  if (dupHref.length) problems.push(`duplicate door hrefs: ${[...new Set(dupHref)].join(', ')}`);
  const dupKey = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupKey.length) problems.push(`duplicate countKeys: ${[...new Set(dupKey)].join(', ')}`);

  // one-surface check: no game may hold two doors
  const byGame = {};
  hrefs.forEach(h => { const g = String(h).replace(/\/+$/, ''); byGame[g] = (byGame[g] || 0) + 1; });
  Object.entries(byGame).filter(([, n]) => n > 1)
    .forEach(([g, n]) => problems.push(`${g} holds ${n} doors — one surface per game`));

  return { problems, count: doors.length, withArt: doors.filter(d => d.image).length, relative: hrefs.length };
}

// ---------------------------------------------------------------- self-test
if (process.argv.includes('--self-test')) {
  console.log('== non-vacuity: the invariants must REJECT a broken baseline ==');
  const cases = [
    ['duplicate href', { doors: [{ title: 'A', href: 'a/' }, { title: 'B', href: 'a/' }] }],
    ['absolute href', { doors: [{ title: 'A', href: 'https://example.com/a/' }] }],
    ['missing title', { doors: [{ href: 'a/' }] }],
    ['doors not an array', { doors: 'twelve' }],
    ['two doors for one game', { doors: [{ title: 'A', href: 'a/' }, { title: 'A again', href: 'a' }] }],
  ];
  let bad = 0;
  for (const [name, fixture] of cases) {
    const r = invariants(fixture, name);
    const rejected = r.problems.length > 0;
    console.log(`  ${rejected ? 'REJECTED' : '*** ACCEPTED ***'}  ${name}${rejected ? ` — ${r.problems[0]}` : ''}`);
    if (!rejected) bad++;
  }
  const good = invariants({ doors: [{ title: 'A', href: 'a/', countKey: 'a' }, { title: 'B', href: 'b/', countKey: 'b' }] });
  console.log(`  ${good.problems.length === 0 ? 'ACCEPTED' : '*** REJECTED ***'}  a well-formed 2-door baseline (must pass)`);
  if (good.problems.length) bad++;
  console.log(bad ? `SELF-TEST FAILED — ${bad} case(s) wrong` : 'SELF-TEST PASSED — the check can fail, so its green means something');
  process.exit(bad ? 1 : 0);
}

// ------------------------------------------------------------------- normal
const file = process.argv[2];
if (!file) { console.error('usage: verify_home_doors_baseline.js <site.json> | --self-test'); process.exit(2); }
const site = JSON.parse(fs.readFileSync(file, 'utf8'));
const r = invariants(site, file);

console.log(`baseline doors = ${r.count}   (DERIVED from ${file}, not asserted against a literal)`);
console.log(`  with image    ${r.withArt}/${r.count}`);
console.log(`  relative href ${r.relative}/${r.count}`);
if (r.problems.length) {
  console.error('STRUCTURAL INVARIANTS FAILED:');
  r.problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}
console.log('structural invariants hold: unique hrefs, unique countKeys, all relative, one door per game');
