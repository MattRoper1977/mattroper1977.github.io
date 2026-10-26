#!/usr/bin/env node
/* J93: what the Lessons hub itself says about the four homepage subject tiles
 * and the flagship week, read from a Lessons tree (the checkout the Site
 * publication builds with, or a built education-lessons tree).
 *
 * uz-6 (b), DESIGN "subjects.hubs.{0..3}": liveCount is each hub's own rule,
 * distinctLessons over that hub's card rows, computed BY the Lessons copy of
 * assets/catalogue/hub.js. J91's subject_lesson_index.cjs needs the rowHref
 * export, which hub.js at the Site's Lessons pin (9ed44bdf) lacks; this script
 * uses only exports present at 9ed44bdf and at c388aec1: loadAll, cardsFromRows,
 * slugForQuery, distinctLessons, isLesson, displayTitle, HALF_TERMS, state.
 *
 * Nothing here re-implements the hub. The hub.js of the tree runs in a vm; its
 * own loadAll() fetches the files it always fetches, answered from the tree (a
 * file the tree lacks answers 404, as it would when served). The card is the
 * one its own slugForQuery() and cardsFromRows() pick, so the subject, the
 * pathway (tierOf, read as row._tier, which prepare() sets) and the display
 * title (displayTitle after the hub's display-titles rule) are the hub's.
 *
 * Usage: node home_hub_counts.cjs <lessons-tree> <subject-query>... [--week <query>:<term>:<week>]...
 *   e.g. node home_hub_counts.cjs L science humanities-re art-studio lifeskills --week science:Aut2:6
 * Prints one JSON object on stdout; any failure exits non-zero.
 *   counts:   {query: distinctLessons(card.rows)}
 *   halfTerms: hub.js HALF_TERMS
 *   weeks:    {"<query>:<term>:<week>": [lesson rows of that card whose lesson-order
 *              entry lists that term and week: {file, registry, pathway, title, desc, weekLabel}]}
 *              registry: the row is in resources.json (not a lesson-order supplement)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fail(message) {
  process.stderr.write('home_hub_counts: ' + message + '\n');
  process.exit(1);
}

const args = process.argv.slice(2);
const root = args.shift();
const queries = [], weeks = [];
while (args.length) {
  const item = args.shift();
  if (item === '--week') {
    const spec = args.shift() || '';
    const m = spec.match(/^([a-z0-9-]+):([A-Za-z0-9]+):([0-9]+)$/);
    if (!m) fail('a week is <query>:<term>:<week>, not ' + JSON.stringify(spec));
    weeks.push({ spec, query: m[1], term: m[2], week: Number(m[3]) });
  } else queries.push(item);
}
if (!root || (!queries.length && !weeks.length)) fail('usage: home_hub_counts.cjs <lessons-tree> <subject-query>... [--week <query>:<term>:<week>]...');
const base = path.resolve(root);

// A page-relative request, resolved against the tree the page is served from.
function read(relative) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(relative) || relative.startsWith('/')) return null;
  const file = path.resolve(base, relative);
  if (!file.startsWith(base + path.sep)) return null;
  try { return fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf8') : null; } catch (_) { return null; }
}

const requests = [];
function fetch(url) {
  const relative = String(url).split(/[?#]/)[0];
  const text = read(relative);
  requests.push({ path: relative, status: text === null ? 404 : 200 });
  return Promise.resolve({
    ok: text !== null,
    status: text === null ? 404 : 200,
    json: () => Promise.resolve(JSON.parse(text)),
  });
}

const hub = read('assets/catalogue/hub.js');
if (hub === null) fail('the tree has no assets/catalogue/hub.js');
const win = { localStorage: { getItem: () => null }, matchMedia: () => ({ matches: false }) };
win.window = win;
vm.runInContext(hub, vm.createContext({ window: win, fetch }), { filename: 'assets/catalogue/hub.js' });
const H = win.MBM_HUB;
if (!H) fail('hub.js did not define MBM_HUB');
const needed = ['loadAll', 'cardsFromRows', 'slugForQuery', 'distinctLessons', 'isLesson', 'displayTitle'];
const missing = needed.filter(name => typeof H[name] !== 'function');
if (missing.length) fail('hub.js does not export ' + missing.join(', '));
if (!Array.isArray(H.HALF_TERMS)) fail('hub.js does not export HALF_TERMS');

H.loadAll().then(state => {
  const cards = H.cardsFromRows(state.rows);
  const cardFor = query => {
    const slug = H.slugForQuery(query);
    const card = cards.find(c => c.slug === slug);
    if (!card) fail('no subject card answers ?subject=' + query);
    return card;
  };
  const counts = {};
  for (const query of queries) counts[query] = H.distinctLessons(cardFor(query).rows);
  const entries = (state.order && state.order.entries) || {};
  // A registry row is a row of the tree's own resources.json (the file loadAll
  // read); lesson-order supplements are hub rows but not registry rows.
  const registry = new Set(JSON.parse(read('resources.json')).map(r => r.file || r.url));
  const out = {};
  for (const w of weeks) {
    out[w.spec] = cardFor(w.query).rows.filter(H.isLesson).flatMap(row => {
      const entry = entries[row._path];
      const hit = entry && Array.isArray(entry.weeks) ? entry.weeks.find(x => x && x.term === w.term && x.week === w.week) : null;
      if (!hit) return [];
      return [{ file: row._path, registry: registry.has(row._path), pathway: row._tier == null ? null : String(row._tier),
                title: H.displayTitle(row), desc: row.desc == null ? null : String(row.desc),
                weekLabel: hit.label == null ? null : String(hit.label) }];
    });
  }
  process.stdout.write(JSON.stringify({ counts, halfTerms: H.HALF_TERMS.slice(), weeks: out, requests }) + '\n');
}).catch(err => fail('loadAll failed: ' + (err && err.message ? err.message : String(err))));
