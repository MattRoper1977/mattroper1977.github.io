'use strict';
// UX2: catalogue games are grouped by series; classroom/staff retain separate rows.
// Derive complete membership independently from Games main and the accepted W7 census.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ORIGIN = 'https://www.madebymatt-play.uk';
const RAW = 'https://raw.githubusercontent.com/MattRoper1977/Games/main/games.json';
const CENSUS = 'reports/v6fin/V6FIN_W7_69_ROUTE_CENSUS_2026-09-03.json';

function route(value) {
  const u = new URL(value, ORIGIN);
  assert(['madebymatt-play.uk', 'www.madebymatt-play.uk'].includes(u.hostname), 'Shelf link leaves Play');
  assert.equal(u.protocol, 'https:', 'Shelf link downgrades HTTPS');
  assert(!u.port && !u.username && !u.password && !u.search && !u.hash, 'Unexpected shelf URL component');
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
  assert.deepEqual(census.population, { canonicalShelfCount: 62, additionalCount: 7, totalCount: 69, uniqueNormalizedRouteCount: 69 }, 'The accepted 62 + 7 / 69 population contract changed');
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
function ux2Cards(actual, groups, label) {
  members(actual.map(c => c.id), groups.map(g => g[0].id), label);
  for (const card of actual) {
    const editions = groups.find(g => g[0].id === card.id), lead = editions[0];
    assert.equal(card.title, lead.series || shownTitle(lead), `${label}: card title`);
    assert.equal(card.genre, lead.genre, `${label}: card genre`);
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
  return page.locator('#game-grid > .game-card' + (visible ? ':visible' : '')).evaluateAll(nodes => nodes.map(card => ({
    id: card.dataset.card, ids: (card.dataset.games || '').split(' '),
    title: card.querySelector('.card-title')?.textContent || '',
    genre: card.querySelector('.card-meta .chip')?.textContent || '',
    links: [...card.querySelectorAll('a[data-play]')].map(a => ({href:a.href, id:a.dataset.play, title:a.querySelector('.sr-only')?.textContent.trim() || ''})),
  })));
}
async function classroomRows(page, activities) {
  const rows = await page.locator('#classroom .class-row').evaluateAll(nodes => nodes.map(row => ({
    id:row.dataset.row, title:row.querySelector('.row-open')?.textContent,
    label:row.querySelector('.row-label')?.textContent, visible:!!row.getClientRects().length,
    links:[...row.querySelectorAll('a[data-play]')].map(a => ({id:a.dataset.play, href:a.href})),
  })));
  members(rows.map(r => r.id), activities.map(g => g.id), 'Separate classroom/staff rows');
  for (const row of rows) {
    const game = activities.find(g => g.id === row.id);
    assert(row.visible, 'Classroom/staff row is hidden');
    assert.equal(row.title, shownTitle(game), 'Activity title');
    assert.equal(row.label, game.group === 'staff' ? 'Staff' : 'Classroom', 'Visible audience boundary');
    assert.equal(row.links.length, 1, 'Activity play link count');
    assert.equal(row.links[0].id, game.id, 'Activity play identity');
    assert.equal(route(row.links[0].href), route(game.route), 'Activity destination');
  }
}
async function renderedControls(page, groups, activities) {
  // Mutate real DOM, including a collapsed edition. Each defect must be caught
  // by the same checker used above; restore the exact DOM after each mutation.
  const mutations = [
    {selector:'#game-grid .card-editions a[data-play]', kind:'remove'},
    {selector:'#classroom .class-row', kind:'remove'},
    {selector:'#game-grid .game-card', kind:'identity'},
    {selector:'#classroom .row-label', kind:'audience'},
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
        for (const selector of ['#game-grid','#result-count','#query','#empty-state','#discovery-form','#classroom','#filters-open']) {
          assert.equal(await page.locator(selector).count(), 1, `Missing current shelf control ${selector}`);
        }
        const total = games.length;
        const checkCount = async (n, filtered = true) => assert.equal(await page.locator('#result-count').innerText(),
          filtered ? `${n} of ${total} games` : `${total} games`, 'Visible count differs from independent matching games');
        await page.waitForFunction(() => document.documentElement.classList.contains('js'));
        ux2Cards(await readUx2Cards(page, true), groups, 'Complete visible grid');
        await classroomRows(page, activities); await checkCount(total, false);
        assert(!/sports/i.test(games.find(g => g.id === selected.id).genre), 'Selected game moved to Sports');
        if (width === 320) report.renderedControls = await renderedControls(page, groups, activities);
        // Genre replaces the retired Collection select. Count games, including
        // collapsed editions, independently from the number of visible cards.
        const genres = [...new Set(games.map(g => g.genre))];
        members(await page.locator('[data-chip="genre"]').evaluateAll(ns => ns.map(n => n.dataset.genre)), genres, 'Genre controls');
        for (const genre of genres) {
          await page.locator('[data-chip="genre"]').filter({hasText:new RegExp('^' + genre.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$')}).click();
          ux2Cards(await readUx2Cards(page, true), groups.filter(gs => gs.some(g => g.genre === genre)), 'Genre results');
          await checkCount(games.filter(g => g.genre === genre).length); await classroomRows(page, activities);
        }
        await page.locator('[data-chip="all"]').click(); await checkCount(total, false);
        ux2Cards(await readUx2Cards(page, true), groups, 'Clearing genre');
        const features = await page.locator('.featured a[data-play]').evaluateAll(ns => ns.map(a => ({id:a.dataset.play,href:a.href})));
        const featured = games.find(g => g.featured);
        assert(featured, 'Independent featured game missing'); assert.equal(features.length, 1, 'Featured game count');
        assert.equal(features[0].id, featured.id); assert.equal(route(features[0].href), route(featured.route));
        const normalize = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const words = normalize(selected.title).split(/\s+/).filter(Boolean);
        const hits = games.filter(g => words.every(w => normalize([g.title,g.displayTitle || '',g.series || '',g.description].join(' ')).includes(w)));
        await page.locator('#query').fill(selected.title);
        ux2Cards(await readUx2Cards(page, true), groups.filter(gs => gs.some(g => hits.includes(g))), 'Search results');
        assert(hits.some(g => route(g.route) === target), 'Search lost selected game'); await checkCount(hits.length);
        await page.locator('#query').fill('mbm-no-such-game-verification');
        assert.equal(await page.locator('#game-grid > .game-card:visible').count(), 0, 'Nonmatching search is not empty');
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
      ux2Cards(await readUx2Cards(page,true),groups,'No-JS complete grid'); await classroomRows(page,activities);
      const links=await page.locator('#game-grid a[data-play]:visible').evaluateAll(ns=>ns.map(a=>a.href));
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
  const games = Array.from({ length: 62 }, (_, n) => ({ href: `/control-game-${n}/` }));
  const activities = Array.from({ length: 7 }, (_, n) => ({ route: `/control-activity-${n}/`, id: `activity-${n}` }));
  const census = { population: { canonicalShelfCount: 62, additionalCount: 7, totalCount: 69, uniqueNormalizedRouteCount: 69 }, rows: [
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
