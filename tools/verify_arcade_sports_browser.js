#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = (process.env.ARCADE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const MANIFEST = process.env.ARCADE_BASELINE_MANIFEST || path.join(__dirname, '..', 'artifacts', 'arcade-sports', 'games-baseline.json');
const ARTIFACTS = process.env.ARCADE_ARTIFACT_DIR || path.join(__dirname, '..', 'artifacts', 'arcade-sports');
fs.mkdirSync(ARTIFACTS, { recursive: true });

const baselineDoc = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const baseline = baselineDoc.games || [];
const pool = {
  icon: '🎱',
  title: 'Apex Pool',
  desc: "NEW · Call the cue ball's leave, then prove you can read the table. Offline 8-ball with genuine spin, position play, AI, trick shots and an honest Leave Rating.",
  href: '/apexpool/',
  tag: 'Physics',
  hue: '#F2A24A',
  featured: false,
  hero: false,
  art: '/assets/cards/apex-pool.svg',
  collection: 'Sports'
};

let pass = 0;
let fail = 0;
function ok(name, condition, detail = '') {
  if (condition) { pass++; console.log('  PASS  ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '   ' + detail : '')); }
}
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function tags(games) {
  const out = {};
  games.forEach((game) => { out[game.tag] = (out[game.tag] || 0) + 1; });
  return out;
}
function candidate() {
  if (baseline.some((game) => game.title === 'Apex Pool' || game.href === '/apexpool/')) throw new Error('Baseline already contains Apex Pool');
  const games = JSON.parse(JSON.stringify(baseline));
  const kicks = games.filter((game) => game.title === 'Apex Kick');
  if (kicks.length !== 1) throw new Error(`Expected one Apex Kick, found ${kicks.length}`);
  kicks[0].collection = 'Sports';
  games.push(pool);
  return games;
}
function validators(games) {
  const sports = games.filter((game) => game.collection === 'Sports');
  const kick = games.find((game) => game.title === 'Apex Kick');
  const apexPool = games.find((game) => game.title === 'Apex Pool');
  return {
    exactMembership: same(sports.map((game) => game.title), ['Apex Kick', 'Apex Pool']),
    allArt: games.every((game) => typeof game.art === 'string' && game.art.length > 0),
    distinctHue: !!kick && !!apexPool && kick.hue !== apexPool.hue,
    uniquePool: games.filter((game) => game.title === 'Apex Pool').length === 1 && games.filter((game) => game.href === '/apexpool/').length === 1
  };
}
async function load(browser, games, label) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
  page.on('pageerror', (error) => errors.push('pageerror: ' + (error.stack || error.message || String(error))));
  await page.route('**/Games/games.json', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ games }) });
  });
  const response = await page.goto(BASE + '/games/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const line = document.getElementById('countline');
    return line && !/Loading|could not load/.test(line.textContent) && document.querySelectorAll('#allGrid .gcard').length > 0;
  });
  await page.waitForTimeout(150);
  const snapshot = await page.evaluate(() => {
    function title(element) {
      const node = element.querySelector('h3') || element.querySelector('h4 span');
      return node ? node.textContent.trim() : '';
    }
    function cards(selector) {
      return [...document.querySelectorAll(selector)].map((element) => ({
        title: title(element),
        href: new URL(element.getAttribute('href'), location.href).pathname,
        kind: element.classList.contains('pick') ? 'pick' : 'gcard'
      }));
    }
    return {
      statusText: document.getElementById('countline').textContent.trim(),
      sportsHidden: document.getElementById('sports').hidden,
      sports: cards('#sportsRail .gcard'),
      top: cards('#topRail .pick'),
      themes: cards('#tgrids .gcard'),
      classroom: cards('#classRail .gcard'),
      shelf: cards('#allGrid .gcard'),
      components: cards('.pick,.gcard'),
      chips: [...document.querySelectorAll('#chips .chip')].map((button) => button.textContent.trim()),
      gcardCount: document.querySelectorAll('.gcard').length,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth
    };
  });
  await page.screenshot({ path: path.join(ARTIFACTS, `arcade-${label}.png`), fullPage: true });
  await context.close();
  return { response, errors, snapshot };
}

(async () => {
  let browser;
  try {
    const proposed = candidate();
    const beforeTags = tags(baseline);
    const afterTags = tags(proposed);
    const valid = validators(proposed);

    console.log('== Manifest and source reconciliation ==');
    ok('B1-baseline-manifest-count', baseline.length === 31, String(baseline.length));
    ok('B5-tag-vocabulary-unchanged', same(Object.keys(beforeTags).sort(), Object.keys(afterTags).sort()), `${JSON.stringify(beforeTags)} -> ${JSON.stringify(afterTags)}`);
    ok('B5-physics-count-named', beforeTags.Physics === 5 && afterTags.Physics === 6, `${beforeTags.Physics} -> ${afterTags.Physics}`);
    ok('B7-all-entries-carry-art', valid.allArt);
    ok('B7-sports-membership-exact', valid.exactMembership);
    ok('B7-pool-title-and-href-unique', valid.uniquePool);
    ok('B7-hue-distinct-from-apex-kick', valid.distinctHue, `${proposed.find((g) => g.title === 'Apex Kick').hue} vs ${pool.hue}`);
    ok('B7-pool-hue-unused-before', !baseline.some((game) => game.hue.toUpperCase() === pool.hue.toUpperCase()), pool.hue);

    console.log('== Validator non-vacuity ==');
    ok('membership-negative-control', !validators(proposed.map((game) => game.title === 'Apex Pool' ? { ...game, collection: undefined } : game)).exactMembership);
    ok('art-negative-control', !validators(proposed.map((game) => game.title === 'Apex Pool' ? { ...game, art: '' } : game)).allArt);
    ok('hue-negative-control', !validators(proposed.map((game) => game.title === 'Apex Pool' ? { ...game, hue: '#2F8F6B' } : game)).distinctHue);
    ok('uniqueness-negative-control', !validators(proposed.concat({ ...pool })).uniquePool);

    browser = await chromium.launch({ headless: true });
    const before = await load(browser, baseline, 'baseline');
    const after = await load(browser, proposed, 'sports');
    const b = before.snapshot;
    const a = after.snapshot;

    console.log('== Rendered Arcade Sports gates ==');
    ok('baseline-page-responds-200', before.response && before.response.status() === 200, before.response ? String(before.response.status()) : 'no response');
    ok('candidate-page-responds-200', after.response && after.response.status() === 200, after.response ? String(after.response.status()) : 'no response');
    ok('B1-42-gcards-resolved-to-one-manifest', b.gcardCount === 42, `31 manifest entries -> ${b.gcardCount} gcard placements (31 shelf + 7 themed + 4 classroom)`);
    ok('B2-sports-renders-exactly-two-adjacent', !a.sportsHidden && same(a.sports.map((card) => card.title), ['Apex Kick', 'Apex Pool']), JSON.stringify(a.sports));
    const occurrences = (name) => a.components.filter((card) => card.title === name).length;
    ok('B3-apex-kick-renders-once', occurrences('Apex Kick') === 1, String(occurrences('Apex Kick')));
    ok('B3-apex-pool-renders-once', occurrences('Apex Pool') === 1, String(occurrences('Apex Pool')));
    ok('B4-top-rail-survivors-identical', same(b.top, a.top));
    ok('B4-themed-grids-identical', same(b.themes, a.themes));
    ok('B4-classroom-rail-identical', same(b.classroom, a.classroom));
    ok('B4-shelf-survivors-identical', same(b.shelf.filter((card) => card.title !== 'Apex Kick'), a.shelf));
    const bOther = b.components.filter((card) => card.title !== 'Apex Kick');
    const aOther = a.components.filter((card) => card.title !== 'Apex Kick' && card.title !== 'Apex Pool');
    ok('B4-all-other-rendered-components-identical', same(bOther, aOther));
    ok('B5-rendered-chip-vocabulary-identical', same(b.chips, a.chips), a.chips.join(' | '));
    ok('B7-count-self-derives-at-render', a.statusText.includes(String(proposed.length)) && a.statusText.includes(String(proposed.length - 2)), a.statusText);
    ok('sports-pair-links-are-site-relative', same(a.sports.map((card) => card.href), ['/apexkick/', '/apexpool/']));
    ok('reduced-motion-render-remains-readable', a.reduced && a.documentWidth === a.viewportWidth, `${a.documentWidth}/${a.viewportWidth}`);
    ok('zero-baseline-console-errors', before.errors.length === 0, before.errors.join(' | ') || 'none');
    ok('zero-candidate-console-errors', after.errors.length === 0, after.errors.join(' | ') || 'none');
  } catch (error) {
    fail++;
    console.error(error.stack || error);
  } finally {
    if (browser) await browser.close();
  }
  console.log('='.repeat(64));
  console.log(fail === 0 ? `ALL ${pass} ARCADE SPORTS BROWSER CHECKS PASSED` : `${pass} passed, ${fail} FAILED`);
  console.log('='.repeat(64));
  process.exit(fail ? 1 : 0);
})();
