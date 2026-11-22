'use strict';
// UX2: catalogue games are grouped by series; classroom/staff retain separate rows.
// TX play shelf navigation v1 (ruling tx): the served shelf may be either shape across the
// release window -- the UX2 grid (#game-grid > .game-card, #classroom .class-row, mood chips,
// one Featured card) or the TX shelves (#game-grid [data-shelf] tracks, activities as
// [data-activity] cards on the Classroom shelf, category + Keyboard/Touch chips, a Spotlight of
// every featured row, led by the one spotlight row). shelfShape() reads which one is served and every limb asserts the
// contract of THAT shape, each derived from the same independent data as before.
// PLAY-D2 (21 Nov 2026): a third shape, the D2 front page (one A-Z grid of one card per game,
// eight mood buttons, Pick a game, Teacher corner, staff item absent). Its limbs derive moods,
// packs and search from the committed domain-split/play/discovery-moods.json.
// Derive complete membership independently from Games main and the accepted W7 census.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PLAY_ORIGIN = 'https://www.madebymatt-play.uk';
// A guarded local seam, the same shape verify_echovault_surfaces.js already uses for
// RF_SHELF_URL. CI never sets it, so in CI this file behaves exactly as it always has:
// ORIGIN is the Play host and route() refuses any other. With it set, and only then,
// route() also accepts that origin's own host, so the probe can be proved red against a
// locally served build. It can never widen CI's host check, because an unset variable
// leaves PROBE_HOSTS as the two Play hostnames and nothing else.
const ORIGIN = process.env.PLAY_SHELF_URL || PLAY_ORIGIN;
const PLAY_HOSTS = ['madebymatt-play.uk', 'www.madebymatt-play.uk'];
// The relaxation is scoped to the overridden origin's OWN host, never to the Play hosts.
// A plain-HTTP or ported Play URL still throws with the seam set, which is what keeps
// controls() honest: its HTTPS-downgrade and foreign-destination cases still fire.
const LOCAL_HOST = ORIGIN === PLAY_ORIGIN ? null : new URL(ORIGIN).hostname;
const RAW = 'https://raw.githubusercontent.com/MattRoper1977/Games/main/games.json';
const CENSUS = 'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json';

function route(value) {
  const u = new URL(value, ORIGIN);
  const local = LOCAL_HOST !== null && u.hostname === LOCAL_HOST;
  assert(local || PLAY_HOSTS.includes(u.hostname), 'Shelf link leaves Play');
  assert(local || u.protocol === 'https:', 'Shelf link downgrades HTTPS');
  assert(local || !u.port, 'Unexpected shelf URL component');
  assert(!u.username && !u.password && !u.search && !u.hash, 'Unexpected shelf URL component');
  return decodeURIComponent(u.pathname).replace(/index\.html$/, '').replace(/\/$/, '') || '/';
}
function members(actual, expected, label) {
  assert(expected.length > 0, `${label}: empty independent expectation`);
  assert(actual.length > 0, `${label}: missing/empty rendered container`);
  assert.equal(new Set(actual).size, actual.length, `${label}: duplicate route`);
  assert.equal(new Set(expected).size, expected.length, `${label}: duplicate independent expectation`);
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label}: missing or substituted route`);
}
function catalogueContract(manifest, census, catalogue) {
  const expectedGames = manifest.games.map(g => route(g.href));
  assert.deepEqual(census.population, { canonicalShelfCount: 68, additionalCount: 7, totalCount: 75, uniqueNormalizedRouteCount: 75 }, 'The accepted 68 + 7 / 75 population contract changed');
  const acceptedGames = census.rows.filter(r => r.populationClass === 'canonical-shelf').map(r => route(r.normalizedDecodedRoute));
  assert.equal(acceptedGames.length, census.population.canonicalShelfCount, 'The canonical census is incomplete');
  members(expectedGames, acceptedGames, 'Current manifest preserves every accepted canonical game');
  const additional = census.rows.filter(r => r.populationClass === 'w7-additional').map(r => route(r.normalizedDecodedRoute));
  assert.equal(additional.length, census.population.additionalCount, 'Accepted activity census is incomplete');
  assert(catalogue.games.length && catalogue.activities.length && catalogue.staff.length, 'A published shelf area is empty');
  const gameRoutes = catalogue.games.map(g => route(g.route));
  const activityRoutes = [...catalogue.activities, ...catalogue.staff].map(g => route(g.route));
  members(gameRoutes, expectedGames, 'Canonical game catalogue');
  members(activityRoutes, additional, 'Classroom and staff catalogue');
  const staffRoutes = census.rows.filter(r => r.populationClass === 'w7-additional' && r.governingSelector.value === 'R4').map(r => route(r.normalizedDecodedRoute));
  assert.equal(staffRoutes.length, 1, 'The accepted staff-training selector is missing or duplicated');
  members(catalogue.staff.map(g => route(g.route)), staffRoutes, 'Staff audience boundary');
  members(catalogue.activities.map(g => route(g.route)), additional.filter(r => !staffRoutes.includes(r)), 'Classroom audience boundary');
  assert(catalogue.staff.every(g => g.safeForPupils === false), 'Staff training lost its pupil-safety boundary');
  members([...gameRoutes, ...activityRoutes], [...expectedGames, ...additional], 'Complete Play population');
  const ids = [...catalogue.games, ...catalogue.activities, ...catalogue.staff].map(g => g.id);
  assert(ids.every(id => typeof id === 'string' && id.length > 0), 'Missing stable catalogue identity');
  assert.equal(new Set(ids).size, ids.length, 'Duplicate catalogue identity');
  return { expectedGames, additional };
}
function selectedGame(catalogue, href) {
  const target = route(href);
  const matches = catalogue.games.filter(game => route(game.route) === target);
  assert.equal(matches.length, 1, 'The selected game route is missing or duplicated');
  assert(typeof matches[0].title === 'string' && matches[0].title.trim(), 'The selected game has no searchable title');
  return matches[0];
}
function cardIdentities(actual, expected, label) {
  members(actual.map(card => route(card.href)), expected.map(card => route(card.route)), label);
  for (const card of actual) {
    const entry = expected.find(item => route(item.route) === route(card.href));
    assert.equal(card.links, 1, `${label}: missing or duplicate play link`);
    assert.equal(card.id, entry.id, `${label}: substituted card identity`);
    assert.equal(card.playId, entry.id, `${label}: substituted play identity`);
    assert.equal(card.title, entry.title, `${label}: substituted game title`);
  }
}
async function json(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${url}: HTTP status`);
  assert.equal(response.url, url, `${url}: changed destination`);
  return response.json();
}

// The presentation feed is checked against the independent canonical population
// before it may supply the approved labels/genres used by the visible UI.
function presentationContract(catalogue, discovery) {
  const canonical = [...catalogue.games, ...catalogue.activities, ...catalogue.staff];
  members(discovery.games.map(g => route(g.route)), canonical.map(g => route(g.route)), 'Presentation membership');
  const overlay = JSON.parse(fs.readFileSync('domain-split/play/activity-metadata.json', 'utf8')).routes;
  const evidence = JSON.parse(fs.readFileSync('domain-split/play/evidence.json', 'utf8')).games;
  for (const row of discovery.games) {
    const expected = canonical.find(g => route(g.route) === route(row.route));
    const extra = overlay[decodeURIComponent(expected.route)] || {};
    const group = catalogue.games.includes(expected) ? 'games' : catalogue.staff.includes(expected) ? 'staff' : 'activities';
    assert.equal(row.id, expected.id, 'Presentation identity');
    assert.equal(row.title, expected.title, 'Presentation title');
    assert.equal(row.group, group, 'Presentation audience');
    assert.equal(Boolean(row.featured), Boolean(expected.featured), 'Presentation featured selection');
    for (const key of ['displayTitle', 'series']) assert.equal(row[key] || '', extra[key] || expected[key] || '', `Presentation ${key}`);
    assert.equal(row.genre, evidence[route(row.route)]?.genre || expected.subject || 'Other', 'Presentation genre');
  }
  return discovery.games;
}
const shownTitle = g => g.displayTitle || g.title;
function expectedCards(games) {
  const groups = new Map();
  for (const game of games) {
    const key = game.series ? 'series:' + game.series : 'id:' + game.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(game);
  }
  return [...groups.values()];
}
// `match`, when given, is the predicate for the filter that is currently active on the page.
// play.js:80 defines active() over q/mood/genre/control/mode/list, and play.js:105-119 then
// renders a series card from the FIRST edition that matches, not from its unfiltered lead:
//   :109  // A series card must launch a matching edition, not its unfiltered lead.
//   :110  const g = hits[0], ...
//   :112  ...card-title.textContent = active() ? title(g) : (g.series || title(g));
//   :119  ....card-meta.innerHTML = '<span class="chip">' + esc(g.genre) + '</span>' + ...
// play.js:13's title() is `g => g.displayTitle || g.title`, i.e. this file's shownTitle().
// So filtered expects the matching edition's own title, unfiltered expects the series name.
// Passing no `match` keeps the previous behaviour exactly, which is what every unfiltered
// call site and both offline series controls rely on.
function ux2Cards(actual, groups, label, match) {
  members(actual.map(c => c.id), groups.map(g => g[0].id), label);
  for (const card of actual) {
    const editions = groups.find(g => g[0].id === card.id), lead = editions[0];
    const shown = match ? (editions.filter(match)[0] || lead) : lead;
    assert.equal(card.title, match ? shownTitle(shown) : (lead.series || shownTitle(lead)), `${label}: card title`);
    assert.equal(card.genre, shown.genre, `${label}: card genre`);
    members(card.ids, editions.map(g => g.id), `${label}: edition identities`);
    members(card.links.map(a => route(a.href)), editions.map(g => route(g.route)), `${label}: all edition links`);
    for (const link of card.links) {
      const game = editions.find(g => route(g.route) === route(link.href));
      assert.equal(link.id, game.id, `${label}: play identity`);
      assert.equal(link.title, shownTitle(game), `${label}: accessible play title`);
    }
  }
}
async function readUx2Cards(page, visible = false) {
  return page.locator('#game-grid .game-card[data-card]' + (visible ? ':visible' : '')).evaluateAll(nodes => nodes.map(card => ({
    id: card.dataset.card, ids: (card.dataset.games || '').split(' '),
    title: card.querySelector('.card-title')?.textContent || '',
    // TX shelves name the category on the shelf, not as a chip on every card.
    genre: card.closest('[data-shelf]')?.dataset.shelf || card.querySelector('.card-meta .chip')?.textContent || '',
    links: [...card.querySelectorAll('a[data-play]')].map(a => ({href:a.href, id:a.dataset.play, title:a.querySelector('.sr-only')?.textContent.trim() || ''})),
  })));
}
async function shelfShape(page) {
  if ((await page.locator('#game-grid [data-shelf]').count()) > 0) return 'tx';
  // PLAY-D2 (21 Nov 2026): one A-Z grid, eight mood buttons, Pick a game, Teacher corner.
  if ((await page.locator('#mood-grid').count()) === 1 && (await page.locator('#pick-grid').count()) === 1) return 'd2';
  return 'ux2';
}
// ---- PLAY-D2 limbs. Every expectation is derived independently: membership from the
// canonical catalogue, moods/packs/pool from the committed discovery-moods.json, never
// from the page being judged.
const MOODS_FILE = 'domain-split/play/discovery-moods.json';
const fold = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
function d2Spec(games) {
  const spec = JSON.parse(fs.readFileSync(MOODS_FILE, 'utf8'));
  const byRoute = new Map(Object.entries(spec.games).map(([r, v]) => [route(r), v]));
  for (const g of games) assert(byRoute.has(route(g.route)), 'D2: a catalogue game has no committed discovery row: ' + g.route);
  members([...byRoute.keys()], games.map(g => route(g.route)), 'D2 committed discovery covers the catalogue');
  const of = g => byRoute.get(route(g.route));
  const labels = new Map(spec.moods.map(m => [m.id, m.label]));
  const synonyms = {}; for (const [w, list] of Object.entries(spec.synonyms || {})) synonyms[fold(w)] = list.map(fold).filter(Boolean);
  const blob = g => { const x = of(g); return ' ' + fold([shownTitle(g), g.title, g.series || '', x.hook, x.primary, x.secondary || '', labels.get(x.primary) || '', labels.get(x.secondary) || '', x.words || '', x.two_player ? '2p 2 player two player mates versus' : '', x.whole_class ? 'class team quiz' : ''].join(' ')); };
  const matches = (g, raw) => { const q = fold(raw); if (!q) return true; const b = blob(g), has = w => b.includes(' ' + w);
    if (synonyms[q] && [q, ...synonyms[q]].some(v => v && has(v))) return true; return q.split(' ').every(t => has(t) || (synonyms[t] || []).some(has)); };
  return { spec, of, labels, matches };
}
function d2Cards(actual, expected, label) {
  members(actual.map(c => c.id), expected.map(g => g.id), label);
  for (const card of actual) {
    const game = expected.find(g => g.id === card.id);
    assert.deepEqual(card.ids, [game.id], `${label}: a card carries another game`);
    assert.equal(card.title, shownTitle(game), `${label}: card title`);
    assert.equal(card.links.length, 1, `${label}: missing or duplicate play link`);
    assert.equal(card.links[0].id, game.id, `${label}: play identity`);
    assert.equal(route(card.links[0].href), route(game.route), `${label}: play destination`);
    assert(card.links[0].label.startsWith('Play ' + shownTitle(game)), `${label}: accessible play title`);
  }
}
async function readD2Cards(page, sel = '#game-grid .game-card[data-card]:visible') {
  return page.locator(sel).evaluateAll(nodes => nodes.map(card => ({
    id: card.dataset.card || card.dataset.pick, ids: (card.dataset.games || card.dataset.pick || '').split(' '),
    title: card.querySelector('.card-title')?.textContent || '',
    links: [...card.querySelectorAll('a[href]')].map(a => ({href: a.href, id: a.dataset.play, label: a.getAttribute('aria-label') || ''})),
  })));
}
async function d2Classroom(page, activities, staff) {
  await page.evaluate(() => { const t = document.querySelector('#classroom'); if (t && 'open' in t) t.open = true; });
  const rows = await page.locator('#classroom [data-activity]').evaluateAll(nodes => nodes.map(row => ({
    id: row.dataset.activity, title: row.querySelector('.activity-name')?.textContent, label: row.querySelector('.activity-sub')?.textContent,
    visible: !!row.getClientRects().length, links: [...row.querySelectorAll('a[href]')].map(a => ({id: a.dataset.play, href: a.href})),
  })));
  members(rows.map(r => r.id), activities.map(g => g.id), 'Teacher corner activities');
  for (const row of rows) {
    const game = activities.find(g => g.id === row.id);
    assert(row.visible, 'Teacher corner row is hidden once opened');
    assert.equal(row.title, shownTitle(game), 'Activity title');
    assert.equal(row.label, 'Lesson activity', 'Visible audience boundary');
    assert.equal(row.links.length, 1, 'Activity play link count');
    assert.equal(row.links[0].id, game.id, 'Activity play identity');
    assert.equal(route(row.links[0].href), route(game.route), 'Activity destination');
  }
  const staffLinks = await page.evaluate(hrefs => [...document.querySelectorAll('a[href]')].filter(a => hrefs.includes(new URL(a.href).pathname)).length, staff.map(g => new URL(g.route, ORIGIN).pathname));
  assert.equal(staffLinks, 0, 'Staff audience boundary: the staff item is linked from the pupil page');
}
async function d2Controls(page, games, activities, staff) {
  // Mutate real DOM; each defect must be caught by the same checkers; restore exactly.
  const mutations = [
    {selector:'#game-grid .game-card[data-card] a[data-play]', kind:'remove'},
    {selector:'#classroom [data-activity]', kind:'remove'},
    {selector:'#game-grid .game-card[data-card]', kind:'identity'},
    {selector:'#classroom [data-activity] .activity-sub', kind:'audience'},
  ];
  for (const mutation of mutations) {
    assert.equal(await page.locator(mutation.selector).first().count(), 1, 'Missing mutation target');
    await page.evaluate(({selector,kind}) => {
      const node = document.querySelector(selector), parent=node.parentNode, next=node.nextSibling;
      const previous = kind==='identity' ? node.getAttribute('data-card') : node.textContent;
      window.__shelfRestore = () => { if(kind==='remove')parent.insertBefore(node,next);else if(kind==='identity')node.setAttribute('data-card',previous);else node.textContent=previous; };
      if(kind==='remove')node.remove(); else if(kind==='identity')node.dataset.card='planted-wrong-id'; else node.textContent='Wrong audience';
    }, mutation);
    try {
      await assert.rejects(async () => { d2Cards(await readD2Cards(page), games, 'DOM control'); await d2Classroom(page, activities, staff); },
        'Planted shelf defect escaped: ' + mutation.kind);
    } finally { await page.evaluate(() => {window.__shelfRestore();delete window.__shelfRestore;}); }
    d2Cards(await readD2Cards(page), games, 'Restored DOM'); await d2Classroom(page, activities, staff);
  }
  return mutations.length;
}
async function d2Page(page, width, ctx) {
  const { games, activities, staff, selected, target, expectedGames, additional, requests, report, total, checkCount } = ctx;
  await page.waitForFunction(() => document.documentElement.dataset.playReady === '1', null, { timeout: 30000 });
  for (const selector of ['#mood-grid','#pick-grid','#expand-btn']) assert.equal(await page.locator(selector).count(), 1, `Missing current page control ${selector}`);
  const { spec, of, labels, matches } = d2Spec(games);
  // Pick a game: one committed pack (its three games, in order) then a Today's pick from the pool.
  const pick = await page.locator('#pick-grid > .card').evaluateAll(ns => ns.map(n => ({id: n.dataset.pick, href: n.querySelector('a[data-play]')?.href})));
  assert.equal(pick.length, 4, 'Pick a game shows four cards');
  const routeOf = id => games.find(g => g.id === id)?.route;
  for (const p of pick) assert(routeOf(p.id) && route(p.href) === route(routeOf(p.id)), 'Pick-a-game destination');
  const pack = spec.packs.find(pk => JSON.stringify(pk.routes.map(route)) === JSON.stringify(pick.slice(0, 3).map(p => route(p.href))));
  assert(pack, 'Pick a game does not show one committed pack: ' + JSON.stringify(pick.map(p => p.id)));
  assert(spec.today_pool.map(route).includes(route(pick[3].href)) && !pack.routes.map(route).includes(route(pick[3].href)), "Today's pick is not a pool game outside the pack");
  // The A-Z grid, shown whole: every catalogue game once, one Play link each.
  await page.evaluate(() => { const b = document.querySelector('#expand-btn'); if (b.getAttribute('aria-expanded') === 'false') b.click(); });
  d2Cards(await readD2Cards(page), games, 'Complete visible grid');
  await d2Classroom(page, activities, staff); await checkCount(total, false);
  if (width === 320) report.renderedControls = await d2Controls(page, games, activities, staff);
  // Moods: the committed set in order, each clicked; results and count derived from the committed rows.
  members(await page.locator('#mood-grid .mood-btn').evaluateAll(ns => ns.map(n => n.dataset.mood)), ['all', ...spec.moods.map(m => m.id)], 'Mood controls');
  for (const m of spec.moods) {
    const want = games.filter(g => of(g).primary === m.id || of(g).secondary === m.id);
    assert(want.length > 0, 'Mood controls: a committed mood holds no served game: ' + m.id);
    await page.locator('#mood-grid .mood-btn[data-mood="' + m.id + '"]').click();
    d2Cards(await readD2Cards(page, '#mood-cards > .card'), want, 'Mood results ' + m.id);
    const ids = await page.locator('#mood-cards > .card').evaluateAll(ns => ns.map(n => n.dataset.pick));
    const firstSecondary = ids.findIndex(id => of(games.find(g => g.id === id)).primary !== m.id);
    assert(firstSecondary === -1 || ids.slice(firstSecondary).every(id => of(games.find(g => g.id === id)).primary !== m.id), 'Mood results put primary games first: ' + m.id);
    assert.equal(await page.locator('#mood-results-title').innerText(), labels.get(m.id) + ' (' + want.length + ')', 'Mood count differs from independent matching games');
  }
  await page.locator('#mood-grid .mood-btn[data-mood="all"]').click();
  assert(await page.locator('#mood-results').isHidden(), 'All games did not clear the mood');
  // Search, derived with the committed words and synonyms, against the selected game's title.
  const hits = games.filter(g => matches(g, selected.title));
  await page.locator('#query').fill(selected.title);
  d2Cards(await readD2Cards(page), hits, 'Search results');
  assert(hits.some(g => route(g.route) === target), 'Search lost selected game'); await checkCount(hits.length);
  await page.locator('#query').fill('mbm-no-such-game-verification');
  assert.equal(await page.locator('#game-grid .game-card:visible').count(), 0, 'Nonmatching search is not empty');
  assert(await page.locator('#empty-state').isVisible(), 'Empty state missing'); await checkCount(0);
  await page.locator('#query').fill('');
  d2Cards(await readD2Cards(page), games, 'Clearing search'); await d2Classroom(page, activities, staff);
  assert(!(await page.locator('#empty-state').isVisible()), 'False empty state after clearing'); await checkCount(total, false);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Shelf overflows viewport');
  assert.equal(requests.filter(u => {try{return [...expectedGames,...additional].includes(route(u));}catch{return false;}}).length, 0, 'Shelf automatically loaded game payload');
  return { moods: spec.moods.length, pack: pack.slug };
}
// `shown` says whether the activities should be visible in the current filter state. UX2 rows
// are always visible; on the TX shelves activities follow All, the Classroom chip and search.
async function classroomRows(page, activities, shown = true) {
  const rows = await page.locator('#classroom .class-row, #classroom [data-activity]').evaluateAll(nodes => nodes.map(row => ({
    tx: row.hasAttribute('data-activity'), id:row.dataset.row || row.dataset.activity,
    title:(row.querySelector('.row-open') || row.querySelector('.card-title'))?.textContent,
    label:(row.querySelector('.row-label') || row.querySelector('.card-meta .chip'))?.textContent, visible:!!row.getClientRects().length,
    links:[...row.querySelectorAll('a[data-play]')].map(a => ({id:a.dataset.play, href:a.href})),
  })));
  members(rows.map(r => r.id), activities.map(g => g.id), 'Separate classroom/staff rows');
  for (const row of rows) {
    const game = activities.find(g => g.id === row.id);
    assert.equal(row.visible, row.tx ? shown : true, row.tx ? 'Activity visibility differs from the filter state' : 'Classroom/staff row is hidden');
    assert.equal(row.title, shownTitle(game), 'Activity title');
    assert.equal(row.label, row.tx ? (game.group === 'staff' ? 'Staff activity' : 'Classroom activity') : (game.group === 'staff' ? 'Staff' : 'Classroom'), 'Visible audience boundary');
    assert.equal(row.links.length, 1, 'Activity play link count');
    assert.equal(row.links[0].id, game.id, 'Activity play identity');
    assert.equal(route(row.links[0].href), route(game.route), 'Activity destination');
  }
}
async function renderedControls(page, groups, activities) {
  // Mutate real DOM, including a collapsed edition. Each defect must be caught
  // by the same checker used above; restore the exact DOM after each mutation.
  const tx = (await shelfShape(page)) === 'tx';
  const mutations = [
    {selector:'#game-grid .card-editions a[data-play]', kind:'remove'},
    {selector: tx ? '#classroom [data-activity]' : '#classroom .class-row', kind:'remove'},
    {selector:'#game-grid .game-card[data-card]', kind:'identity'},
    {selector: tx ? '#classroom [data-activity] .card-meta .chip' : '#classroom .row-label', kind:'audience'},
  ];
  for (const mutation of mutations) {
    assert.equal(await page.locator(mutation.selector).first().count(), 1, 'Missing mutation target');
    await page.evaluate(({selector,kind}) => {
      const node = document.querySelector(selector), parent=node.parentNode, next=node.nextSibling;
      const previous = kind==='identity' ? node.getAttribute('data-card') : node.textContent;
      window.__shelfRestore = () => { if(kind==='remove')parent.insertBefore(node,next);else if(kind==='identity')node.setAttribute('data-card',previous);else node.textContent=previous; };
      if(kind==='remove')node.remove();
      else if(kind==='identity')node.dataset.card='planted-wrong-id';
      else node.textContent='Wrong audience';
    }, mutation);
    try {
      await assert.rejects(async () => { ux2Cards(await readUx2Cards(page), groups, 'DOM control'); await classroomRows(page, activities); },
        'Planted shelf defect escaped: ' + mutation.kind);
    } finally { await page.evaluate(() => {window.__shelfRestore();delete window.__shelfRestore;}); }
    ux2Cards(await readUx2Cards(page), groups, 'Restored DOM'); await classroomRows(page, activities);
  }
  return mutations.length;
}
async function verify({ href }) {
  const [manifest, servedManifest, catalogue, discovery] = await Promise.all([
    json(RAW), json(ORIGIN + '/games.json'), json(ORIGIN + '/data/domain-catalogue.json'), json(ORIGIN + '/data/play-discovery.json'),
  ]);
  const census = JSON.parse(fs.readFileSync(path.resolve(CENSUS), 'utf8'));
  assert.deepEqual(servedManifest, manifest, 'Live manifest differs from canonical Games main');
  const { expectedGames, additional } = catalogueContract(manifest, census, catalogue);
  const rows = presentationContract(catalogue, discovery);
  const games = rows.filter(g => g.group === 'games'), activities = rows.filter(g => g.group !== 'games');
  const groups = expectedCards(games), target = route(href), selected = selectedGame(catalogue, href);
  assert(expectedGames.includes(target), 'The specific game is absent from the canonical shelf');
  const report = { origin: ORIGIN, measurement: 'UX2 published shelf', cases: [], pageErrors: [] };
  const out = path.resolve('audit-output/published-shelf-' + target.replaceAll('/', ''));
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const width of [320, 390, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', extraHTTPHeaders: { DNT: '1' } });
      const page = await context.newPage(), requests = [];
      page.on('request', r => requests.push(r.url())); page.on('pageerror', e => report.pageErrors.push(String(e)));
      try {
        const response = await page.goto(ORIGIN + '/', { waitUntil: 'networkidle', timeout: 60000 });
        assert.equal(response.status(), 200); assert.equal(page.url(), ORIGIN + '/');
        const served = await shelfShape(page);
        for (const selector of ['#game-grid','#result-count','#query','#empty-state','#discovery-form','#classroom', ...(served === 'd2' ? [] : ['#filters-open'])]) {
          assert.equal(await page.locator(selector).count(), 1, `Missing current shelf control ${selector}`);
        }
        const total = games.length;
        const checkCount = async (n, filtered = true) => assert.equal(await page.locator('#result-count').innerText(),
          filtered ? `${n} of ${total} games` : `${total} games`, 'Visible count differs from independent matching games');
        await page.waitForFunction(() => document.documentElement.classList.contains('js'));
        if (served === 'd2') {
          const d2 = await d2Page(page, width, { games, activities: activities.filter(g => g.group === 'activities'), staff: activities.filter(g => g.group === 'staff'), selected, target, expectedGames, additional, requests, report, total, checkCount });
          await page.screenshot({path:path.join(out, `shelf-${width}.png`),animations:'disabled'});
          report.cases.push({width,shape:'d2',games:total,cards:games.length,activities:activities.length,moods:d2.moods,pack:d2.pack,status:'PASS'});
          console.log(`PASS ${width}px (D2): ${total} games in ${games.length} cards + Teacher corner; Pick a game, moods/search/clear/empty/count/HTTPS/reflow/no-auto-launch, staff absent`);
          continue;
        }
        ux2Cards(await readUx2Cards(page, true), groups, 'Complete visible grid');
        await classroomRows(page, activities); await checkCount(total, false);
        assert(!/sports/i.test(games.find(g => g.id === selected.id).genre), 'Selected game moved to Sports');
        if (width === 320) report.renderedControls = await renderedControls(page, groups, activities);
        // Genre replaces the retired Collection select. Count games, including
        // collapsed editions, independently from the number of visible cards.
        // PLAY-D1 moved genre off the chip row into the Filters drawer and put four
        // mood chips in its place. Genre filtering did not disappear, so this is
        // re-anchored to where it now lives rather than deleted: the drawer is opened
        // the way a person opens it, and the expectation is still derived independently
        // from the served data. The mood chips are asserted too, so the control that
        // replaced the old row is covered as well - strictly more than before.
        const genres = [...new Set(games.map(g => g.genre))];
        const shape = await shelfShape(page);
        if (shape === 'ux2') members(await page.locator('[data-chip="mood"]').evaluateAll(ns => ns.map(n => n.dataset.mood)),
          ['Calm', 'Fast', 'Thinky', 'Together'], 'Mood controls');
        else {
          // TX (c): the chips are the served categories (Classroom first) plus Keyboard/Touch.
          members(await page.locator('[data-chip="genre"]').evaluateAll(ns => ns.map(n => n.dataset.genre)), [...new Set(['Classroom', ...genres])], 'Category controls');
          members(await page.locator('[data-chip="control"]').evaluateAll(ns => ns.map(n => n.dataset.control)),
            ['keyboard', 'touch'].filter(v => games.some(g => (g.controls || []).includes(v))), 'Input controls');
          // TX (d): one shelf per category, every lead card on exactly one shelf.
          const shelves = await page.locator('#game-grid [data-shelf]').evaluateAll(ns => ns.map(n => n.dataset.shelf));
          members(shelves, [...new Set(['Classroom', ...genres])], 'Category shelves');
        }
        await page.locator('#filters-open').click();
        await page.locator('#genre').waitFor({state: 'visible'});
        members(await page.locator('#genre option').evaluateAll(ns => ns.map(n => n.value).filter(Boolean)),
          genres, 'Genre controls');
        for (const genre of genres) {
          await page.locator('#genre').selectOption(genre);
          ux2Cards(await readUx2Cards(page, true), groups.filter(gs => gs.some(g => g.genre === genre)), 'Genre results', g => g.genre === genre);
          await checkCount(games.filter(g => g.genre === genre).length); await classroomRows(page, activities, genre === 'Classroom');
        }
        // The empty "All genres" option is how the drawer clears a genre.
        await page.locator('#genre').selectOption('');
        // The drawer is a dialog (#filters-open is aria-haspopup="dialog"), so it is closed
        // the way a person closes it before the chip row is reachable again. check.cjs drives
        // it the same way. Without this the next click lands on the open drawer, not the chip.
        await page.keyboard.press('Escape');
        await page.locator('[data-chip="all"]').click(); await checkCount(total, false);
        ux2Cards(await readUx2Cards(page, true), groups, 'Clearing genre');
        // The mood chips are the control PLAY-D1 put in the genre row's place, so they are
        // exercised rather than merely counted: each is clicked and both the filtered grid and
        // the visible count are checked against an expectation derived from the served data,
        // exactly as the retired per-genre chip loop did. The chip SET is asserted above
        // against the four reviewed moods; this loop walks the moods actually present in the
        // data, so a reviewed mood carrying no games can never red this as a phantom empty.
        if (shape === 'ux2') {
          const moods = [...new Set(games.flatMap(g => g.moods || []))];
          assert(moods.length > 0, 'Mood controls: no served game carries a reviewed mood');
          for (const mood of moods) {
            const inMood = g => (g.moods || []).includes(mood);
            await page.locator('[data-chip="mood"][data-mood="' + mood + '"]').click();
            ux2Cards(await readUx2Cards(page, true), groups.filter(gs => gs.some(inMood)), 'Mood results', inMood);
            await checkCount(games.filter(inMood).length); await classroomRows(page, activities);
          }
        } else {
          // Each category chip is clicked and the shelf, count and activities are checked.
          for (const genre of [...new Set(['Classroom', ...genres])]) {
            const inGenre = g => g.genre === genre;
            await page.locator('[data-chip="genre"][data-genre="' + genre + '"]').click();
            ux2Cards(await readUx2Cards(page, true), groups.filter(gs => gs.some(inGenre)), 'Category results', inGenre);
            await checkCount(games.filter(inGenre).length); await classroomRows(page, activities, genre === 'Classroom');
            await page.locator('[data-chip="all"]').click();
          }
        }
        await page.locator('[data-chip="all"]').click(); await checkCount(total, false);
        ux2Cards(await readUx2Cards(page, true), groups, 'Clearing mood');
        const featuredRows = games.filter(g => g.featured), featured = featuredRows[0];
        assert(featured, 'Independent featured game missing');
        if (shape === 'ux2') {
          const features = await page.locator('.featured a[data-play]').evaluateAll(ns => ns.map(a => ({id:a.dataset.play,href:a.href})));
          assert.equal(features.length, 1, 'Featured game count');
          assert.equal(features[0].id, featured.id); assert.equal(route(features[0].href), route(featured.route));
        } else {
          // TX (a): the Spotlight is every featured row, in served order, one shown at a time.
          // AK10-AB: a served spotlight row (at most one) leads it, ahead of the featured rows.
          const leads = games.filter(g => g.spotlight);
          assert(leads.length <= 1, 'more than one served spotlight row');
          const spotRows = [...leads, ...featuredRows.filter(g => !g.spotlight)];
          const spots = await page.locator('#spotlight [data-spot]').evaluateAll(ns => ns.map(n => ({id:n.dataset.spot, href:n.querySelector('a[data-play]')?.href, shown:!!n.getClientRects().length})));
          assert.deepEqual(spots.map(x => x.id), spotRows.map(g => g.id), 'Spotlight differs from the spotlight and featured flags');
          for (const x of spots) assert.equal(route(x.href), route(spotRows.find(g => g.id === x.id).route), 'Spotlight destination');
          assert.deepEqual(spots.filter(x => x.shown).map(x => x.id), [spotRows[0].id], 'Spotlight shows one game at a time, the first in order');
        }
        const normalize = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const words = normalize(selected.title).split(/\s+/).filter(Boolean);
        // TX (b) search also covers the category and the one-line description.
        const hits = games.filter(g => words.every(w => normalize([g.title,g.displayTitle || '',g.series || '',...(shape === 'tx' ? [g.genre, g.line || ''] : []),g.description].join(' ')).includes(w)));
        await page.locator('#query').fill(selected.title);
        ux2Cards(await readUx2Cards(page, true), groups.filter(gs => gs.some(g => hits.includes(g))), 'Search results', g => hits.includes(g));
        assert(hits.some(g => route(g.route) === target), 'Search lost selected game'); await checkCount(hits.length);
        await page.locator('#query').fill('mbm-no-such-game-verification');
        assert.equal(await page.locator('#game-grid .game-card:visible').count(), 0, 'Nonmatching search is not empty');
        assert(await page.locator('#empty-state').isVisible(), 'Empty state missing'); await checkCount(0);
        await page.locator('#query').fill('');
        ux2Cards(await readUx2Cards(page, true), groups, 'Clearing search'); await classroomRows(page, activities);
        assert(!(await page.locator('#empty-state').isVisible()), 'False empty state after clearing'); await checkCount(total, false);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Shelf overflows viewport');
        assert.equal(requests.filter(u => {try{return [...expectedGames,...additional].includes(route(u));}catch{return false;}}).length, 0, 'Shelf automatically loaded game payload');
        await page.screenshot({path:path.join(out, `shelf-${width}.png`),animations:'disabled'});
        report.cases.push({width,games:total,cards:groups.length,activities:activities.length,genres:genres.length,status:'PASS'});
        console.log(`PASS ${width}px: ${total} games in ${groups.length} cards + ${activities.length} audience rows; all editions, genres/search/clear/empty/count/HTTPS/reflow/no-auto-launch`);
      } finally { await context.close(); }
    }
    // Source markup must also retain every edition when scripts are unavailable.
    const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:900}});
    try {
      const page=await context.newPage(); const response=await page.goto(ORIGIN+'/',{waitUntil:'load'}); assert.equal(response.status(),200);
      if (await shelfShape(page) === 'd2') { d2Cards(await readD2Cards(page), games, 'No-JS complete grid'); await d2Classroom(page, activities.filter(g => g.group === 'activities'), activities.filter(g => g.group === 'staff')); }
      else { ux2Cards(await readUx2Cards(page,true),groups,'No-JS complete grid'); await classroomRows(page,activities); }
      const links=await page.locator('#game-grid .game-card[data-card] a[data-play]:visible').evaluateAll(ns=>ns.map(a=>a.href));
      members(links.map(route),expectedGames,'No-JS visible edition links'); report.noJavaScript='PASS';
    } finally {await context.close();}
    assert.equal(report.pageErrors.length,0,'Published shelf script error');
  } finally { await browser.close(); fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n'); }
  assert.equal(report.cases.length,3,'A viewport was not measured');
}

function controls() {
  members(['a', 'b'], ['a', 'b'], 'working member control');
  const entry = { id: 'control', route: '/control/', title: 'Control' };
  const card = { id: entry.id, playId: entry.id, href: entry.route, title: entry.title, links: 1 };
  cardIdentities([card], [entry], 'working card control');
  for (const mutation of [{ id: 'other' }, { playId: 'other' }, { title: 'Another game' }, { links: 0 }, { links: 2 }]) {
    assert.throws(() => cardIdentities([{ ...card, ...mutation }], [entry], 'mutated card'),
      'A card with a substituted identity/title or missing/duplicate play link was accepted');
  }
  const editions = [
    {id:'edition-a',route:'/edition-a/',title:'Edition A',series:'Series',genre:'Adventure'},
    {id:'edition-b',route:'/edition-b/',title:'Edition B',series:'Series',genre:'Adventure'},
  ];
  const grouped = {id:'edition-a',ids:['edition-a','edition-b'],title:'Series',genre:'Adventure',
    links:editions.map(g=>({id:g.id,href:g.route,title:g.title}))};
  ux2Cards([grouped],[editions],'working UX2 series');
  for (const change of [c=>c.links.pop(),c=>c.ids.pop(),c=>c.links.push(c.links[0]),c=>c.title='Wrong title',
    c=>c.genre='Sports',c=>c.links[1].id='wrong-id',c=>c.links[1].title='Wrong edition']) {
    const broken=structuredClone(grouped);change(broken);
    assert.throws(()=>ux2Cards([broken],[editions],'mutated UX2 series'),'Broken series representation was accepted');
  }
  const similarNames = { games: [
    { route: '/fracture/', title: 'Relicforge: Fracture Engine' },
    { route: '/relicforge/', title: 'Relic Forge: Crownfall' },
  ] };
  assert.equal(selectedGame(similarNames, '/relicforge/').title, 'Relic Forge: Crownfall', 'Similar game names must not replace the requested route');
  assert.throws(() => selectedGame(similarNames, '/missing/'), 'A missing selected game was accepted');
  for (const actual of [[], ['a'], ['a', 'a'], ['a', 'ghost']]) {
    assert.throws(() => members(actual, ['a', 'b'], 'mutation'), 'Broken membership was accepted');
  }
  assert.throws(() => members([], [], 'zero equality'), 'Empty equality was accepted');
  assert.throws(() => route('http://www.madebymatt-play.uk/echovault/'), 'HTTPS downgrade was accepted');
  assert.throws(() => route('https://example.com/echovault/'), 'Foreign destination was accepted');
  assert.throws(() => route('/echovault/?pupil=private'), 'Sensitive query was accepted');
  const games = Array.from({ length: 68 }, (_, n) => ({ href: `/control-game-${n}/` }));
  const activities = Array.from({ length: 7 }, (_, n) => ({ route: `/control-activity-${n}/`, id: `activity-${n}` }));
  const census = { population: { canonicalShelfCount: 68, additionalCount: 7, totalCount: 75, uniqueNormalizedRouteCount: 75 }, rows: [
    ...games.map(g => ({ populationClass: 'canonical-shelf', normalizedDecodedRoute: g.href })),
    ...activities.map((g, n) => ({ populationClass: 'w7-additional', normalizedDecodedRoute: g.route, governingSelector: { value: `R${n + 1}` } })),
  ] };
  const catalogue = { games: games.map((g, n) => ({ route: g.href, id: `game-${n}` })),
    activities: activities.filter((_, n) => n !== 3), staff: [{ ...activities[3], safeForPupils: false }] };
  catalogueContract({ games }, census, catalogue);
  const reducedManifest = { games: games.slice(1) };
  const reducedCatalogue = { ...catalogue, games: catalogue.games.slice(1) };
  assert.throws(() => catalogueContract(reducedManifest, census, reducedCatalogue), /preserves every accepted canonical game/, 'A paired deletion from both feeds escaped preservation coverage');
  console.log('PASS published shelf controls: seven UX2 series mutations, card identity/title/link mutations, positive membership, empty/missing/duplicate/substitution, zero equality, HTTPS downgrade, foreign host, URL parameters, and paired deletion from both main and live feeds');
}

module.exports = { verify, controls, catalogueContract, selectedGame, members, route };
if (require.main === module) controls();
