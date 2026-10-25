#!/usr/bin/env node
/* J91: the lesson list hub.js itself shows on /Lessons/subject.html for one
 * ?subject= query, read from a BUILT Lessons tree (output/education-lessons).
 *
 * ug add.1 (d): "the noscript lesson index is generated from the registry at
 * build time into the draft's slot". ug add.11 (d)+(h): it lists Science
 * lessons only (the caller passes the query; this script types no subject).
 *
 * Nothing here re-implements the hub. The built hub.js runs in a vm; its own
 * loadAll() fetches the registry files it always fetches, answered from the
 * built tree (a file the tree lacks answers 404, as it would when served);
 * the card is the one its own slugForQuery() and cardsFromRows() pick; the list
 * is its own lessonGroups() over that card's isLesson() rows, in its order;
 * each primary is titled by displayTitle() and linked by safeHref(rowHref()),
 * the href lessonRow() writes. distinctLessons() is reported beside it, as the
 * page's own lesson count, for the caller to compare.
 *
 * Usage: node subject_lesson_index.cjs <built-lessons-dir> <subject-query>
 * Prints one JSON object on stdout; any failure exits non-zero.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function fail(message) {
  process.stderr.write('subject_lesson_index: ' + message + '\n');
  process.exit(1);
}

const [root, query] = process.argv.slice(2);
if (!root || !query) fail('usage: subject_lesson_index.cjs <built-lessons-dir> <subject-query>');
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
if (hub === null) fail('the built tree has no assets/catalogue/hub.js');
const win = { localStorage: { getItem: () => null }, matchMedia: () => ({ matches: false }) };
win.window = win;
vm.runInContext(hub, vm.createContext({ window: win, fetch }), { filename: 'assets/catalogue/hub.js' });
const H = win.MBM_HUB;
if (!H) fail('hub.js did not define MBM_HUB');
const needed = ['loadAll', 'cardsFromRows', 'slugForQuery', 'isLesson', 'lessonGroups',
  'distinctLessons', 'displayTitle', 'safeHref', 'rowHref'];
const missing = needed.filter(name => typeof H[name] !== 'function');
if (missing.length) fail('hub.js does not export ' + missing.join(', '));

H.loadAll().then(state => {
  const slug = H.slugForQuery(query);
  const card = H.cardsFromRows(state.rows).find(c => c.slug === slug);
  if (!card) fail('no subject card answers ?subject=' + query);
  const lessons = H.lessonGroups(card.rows.filter(H.isLesson)).map(group => ({
    href: H.safeHref(H.rowHref(group.primary)),
    title: H.displayTitle(group.primary),
    path: group.primary._path,
    type: group.primary.type == null ? null : String(group.primary.type),
  }));
  process.stdout.write(JSON.stringify({
    query, card: card.slug, distinctLessons: H.distinctLessons(card.rows), lessons, requests,
  }) + '\n');
}).catch(err => fail('loadAll failed: ' + (err && err.message ? err.message : String(err))));
