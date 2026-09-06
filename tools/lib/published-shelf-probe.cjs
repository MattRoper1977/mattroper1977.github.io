'use strict';
// The accepted Play discovery grid includes games, classroom and staff rows.
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

async function verify({ href }) {
  const manifest = await json(RAW);
  const census = JSON.parse(fs.readFileSync(path.resolve(CENSUS), 'utf8'));
  const servedManifest = await json(ORIGIN + '/games.json');
  assert.deepEqual(servedManifest, manifest, 'Live manifest differs from canonical Games main');
  const catalogue = await json(ORIGIN + '/data/domain-catalogue.json');
  const { expectedGames, additional } = catalogueContract(manifest, census, catalogue);
  const target = route(href);
  assert(expectedGames.includes(target), 'The specific game is absent from the canonical shelf');
  const selected = selectedGame(catalogue, href);
  const title = selected.title;
  const report = { origin: ORIGIN, measurement: 'Standalone published shelf', cases: [], pageErrors: [] };
  const out = path.resolve('audit-output/published-shelf-' + target.replaceAll('/', ''));
  fs.mkdirSync(out, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    for (const width of [320, 390, 1366]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce',
                                                extraHTTPHeaders: { DNT: '1' } });
      const page = await context.newPage();
      const requests = [];
      page.on('request', r => requests.push(r.url()));
      page.on('pageerror', e => report.pageErrors.push(String(e)));
      try {
        const response = await page.goto(ORIGIN + '/', { waitUntil: 'networkidle', timeout: 60000 });
        assert.equal(response.status(), 200); assert.equal(page.url(), ORIGIN + '/');
        for (const selector of ['#game-grid', '#result-count', '#query', '#group', '#empty-state', '#discovery-form']) {
          assert.equal(await page.locator(selector).count(), 1, `Missing current shelf control ${selector}`);
        }
        const allRows = [...catalogue.games, ...catalogue.activities, ...catalogue.staff];
        const total = expectedGames.length + additional.length;
        const gridCards = '#game-grid > .game-card:visible';
        const readCards = () => page.locator(gridCards).evaluateAll(nodes => nodes.map(card => {
          const links = card.querySelectorAll('a[data-play]');
          return { id: card.dataset.card, links: links.length, href: links[0]?.href || '',
                   playId: links[0]?.dataset.play, title: card.querySelector('h3')?.textContent || '',
                   genre: card.querySelector('.chips span')?.textContent || '',
                   group: card.querySelector('.chips span:nth-child(2)')?.textContent || '' };
        }));
        const count = () => page.locator(gridCards).count();
        const checkCount = async n => assert.equal(await page.locator('#result-count').innerText(),
          `${n} of ${total} games and activities`, 'Visible count does not match the independent population');
        await page.waitForFunction(n => document.getElementById('result-count')?.textContent ===
          `${n} of ${n} games and activities`, total);
        cardIdentities(await readCards(), allRows, 'Complete rendered Play collection');
        await checkCount(total);
        for (const [group, rows] of Object.entries({ games: catalogue.games, activities: catalogue.activities, staff: catalogue.staff })) {
          await page.locator('#group').selectOption(group);
          const cards = await readCards();
          cardIdentities(cards, rows, `Rendered ${group} filter`);
          await checkCount(rows.length);
          if (group === 'games') {
            const targetCards = cards.filter(card => route(card.href) === target);
            assert.equal(targetCards.length, 1, `${title} must render exactly once`);
            assert(!/sports/i.test(targetCards[0].genre), `${title} has been reclassified as Sports`);
          } else {
            const label = group === 'staff' ? 'Staff activity' : 'Classroom activity';
            assert(cards.every(card => card.group === label), `${group} cards lost their audience labels`);
          }
        }
        await page.locator('#group').selectOption('');
        cardIdentities(await readCards(), allRows, 'Clearing collection restores every entry');
        const hrefs = selector => page.locator(selector).evaluateAll(nodes => nodes.map(a => a.href));
        const features = (await hrefs('.showcase .featured-card a[data-play]')).map(route);
        assert(features.length > 0, 'The game showcase is missing');
        assert.equal(new Set(features).size, features.length, 'Duplicate featured game');
        assert(features.every(r => [...expectedGames, ...additional].includes(r)), 'A featured game points outside the real collection');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Shelf overflows the viewport');
        const earlyLaunches = requests.filter(u => {
          try { return [...expectedGames, ...additional].includes(route(u)); } catch { return false; }
        });
        assert.equal(earlyLaunches.length, 0, 'The shelf automatically loaded a game payload');
        await page.locator('#query').fill(title);
        const matches = (await readCards()).map(card => route(card.href));
        assert.equal(matches.filter(r => r === target).length, 1, 'Searching does not find the existing game exactly once');
        await checkCount(matches.length);
        await page.locator('#query').fill('mbm-no-such-game-verification');
        assert.equal(await count(), 0, 'A nonmatching search is not empty');
        assert(await page.locator('#empty-state').isVisible(), 'A nonmatching search has no visible empty state');
        await checkCount(0);
        await page.locator('#query').fill('');
        cardIdentities(await readCards(), allRows, 'Clearing search restores every entry');
        assert(!(await page.locator('#empty-state').isVisible()), 'Clearing search leaves a false empty state');
        await checkCount(total);
        await page.screenshot({ path: path.join(out, `shelf-${width}.png`), animations: 'disabled' });
        report.cases.push({ width, games: expectedGames.length, activities: catalogue.activities.length,
                            staff: catalogue.staff.length, featured: features.length, search: 'PASS', status: 'PASS' });
        console.log(`PASS ${width}px: ${expectedGames.length} games + ${additional.length} activities; ${title} once, collection filters/search/clear/empty/count/HTTPS/reflow/no-auto-launch`);
      } finally { await context.close(); }
    }
    assert.equal(report.pageErrors.length, 0, 'The published shelf raised a script error');
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
  assert.equal(report.cases.length, 3, 'A viewport was not measured');
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
  console.log('PASS published shelf controls: card identity/title/link mutations, positive membership, empty/missing/duplicate/substitution, zero equality, HTTPS downgrade, foreign host, URL parameters, and paired deletion from both main and live feeds');
}

module.exports = { verify, controls, catalogueContract, selectedGame, members, route };
if (require.main === module) controls();
