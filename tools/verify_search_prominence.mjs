/* Search exists on these pages. This gate is about whether anyone can FIND it,
 * and — on the pupil page — whether what it can reach is still inside the fence.
 *
 * MEASURED, NOT INFERRED. Every one of the seven audience homepages already
 * loaded assets/mbm-search.js and not one of them rendered a search control:
 * the script binds `form[data-mbm-search="suggest"]` and nothing on those pages
 * carried it. A source grep for the script would have called all seven covered.
 * So position, size and occlusion are read from a real 390px layout, and the
 * network assertions are made by counting actual requests.
 *
 * THE SURFACE LIST IS DERIVED from data/audience-homepages.json, not written
 * down here: a hand-list is how a page quietly leaves the set it is supposed to
 * be in, and this estate has that failure on the record four times.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = JSON.parse(readFileSync(join(ROOT, 'data/audience-homepages.json'), 'utf8'));
const ROUTES = Object.values(DATA.audiences).map(a => a.route);
const PUPIL = Object.values(DATA.audiences).find(a => !a.adultFeatures).route;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2' };
const SHELF = existsSync(join(ROOT, '_shelf/games.json'))
  ? join(ROOT, '_shelf/games.json') : join(ROOT, 'data/source-manifests/games.json');
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/Games/games.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(readFileSync(SHELF)); return; }
  if (p.endsWith('/')) p += 'index.html';
  const f = join(ROOT, p);
  try {
    if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404).end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  } catch (e) { res.writeHead(500).end(String(e)); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const rows = [];
const check = (ok, what, detail = '') => {
  rows.push(ok);
  console.log(`  ${ok ? '[ ok ]' : '[FAIL]'} ${what}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch();
try {
  console.log(`=== A VISIBLE ENTRY POINT, ON EVERY DERIVED SURFACE, AT 390px ===\n`);
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const indexHits = [];
    page.on('request', r => { if (/mbm-search-index\.json/.test(r.url())) indexHits.push(r.url()); });
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });

    const m = await page.evaluate(() => {
      const el = document.querySelector('[data-mbm-search="suggest"] input[name="q"], [data-mbm-pupil-search]');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const label = el.labels && el.labels[0] ? el.labels[0].textContent.trim() : (el.getAttribute('aria-label') || '');
      /* Occlusion, measured the way a finger finds out: what is actually on
         top at the control's own centre point? */
      const mid = document.elementFromPoint(Math.min(r.left + r.width / 2, innerWidth - 1),
                                            Math.min(r.top + r.height / 2, innerHeight - 1));
      return { top: r.top, bottom: r.bottom, w: r.width, h: r.height,
               vis: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0,
               label, onTop: !!mid && (mid === el || el.contains(mid) || mid.contains(el)),
               fixed: cs.position === 'fixed' || cs.position === 'sticky',
               inputs: document.querySelectorAll('input').length,
               forms: document.querySelectorAll('form').length };
    });

    check(!!m, `${route}: has a visible search entry point`);
    if (!m) { await page.close(); continue; }
    check(m.vis && m.bottom <= 844, `${route}: the whole control is above the fold at 390px`,
      `top ${Math.round(m.top)}, bottom ${Math.round(m.bottom)} of 844`);
    check(m.onTop, `${route}: nothing occludes it where a finger lands`);
    check(m.h >= 44, `${route}: at least 44px tall as rendered`, `${Math.round(m.w)}x${Math.round(m.h)}`);
    check(!!m.label, `${route}: has an accessible name`, JSON.stringify(m.label));

    /* Read the boot count BEFORE this gate focuses anything. Focusing is what
       triggers the lazy load, so asserting afterwards measures the test's own
       keystroke and reports every page as eagerly fetching. It did exactly
       that on the first run. */
    const bootFetches = indexHits.length;

    const focused = await page.evaluate(() => {
      const el = document.querySelector('[data-mbm-search="suggest"] input[name="q"], [data-mbm-pupil-search]');
      el.focus();
      const cs = getComputedStyle(el, ':focus-visible');
      return { isActive: document.activeElement === el, outline: cs.outlineStyle };
    });
    check(focused.isActive, `${route}: reachable and focusable by keyboard`);

    /* §2.2 SEARCH_EAGER=no — nothing may be fetched merely because the entry
       point is on the page. Measured at load, then again after a real focus. */
    check(bootFetches === 0, `${route}: no index fetch at page boot`, indexHits.join(', '));
    await page.close();
  }

  console.log(`\n=== THE INDEX LOADS ONLY ON DELIBERATE INTERACTION ===\n`);
  {
    const adult = ROUTES.find(r => r !== PUPIL);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const hits = [];
    page.on('request', r => { if (/mbm-search-index\.json/.test(r.url())) hits.push(r.url()); });
    await page.goto(BASE + adult, { waitUntil: 'networkidle' });
    const atBoot = hits.length;
    await page.focus('[data-mbm-search="suggest"] input[name="q"]');
    await page.waitForTimeout(1200);
    check(atBoot === 0 && hits.length > 0,
      `${adult}: index fetched on first focus, not at boot`,
      `boot ${atBoot}, after focus ${hits.length}`);
    const size = statSync(join(ROOT, 'data/mbm-search-index.json')).size;
    console.log(`         avoided at boot: ${size.toLocaleString()} bytes per page, on ${ROUTES.length} surfaces`);
    await page.close();
  }

  console.log(`\n=== THE PUPIL FENCE ===\n`);
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const requests = [];
    page.on('request', r => requests.push(r.url()));
    await page.goto(BASE + PUPIL, { waitUntil: 'networkidle' });
    const before = requests.length;

    const shape = await page.evaluate(() => ({
      inputs: document.querySelectorAll('input').length,
      pupilInputs: document.querySelectorAll('[data-mbm-pupil-search]').length,
      forms: document.querySelectorAll('form').length,
    }));
    check(shape.inputs === 1, `${PUPIL}: exactly ONE input on the page`, String(shape.inputs));
    check(shape.pupilInputs === 1, `${PUPIL}: and it is the game-search field`);
    check(shape.forms === 0, `${PUPIL}: no <form>, so no submit path off the page`, String(shape.forms));

    /* type, and count what that cost the network */
    await page.focus('[data-mbm-pupil-search]');
    await page.type('[data-mbm-pupil-search]', 'apex curl', { delay: 20 });
    await page.waitForTimeout(700);
    /* Precisely what §2.3(a) means: the SEARCH fetches nothing. The requests
       that do appear are the page's own card images, declared loading="lazy"
       in the markup and fetched by the browser when a hidden card becomes
       visible — exactly what scrolling would have done. Counting those as a
       violation would be counting the browser's image loading, not the search;
       counting nothing at all would be the weaker claim. So: no data fetch, no
       endpoint, and — the assertion that actually matters — no request
       anywhere carries the query. */
    const nu = requests.slice(before);
    const nonImage = nu.filter(u => !/\.(svg|webp|png|jpe?g|avif|gif)(\?|$)/i.test(u));
    check(nonImage.length === 0,
      `${PUPIL}: typing fetches no data — only the page's own lazy card images`,
      nonImage.slice(0, 3).join(', ') || `${nu.length} card image(s), 0 data requests`);
    const leaked = nu.filter(u => /apex|curl/i.test(u.split('/assets/cards/')[1] ? '' : u));
    check(leaked.length === 0, `${PUPIL}: no request carries the query`, leaked.slice(0, 2).join(', '));

    const stored = await page.evaluate(() => {
      let ls = 0, ss = 0;
      try { ls = Object.keys(localStorage).filter(k => /apex|curl|query|search/i.test(k + localStorage[k])).length; } catch (e) {}
      try { ss = Object.keys(sessionStorage).length; } catch (e) {}
      return { ls, ss, cookie: document.cookie, hash: location.hash, search: location.search,
               keys: (() => { try { return Object.keys(localStorage); } catch (e) { return []; } })() };
    });
    check(stored.ls === 0 && stored.ss === 0 && !stored.cookie && !stored.search && !stored.hash,
      `${PUPIL}: the query is not persisted anywhere`,
      `ls ${stored.ls}, ss ${stored.ss}, cookie "${stored.cookie}", qs "${stored.search}"`);
    console.log(`         pre-existing storage keys this page touches: ${stored.keys.join(', ') || '(none yet)'}`);

    /* §5.10 — both new games must be findable HERE, because this search reads
       the rendered set and not the index. */
    for (const name of ['Apex Curl', 'Apex Velodrome']) {
      await page.fill('[data-mbm-pupil-search]', '');
      await page.type('[data-mbm-pupil-search]', name, { delay: 10 });
      await page.waitForTimeout(400);
      const found = await page.evaluate(t => {
        const shown = [...document.querySelectorAll('.mf-pupil-game')].filter(c => !c.hidden);
        const hit = shown.find(c => (c.querySelector('h3') || {}).textContent.trim() === t);
        return { shown: shown.length, hit: !!hit, href: hit ? hit.querySelector('a[href]').getAttribute('href') : null };
      }, name);
      check(found.hit, `${PUPIL}: search finds "${name}"`, `${found.shown} shown, route ${found.href}`);
    }

    /* Every reachable result must be a game route — never /teach/, /account/,
       /members/, /mailing-list/, /privacy/, a mailto: or an off-origin URL. */
    await page.fill('[data-mbm-pupil-search]', '');
    await page.waitForTimeout(200);
    const dests = await page.evaluate(() =>
      [...document.querySelectorAll('.mf-pupil-game a[href]')].map(a => a.getAttribute('href')));
    const forbidden = dests.filter(h =>
      /^(mailto:|https?:)/.test(h) || /^\/(teach|for|account|members|mailing-list|privacy|resources|tools)\//.test(h));
    check(forbidden.length === 0, `${PUPIL}: every reachable result is a game route`,
      forbidden.slice(0, 3).join(', '));
    const shelf = new Set(JSON.parse(readFileSync(SHELF, 'utf8')).games.map(g => g.href));
    const unknown = [...new Set(dests)].filter(h => !shelf.has(h));
    check(unknown.length === 0, `${PUPIL}: and every one resolves to a game on the shelf`,
      unknown.slice(0, 3).join(', '));

    /* §C5.2 — safeForPupils made LOAD-BEARING.
       The field is written on all 717 index entries and, until this assertion,
       was read by nothing that ships and nothing that gates. A safety-shaped
       field that nothing consumes is worse than no field: it invites the next
       reader to assume a filter is being enforced somewhere. The route check
       above is the real boundary today; this makes the FLAG agree with it, so
       the two can no longer disagree silently. Either surface drifting is now
       a failure — a route the pupil page can reach whose index entry says it is
       not pupil-safe, or a flag flipped without the page changing. */
    const idx = JSON.parse(readFileSync(join(ROOT, 'data/mbm-search-index.json'), 'utf8')).entries;
    const byRoute = new Map(idx.map(e => [e.route, e]));
    const notSafe = [...new Set(dests)].filter(h => {
      const e = byRoute.get(h);
      return e && e.safeForPupils !== true;
    });
    check(notSafe.length === 0,
      `${PUPIL}: and every one is marked safeForPupils:true in the index`,
      notSafe.slice(0, 3).join(', '));
    const unindexed = [...new Set(dests)].filter(h => !byRoute.has(h));
    check(unindexed.length === 0,
      `${PUPIL}: and every one has an index entry to carry that flag`,
      unindexed.slice(0, 3).join(', '));

    /* the calm empty state */
    await page.type('[data-mbm-pupil-search]', 'zzzzqqq', { delay: 10 });
    await page.waitForTimeout(400);
    const empty = await page.evaluate(() => ({
      msg: (document.querySelector('[data-mbm-pupil-search-status]') || {}).textContent || '',
      shown: [...document.querySelectorAll('.mf-pupil-game')].filter(c => !c.hidden).length,
    }));
    check(empty.shown === 0 && /try another word/i.test(empty.msg) && !/invalid|error|no results found/i.test(empty.msg),
      `${PUPIL}: the empty state is calm and suggests a next step`, JSON.stringify(empty.msg));
    await page.close();
  }

  console.log(`\n=== LESSON SLIDESHOWS ARE OUT OF SCOPE AND UNTOUCHED ===\n`);
  check(!readFileSync(join(ROOT, 'tools/render_audience_homepages.py'), 'utf8').includes('slide'),
    'the renderer touches no lesson slideshow');
} finally { await browser.close(); server.close(); }

const bad = rows.filter(r => !r).length;
console.log(`\nsearch prominence: ${rows.length - bad}/${rows.length} passed`);
if (bad) { console.error(`${bad} FAILED`); process.exit(1); }
