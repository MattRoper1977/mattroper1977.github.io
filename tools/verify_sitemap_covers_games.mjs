#!/usr/bin/env node
/*
 * verify_sitemap_covers_games.mjs — a published game must be findable.
 *
 * P4 published /apexcurl/ and /apexvelodrome/, put them on the shelf, gave them
 * their own contract gates — and left them out of sitemap.xml. Every other game
 * in the estate was in it. Nothing noticed, because nothing was asking.
 *
 * Nothing here is pinned. The expected set is DERIVED from the shelf manifest
 * this repo already carries, and the count is asserted non-zero first, so an
 * empty manifest cannot satisfy "every game is covered" by covering none.
 *
 *   node tools/verify_sitemap_covers_games.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://madebymatt.uk';

const rows = [];
const check = (ok, name, detail = '') => {
  rows.push(ok);
  console.log(`  [${ok ? ' ok ' : 'FAIL'}] ${name}${detail ? '  — ' + detail : ''}`);
};

const games = JSON.parse(readFileSync(join(ROOT, 'data/source-manifests/games.json'), 'utf8')).games;
const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

console.log('\n=== EVERY GAME ON THE SHELF IS IN THE SITEMAP ===\n');

/* The floor. Without this, an empty manifest makes every assertion below
   trivially true — the vacuous shape the register names. */
check(games.length > 0, 'the manifest carries games to check', `${games.length} entries`);
check(locs.length > 0, 'the sitemap carries urls to check against', `${locs.length} <loc> entries`);

const inSitemap = new Set(locs);
/* Scope, derived from the filesystem rather than from a list kept by hand.
   The shelf carries entries this repo does not serve — the Lessons estate's
   games live under /Lessons/Games/*.html and are published by another repo, and
   its sitemap is not this one. What THIS sitemap is answerable for is every
   manifest entry that resolves to a directory here with an index.html in it. */
const ours = games.filter(g => {
  const h = String(g.href);
  return /^\/[A-Za-z0-9_-]+\/$/.test(h) && existsSync(join(ROOT, h.slice(1), 'index.html'));
});
check(ours.length > 0, 'the manifest carries routes THIS repo serves', `${ours.length} of ${games.length}`);

const missing = ours
  .map(g => ORIGIN + String(g.href).replace(/\/?$/, '/'))
  .filter(u => !inSitemap.has(u));
check(missing.length === 0, 'every game this repo serves has a sitemap entry', missing.join(', ') || `all ${ours.length} covered`);

const dupes = locs.filter((u, i) => locs.indexOf(u) !== i);
check(dupes.length === 0, 'no url is listed twice', [...new Set(dupes)].join(', ') || 'none');

const pass = rows.filter(Boolean).length;
console.log(`\nsitemap coverage: ${pass}/${rows.length} passed`);
if (pass !== rows.length) { console.error(`${rows.length - pass} FAILED`); process.exit(1); }
