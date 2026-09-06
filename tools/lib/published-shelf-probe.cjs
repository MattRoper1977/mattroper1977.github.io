'use strict';
// The accepted standalone Play publication uses a paginated catalogue, not the
// retired education-domain TAXONOMY/genreSections/Top Picks DOM. Derive the
// complete membership independently from Games main and the accepted W7 census.
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
async function json(url) {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${url}: HTTP status`);
  assert.equal(response.url, url, `${url}: changed destination`);
  return response.json();
}

async function verify({ href, title }) {
  const manifest = await json(RAW);
  const census = JSON.parse(fs.readFileSync(path.resolve(CENSUS), 'utf8'));
  const servedManifest = await json(ORIGIN + '/games.json');
  assert.deepEqual(servedManifest, manifest, 'Live manifest differs from canonical Games main');
  const catalogue = await json(ORIGIN + '/data/domain-catalogue.json');
  const { expectedGames, additional } = catalogueContract(manifest, census, catalogue);
  const target = route(href);
  assert(expectedGames.includes(target), 'The specific game is absent from the canonical shelf');
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
        for (const selector of ['#games-results', '#games-status', '#games-q', '#games-more', '#classroom-activities', '#staff-activities']) {
          assert.equal(await page.locator(selector).count(), 1, `Missing current shelf control ${selector}`);
        }
        await page.waitForFunction(() => document.querySelectorAll('#games-results a.result').length > 0);
        const count = async () => page.locator('#games-results a.result').count();
        let clicks = 0;
        while (await page.locator('#games-more').isVisible()) {
          assert(clicks++ < expectedGames.length, 'Show more made no bounded progress');
          const before = await count();
          await page.locator('#games-more').click();
          assert(await count() > before, 'Show more did not expose additional games');
        }
        const hrefs = selector => page.locator(selector).evaluateAll(nodes => nodes.map(a => a.href));
        const rendered = (await hrefs('#games-results a.result')).map(route);
        members(rendered, expectedGames, 'Complete rendered games shelf');
        assert.equal(rendered.filter(r => r === target).length, 1, `${title} must render exactly once`);
        assert((await page.locator('#games-status').innerText()).includes(`of ${expectedGames.length} games`), 'Visible count does not report the canonical total');
        const targetCard = page.locator('#games-results a.result').filter({ has: page.locator('h3', { hasText: title }) });
        assert.equal(await targetCard.count(), 1, 'Specific game title is missing/duplicated');
        assert(!/sports/i.test(await targetCard.locator('small').innerText()), `${title} has been reclassified as Sports`);
        members((await hrefs('#classroom-activities a.result')).map(route), catalogue.activities.map(g => route(g.route)), 'Rendered classroom area');
        members((await hrefs('#staff-activities a.result')).map(route), catalogue.staff.map(g => route(g.route)), 'Rendered staff area');
        const features = (await hrefs('a.game-spotlight, a.feature-card')).map(route);
        assert(features.length > 0, 'The game showcase is missing');
        assert.equal(new Set(features).size, features.length, 'Duplicate featured game');
        assert(features.every(r => [...expectedGames, ...additional].includes(r)), 'A featured game points outside the real collection');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Shelf overflows the viewport');
        const earlyLaunches = requests.filter(u => {
          try { return [...expectedGames, ...additional].includes(route(u)); } catch { return false; }
        });
        assert.equal(earlyLaunches.length, 0, 'The shelf automatically loaded a game payload');
        await page.locator('#games-q').fill(title);
        await page.waitForFunction(name => [...document.querySelectorAll('#games-results h3')].some(n => n.textContent.includes(name)), title);
        const matches = (await hrefs('#games-results a.result')).map(route);
        assert.equal(matches.filter(r => r === target).length, 1, 'Searching does not find the existing game exactly once');
        await page.locator('#games-q').fill('mbm-no-such-game-verification');
        assert.equal(await count(), 0, 'A nonmatching search is not empty');
        assert.match(await page.locator('#games-status').innerText(), /No matches/i);
        await page.locator('#games-q').fill('');
        assert(await count() > 0, 'Clearing search does not restore games');
        await page.screenshot({ path: path.join(out, `shelf-${width}.png`), animations: 'disabled' });
        report.cases.push({ width, games: rendered.length, activities: catalogue.activities.length,
                            staff: catalogue.staff.length, featured: features.length, search: 'PASS', status: 'PASS' });
        console.log(`PASS ${width}px: ${rendered.length} games + ${additional.length} activities; ${title} once, search/clear/empty/count/HTTPS/reflow/no-auto-launch`);
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
  console.log('PASS published shelf controls: positive membership, empty/missing/duplicate/substitution, zero equality, HTTPS downgrade, foreign host, URL parameters, and paired deletion from both main and live feeds');
}

module.exports = { verify, controls, catalogueContract, members, route };
if (require.main === module) controls();
