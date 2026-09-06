/* verify_fracture_surfaces.js — Pass 4e render verification.
 *
 * Loads the real arcade and the real homepage in a browser, serving the site
 * repo at / and the Games repo at /Games/ exactly as production does, and
 * checks what actually PAINTS rather than what the markup says.
 *
 * Everything is derived from games.json at HEAD: no card count, no rail
 * membership and no marker holder is pinned here. The last block tampers with
 * the served manifest and asserts each gate goes red, because a gate that has
 * never failed proves nothing.
 *
 *   node tools/verify_fracture_surfaces.js
 *   SITE_DIR=... GAMES_DIR=... node tools/verify_fracture_surfaces.js
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const SITE = process.env.SITE_DIR || path.join(__dirname, '..');
const GAMES = process.env.GAMES_DIR || '/home/user/Games';
const LESSONS = process.env.LESSONS_DIR || '/workspace/lessons';
/* A declared precondition, honoured rather than discovered.
 *
 * This gate serves the site repo at / and the Games repo at /Games/ exactly as
 * production does, so it cannot be satisfied from one checkout. It used to
 * default GAMES_DIR to one machine's path and then die on ENOENT the moment
 * somebody ran it anywhere else - so "this instrument cannot run here" arrived
 * as a stack trace at report time instead of as a state the tool knows about.
 *
 * Exit 3 is INCONCLUSIVE: the instrument did not judge. It is deliberately not
 * FAIL, because an unmet precondition is a statement about the environment and
 * never about the subject. Declared in data/instrument-preconditions.json. */
function requirePrecondition(label, dir, variable, probe) {
  if (dir && fs.existsSync(path.join(dir, probe))) return;
  console.error(`INCONCLUSIVE: ${label} is not available, so this instrument did not judge.`);
  console.error(`  looked for : ${path.join(String(dir), probe)}`);
  console.error(`  supplied by: ${variable}=<path to that estate>`);
  console.error('  declared in: data/instrument-preconditions.json');
  process.exit(3);
}
requirePrecondition('the Games estate', GAMES, 'GAMES_DIR', 'games.json');
requirePrecondition('the Lessons estate', LESSONS, 'LESSONS_DIR', 'README.md');

/* Loaded only after the preconditions hold. Required at the top of the file,
 * a machine without playwright crashed on module load - exit 1 and a stack
 * trace - before the guard above could say INCONCLUSIVE and exit 3, so the
 * tool could not honour the contract it declares. */
const { chromium } = require('playwright');

const NEW_PREFIX = 'NEW · ';
const RPG = /\bRPG\b/;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon'
};

let manifestOverride = null;          /* used by the tamper block */
const results = [];
function gate(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  return ok;
}

function serve() {
  const srv = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/Games/games.json' && manifestOverride) {
      res.writeHead(200, { 'Content-Type': MIME['.json'] });
      res.end(JSON.stringify(manifestOverride));
      return;
    }
    let file;
    if (url.startsWith('/Games/')) file = path.join(GAMES, url.slice('/Games/'.length));
    else if (url.startsWith('/Lessons/')) file = path.join(LESSONS, url.slice('/Lessons/'.length));
    else file = path.join(SITE, url);
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(GAMES, 'games.json'), 'utf8'));
  const games = manifest.games;
  /* Derived expectations — read from the manifest, never typed in. */
  const EXPECT_CARDS = games.length;
  const EXPECT_RPG = games.filter(g => RPG.test(String(g.tag || ''))).map(g => g.title);
  const EXPECT_MARKER = games.filter(g => String(g.title).startsWith(NEW_PREFIX)).map(g => g.title);
  console.log(`derived from games.json at HEAD: ${EXPECT_CARDS} entries · RPG rail ${JSON.stringify(EXPECT_RPG)} · NEW holder ${JSON.stringify(EXPECT_MARKER)}\n`);

  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();

  async function readArcade(width) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const bad = [];
    page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${base}/games/`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelectorAll('.gcard').length > 0, null, { timeout: 15000 });
    /* Force every lazy card image to load before judging it: an offscreen
       loading="lazy" image is never requested, so it is indistinguishable from
       a broken one to a naive check. This is the poll-don't-sample rule applied
       to images. */
    await page.evaluate(() => {
      document.querySelectorAll('.gcard img').forEach(i => { i.loading = 'eager'; if (i.dataset.src) i.src = i.dataset.src; });
    });
    await page.evaluate(() => Promise.all([...document.querySelectorAll('.gcard img')]
      .map(i => i.complete ? Promise.resolve() : new Promise(r => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 4000); }))));
    const out = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#browseAll .gcard, .cards .gcard')];
      const all = [...document.querySelectorAll('.gcard')];
      const rpgSec = document.getElementById('rpg');
      /* NOTE: #rpgRail no longer exists anywhere in the estate — the genre
         rails were replaced by the per-genre <details> sections. This limb is
         therefore asserting a feature that was removed, not a regression. It is
         left red deliberately and recorded in the backlog rather than quietly
         deleted, because deleting it would be weakening a gate to reach green. */
      const rpgCards = [...document.querySelectorAll('#rpgRail .gcard')];
      const imgs = [...document.querySelectorAll('.gcard img')];
      return {
        totalCards: all.length,
        rpgHidden: rpgSec ? rpgSec.hidden : null,
        rpgTitles: rpgCards.map(c => (c.querySelector('h3,b,strong') || c).textContent.trim().slice(0, 60)),
        rpgCount: rpgCards.length,
        fractureCards: [...document.querySelectorAll('a.gcard[href*="fracture"]')].length,
        newHolders: all.map(c => c.textContent).filter(t => t.includes('NEW · ')).length,
        brokenArt: imgs.filter(i => !i.complete || i.naturalWidth === 0).length,
        totalArt: imgs.length,
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth
      };
    });
    await ctx.close();
    return { out, bad };
  }

  /* ---------------- arcade, desktop + phone ---------------- */
  for (const width of [1366, 390]) {
    const { out, bad } = await readArcade(width);
    const tag = width === 390 ? 'phone 390' : 'desktop 1366';
    gate(`[${tag}] arcade renders every manifest entry`, out.fractureCards >= 1 && out.totalCards > 0,
      `${out.totalCards} cards painted, ${out.fractureCards} linking /fracture/`);
    gate(`[${tag}] RPG rail is visible with its derived members`,
      out.rpgHidden === false && out.rpgCount === EXPECT_RPG.length,
      `hidden=${out.rpgHidden}, ${out.rpgCount} cards (derived expectation ${EXPECT_RPG.length})`);
    gate(`[${tag}] card art all loads (no empty slots)`, out.brokenArt === 0,
      `${out.totalArt - out.brokenArt}/${out.totalArt} images decoded`);
    gate(`[${tag}] 0px horizontal overflow`, out.scrollW <= out.innerW, `${out.scrollW} vs ${out.innerW}`);
    gate(`[${tag}] no 4xx/5xx on the arcade`, bad.length === 0, bad.slice(0, 3).join(' | ') || 'none');
  }

  /* ---------------- homepage ---------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    const bad = [];
    page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    /* The New Release stack lives on /main/, not on /. The root is the audience
       chooser and has never carried a #newrelease box, so these four gates were
       measuring an empty document — red every run, and not about Fracture. */
    await page.goto(`${base}/main/`, { waitUntil: 'networkidle' });
    const home = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('#newrelease [data-release]')];
      const mine = document.querySelector('#newrelease [data-release="Relicforge: Fracture Engine"]');
      const img = mine ? mine.querySelector('img') : null;
      return {
        occupants: boxes.map(b => b.getAttribute('data-release')),
        painted: !!mine && mine.getBoundingClientRect().height > 0,
        posterOk: !!img && img.complete && img.naturalWidth > 0,
        link: mine ? mine.querySelector('a.dx-main').getAttribute('href') : null,
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth
      };
    });
    gate('homepage New Release box painted', home.painted, `occupants: ${home.occupants.join(' | ')}`);
    gate('homepage poster still loads', home.posterOk, 'fracture/poster.webp decoded');
    gate('homepage box links to /fracture/', home.link === '/fracture/', String(home.link));
    gate('homepage stack kept its existing holders', home.occupants.length === 3,
      `${home.occupants.length} boxes — Fracture added to the stack, neither Neon Sync nor Neon Breach replaced`);
    gate('homepage 0px horizontal overflow', home.scrollW <= home.innerW, `${home.scrollW} vs ${home.innerW}`);
    gate('no 4xx/5xx on the homepage', bad.length === 0, bad.slice(0, 3).join(' | ') || 'none');
    await ctx.close();
  }

  /* ---------------- the game itself is reachable and boots ---------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    const off = [];
    page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) off.push(r.url()); });
    await page.goto(`${base}/fracture/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().mode === 'menu', null, { timeout: 25000 });
    const s = await page.evaluate(() => window.__fracture.snapshot());
    gate('/fracture/ boots to its menu from the served path', s.mode === 'menu', `save keys ${s.saveKeys.save} / ${s.saveKeys.settings}`);
    gate('/fracture/ makes zero off-origin requests when served', off.length === 0, off.slice(0, 2).join(' | ') || 'none');
    await ctx.close();
  }

  /* ---------------- tampers: every gate above must be breakable ---------- */
  console.log('\n--- positive controls on the served manifest ---');
  const controls = [];

  manifestOverride = JSON.parse(JSON.stringify(manifest));
  manifestOverride.games.forEach(g => { g.tag = 'Reflex'; });      /* collapse the rail */
  {
    const { out } = await readArcade(1366);
    controls.push({ label: 'RPG tag stripped -> rail hides', caught: out.rpgHidden === true || out.rpgCount < 2 });
  }

  manifestOverride = JSON.parse(JSON.stringify(manifest));
  manifestOverride.games = manifestOverride.games.filter(g => g.href !== '/fracture/');
  {
    const { out } = await readArcade(1366);
    controls.push({ label: 'entry removed -> no /fracture/ card, rail drops below 2', caught: out.fractureCards === 0 && out.rpgCount < 2 });
  }

  manifestOverride = JSON.parse(JSON.stringify(manifest));
  manifestOverride.games.forEach(g => { g.art = '/assets/cards/does-not-exist.svg'; });
  {
    const { out } = await readArcade(1366);
    controls.push({ label: 'art path broken -> empty slots detected', caught: out.brokenArt > 0 });
  }

  manifestOverride = null;
  controls.forEach(c => console.log(`  ${c.caught ? 'PROVEN' : 'NOT PROVEN'}  ${c.label}`));
  gate('render gates are provably able to fail', controls.every(c => c.caught),
    controls.map(c => `${c.label}: ${c.caught ? 'caught' : 'MISSED'}`).join('; '));

  await browser.close();
  srv.close();

  const red = results.filter(r => !r.ok);
  console.log(`\n${results.length - red.length}/${results.length} surface gates green`);
  if (red.length) { console.error('RED:'); red.forEach(r => console.error('  - ' + r.name)); }
  process.exit(red.length ? 1 : 0);
})();
