#!/usr/bin/env node
'use strict';
// UX2 B5 — gates for the education surfaces order UX2 rebuilt, driven in the
// established CI browser against the assembled publication (the same mount
// domain-split-verify.yml serves). Everything read here is the served page or a
// committed fixture under domain-split/ux2/; nothing is typed into a gate.
//
//   reachability  every href the pre-order publication rendered on /, /for/pupils/,
//                 /for/teachers/ and /resources/ (ux2/pre-order-hrefs.json) is still
//                 rendered within two taps of /: a visible anchor on / (1 tap), a menu
//                 row (menu open = 1 tap, the row = 2), or an anchor on a page one tap
//                 away (2). A lost href must be a recorded relocation whose destination
//                 is itself within two taps, or a recorded retirement with a reason
//                 (ux2/menu-relocations.json); a recorded loss that is still reachable
//                 is a stale ledger and fails too.
//   money         0 "£", 0 ko-fi anchors, 0 mailto, 0 "donat" in the rendered text of /
//                 and every pupil route; the one allowed label is "Commission a resource".
//   third-party   0 requests off the education origin while those routes load (a link to
//                 Play is allowed; a request to it is not).
//   consent       the bar's two lines, the privacy anchor, "Allow" / "Keep off"; both
//                 choices driven: "Keep off" writes deny under the unchanged storage key
//                 and survives a reload; "Allow" is disabled while the served config says
//                 the service is inactive and the "not active" sentence is painted by the
//                 client only then — a positive control routes an enabled config and
//                 drives "Allow" to allow. The storage key and event names are read from
//                 the served usage-client.js and compared with the fixture.
//   copy          every Appendix A §HOME / §COMMISSION (and, as later parts land, §PUPILS,
//                 §TEACHERS, §RESOURCES) string renders on its route; "Learn • Build •
//                 Explore" exactly once per route; the vocabulary grep terms occur only
//                 where ux2/appendix-a-site.json lists a defect with a reason.
//   hrefs         every same-origin href on the gated routes answers 200 on the mount;
//                 off-origin hrefs are listed and must be the Play origin or an existing
//                 external destination the pre-order page already carried.
//   hero          the homepage brand mark and hero artwork decode with naturalWidth > 0.
//   tiles         the "Go straight to your subject" tiles equal the Lessons hub's own
//                 subject cards (slug for slug, in order) — the same derivation, measured.
//   sitemap       the authored sitemap.xml carries /commission/ and every overlay route.
//
// Red proofs (--red-proof): each planted mutation below is applied through page.route
// and the run must fail on the case it targets, or the gate is MEASUREMENT INVALID:
//   drop-relocated-target   strips the Lessons hub's #view-recommended control → reachability
//   inject-kofi             plants a Ko-fi anchor on /                     → money
//   inject-third-party      plants an off-origin script on /              → third-party
//   break-copy              rewrites the homepage h1                       → copy
//   strip-privacy-stats     removes the relocated /stats/ link from /privacy/ → reachability
//
// env: MBM_EDUCATION_ORIGIN (default http://127.0.0.1:4173), MBM_DISCOVERY_SITE (repo root),
//      MBM_UX2_OUTPUT (report dir). Exit 1 on any FAIL.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const siteRoot = path.resolve(process.env.MBM_DISCOVERY_SITE || path.join(__dirname, '..'));
const origin = new URL(process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173').origin;
const out = path.resolve(process.env.MBM_UX2_OUTPUT || 'audit-output/ux2-education');
const RED = process.argv.includes('--red-proof');
const PLAY = 'https://www.madebymatt-play.uk';
const fixtures = {
  appendix: JSON.parse(fs.readFileSync(path.join(__dirname, 'ux2/appendix-a-site.json'), 'utf8')),
  preOrder: JSON.parse(fs.readFileSync(path.join(__dirname, 'ux2/pre-order-hrefs.json'), 'utf8')),
  relocations: JSON.parse(fs.readFileSync(path.join(__dirname, 'ux2/menu-relocations.json'), 'utf8')),
  consent: JSON.parse(fs.readFileSync(path.join(__dirname, 'ux2/consent-contract.json'), 'utf8')),
};
// Routes whose surface this order has rebuilt so far; each later part appends its own.
const GATED = fixtures.appendix.gatedRoutes;
const PUPIL_ROUTES = GATED.filter(r => fixtures.appendix.pupilRoutes.includes(r));
const HEADER = '[data-mbm-navigation="education"]';
const MENU = HEADER + ' .mbm-unified-menu';
const PANEL = HEADER + ' .mbm-unified-panel';

fs.mkdirSync(out, { recursive: true });
const report = { schema: 1, origin, startedAt: new Date().toISOString(), redProof: RED, cases: [], pageErrors: [] };
const key = href => {
  try { const u = new URL(href, origin); return u.origin === origin ? u.pathname + u.search : u.href.replace(/#.*$/, ''); }
  catch (_) { return href; }
};
const isExternal = k => /^[a-z]+:/i.test(k) && !k.startsWith(origin);

async function check(name, run) {
  try { const detail = await run(); report.cases.push({ name, status: 'PASS', detail }); console.log('PASS ' + name); }
  catch (error) { report.cases.push({ name, status: 'FAIL', error: String(error && error.stack || error) }); console.log('FAIL ' + name + ': ' + String(error).split('\n')[0]); }
}
async function settle(page) { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(250); }
async function goto(page, route) { const r = await page.goto(origin + route, { waitUntil: 'load' }); await settle(page); return r; }
const anchorsIn = page => page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ href: a.getAttribute('href'), abs: a.href, text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80), visible: (() => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(a).visibility !== 'hidden'; })(), inMenu: !!a.closest('.mbm-unified-panel') })));
const bodyText = page => page.evaluate(() => document.body.innerText || '');

// ---------- planted mutations for the red proofs ----------
const MUTATIONS = {
  'drop-relocated-target': { target: 'reachability', route: '/Lessons/', apply: html => html.replace(/id="view-recommended"/g, 'id="view-recommended-removed"') },
  'inject-kofi': { target: 'money', route: '/', apply: html => html.replace('</footer>', '<p><a href="https://ko-fi.com/madebymattuk">Support Made by Matt</a></p></footer>') },
  'inject-third-party': { target: 'third-party', route: '/', apply: html => html.replace('</head>', '<script src="https://cdn.example.net/planted.js"></script></head>') },
  'break-copy': { target: 'copy', route: '/', apply: html => html.replace('Find your next lesson.', 'Find your next lesson') },
  'strip-privacy-stats': { target: 'reachability', route: '/privacy/', apply: html => html.replace('<a href="/stats/">Shared activity · Top 10 lessons and packs</a>', 'Shared activity') },
};
async function plant(context, mutation) {
  if (!mutation) return;
  await context.route(u => new URL(u).origin === origin && new URL(u).pathname === mutation.route, async route => {
    const response = await route.fetch(); const html = await response.text();
    const mutated = mutation.apply(html); assert.notEqual(mutated, html, 'The planted mutation must change the served page');
    await route.fulfill({ response, body: mutated, headers: { ...response.headers(), 'content-type': 'text/html; charset=utf-8' } });
  });
}

// ---------- the suite ----------
async function suite(browser, mutation) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await plant(context, mutation);
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', e => report.pageErrors.push({ url: page.url(), error: String(e) }));
  const requests = []; page.on('request', r => requests.push(r.url()));
  const rendered = {}; // route → anchors (closed), menu rows

  await check('reachability', async () => {
    // Depth 0: the homepage. One tap = a visible anchor on / or opening the menu.
    await goto(page, '/');
    const home = await anchorsIn(page);
    await page.locator(MENU + ' > summary').click(); await page.waitForTimeout(200);
    const menuRows = await page.locator(PANEL + ' a[href]').evaluateAll(nodes => nodes.map(a => a.href));
    await page.keyboard.press('Escape');
    const oneTap = new Set(home.filter(a => a.visible && !a.inMenu).map(a => key(a.abs)));
    const twoTap = new Set([...oneTap, ...menuRows.map(key)]);
    const pages = [...oneTap].filter(k => k.startsWith('/') && !/\.(pdf|pptx|docx|json|xml|zip)(\?|$)/i.test(k));
    const expanded = {};
    for (const route of pages) {
      const r = await page.goto(origin + route, { waitUntil: 'load' }).catch(() => null);
      if (!r || !/text\/html/.test(r.headers()['content-type'] || '')) continue;
      await settle(page);
      const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => a.href));
      expanded[route] = links.length; links.forEach(h => twoTap.add(key(h)));
    }
    rendered.twoTap = twoTap;
    const relocated = fixtures.relocations.relocated, retired = fixtures.relocations.retired;
    const problems = [], stale = [];
    const seen = new Set();
    for (const [route, hrefs] of Object.entries(fixtures.preOrder.routes)) for (const href of hrefs) {
      if (seen.has(href)) continue; seen.add(href);
      const k = key(href);
      if (twoTap.has(k)) { if (relocated[href] || retired[href]) stale.push(href); continue; }
      if (retired[href]) continue;
      const entry = relocated[href];
      if (!entry) { problems.push(`${href} (on ${route}) is no longer within two taps of / and is not a recorded relocation or retirement`); continue; }
      const dest = key(entry.to);
      if (!twoTap.has(dest)) { problems.push(`${href} → ${entry.to}: the recorded destination is not within two taps of /`); continue; }
      if (entry.selector) {
        const destRoute = new URL(entry.to, origin);
        await page.goto(destRoute.href, { waitUntil: 'load' }); await settle(page);
        const count = await page.locator(entry.selector).count();
        if (!count) problems.push(`${href} → ${entry.to} ${entry.selector}: the recorded control is not on that page`);
      }
    }
    assert.deepEqual(problems, [], 'Pre-order hrefs lost within two taps of /');
    assert.deepEqual(stale, [], 'Recorded relocations/retirements that are in fact still reachable (stale ledger)');
    return { oneTap: oneTap.size, twoTap: twoTap.size, expandedPages: Object.keys(expanded).length, preOrder: seen.size };
  });

  for (const route of GATED) {
    await check(`copy ${route}`, async () => {
      await goto(page, route);
      const text = await bodyText(page);
      const norm = s => s.replace(/\s+/g, ' ');
      const text1 = norm(text);
      const set = fixtures.appendix.routeStrings[route] || [];
      const missing = set.filter(s => !text1.includes(norm(s)));
      assert.deepEqual(missing, [], 'Appendix A strings missing on ' + route);
      const lbe = (text.match(/Learn • Build • Explore/g) || []).length;
      assert.equal(lbe, 1, '"Learn • Build • Explore" exactly once on ' + route);
      // vocabulary grep: each occurrence is the surviving name or a listed defect
      const defects = (fixtures.appendix.vocabularyDefects.routes[route] || {});
      const counts = Object.fromEntries(fixtures.appendix.vocabularyDefects.terms.map(t => [t, text.split(t).length - 1]));
      const unlisted = Object.entries(counts).filter(([t, n]) => n !== (defects[t] ? defects[t].count : 0)).map(([t, n]) => `${t}: ${n} (listed ${defects[t] ? defects[t].count : 0})`);
      assert.deepEqual(unlisted, [], 'Vocabulary occurrences on ' + route + ' differ from the listed defects');
      // menu strings on every gated route
      await page.locator(MENU + ' > summary').click(); await page.waitForTimeout(150);
      const panelText = norm(await page.locator(PANEL).innerText());
      const menuMissing = fixtures.appendix.menu.filter(s => !panelText.includes(s) && !(PUPIL_ROUTES.includes(route) && fixtures.appendix.menuAdultOnly.includes(s)));
      await page.keyboard.press('Escape');
      assert.deepEqual(menuMissing, [], 'Appendix A §MENU strings missing on ' + route);
      return { strings: set.length, vocabulary: counts };
    });
    await check(`hrefs ${route}`, async () => {
      await goto(page, route);
      const anchors = await anchorsIn(page);
      const same = [...new Set(anchors.filter(a => new URL(a.abs).origin === origin).map(a => a.abs.replace(/#.*$/, '')))];
      const failed = [];
      for (const u of same) { const r = await page.request.get(u); if (!r.ok()) failed.push(u + ' → ' + r.status()); }
      assert.deepEqual(failed, [], 'Same-origin hrefs that do not resolve on ' + route);
      const external = [...new Set(anchors.filter(a => new URL(a.abs).origin !== origin).map(a => a.abs))];
      const preOrderExternal = new Set(Object.values(fixtures.preOrder.routes).flat().filter(isExternal));
      const unexpected = external.filter(u => !u.startsWith(PLAY + '/') && !u.startsWith('mailto:') && !preOrderExternal.has(u.replace(/#.*$/, '')));
      assert.deepEqual(unexpected, [], 'Off-origin hrefs that are neither Play nor a pre-order external destination on ' + route);
      return { sameOrigin: same.length, external };
    });
  }

  for (const route of ['/', ...PUPIL_ROUTES.filter(r => r !== '/')]) {
    await check(`money ${route}`, async () => {
      await goto(page, route);
      const text = await bodyText(page);
      const money = { pound: (text.match(/£/g) || []).length, kofi: await page.locator('a[href*="ko-fi" i]').count(), mailto: await page.locator('a[href^="mailto:"]').count(), donate: (text.match(/donat/gi) || []).length };
      assert.deepEqual(money, { pound: 0, kofi: 0, mailto: 0, donate: 0 }, 'Money on ' + route);
      const commission = await page.locator('a[href="/commission/"]').evaluateAll(n => n.map(a => a.textContent.trim()));
      assert.deepEqual([...new Set(commission)].filter(Boolean), route === '/' ? ['Commission a resource'] : [], 'The only commission label is "Commission a resource"');
      return money;
    });
    await check(`third-party ${route}`, async () => {
      const start = requests.length; await goto(page, route);
      await page.locator(MENU + ' > summary').click(); await page.waitForTimeout(300); await page.keyboard.press('Escape');
      const off = [...new Set(requests.slice(start).filter(u => !u.startsWith(origin + '/') && !u.startsWith('data:')))];
      assert.deepEqual(off, [], 'Requests off the education origin on ' + route);
      return { requests: requests.length - start };
    });
  }

  await check('consent /', async () => {
    const source = await (await page.request.get(origin + '/assets/usage-client.js')).text();
    const keyMatch = source.match(/KEY = '([^']+)'/); assert(keyMatch, 'usage-client.js names its storage key');
    assert.equal(keyMatch[1], fixtures.consent.storageKey, 'Storage key unchanged');
    for (const ev of fixtures.consent.events) assert(source.includes(ev + ':'), 'Event name present in usage-client.js: ' + ev);
    assert(source.includes("'" + fixtures.consent.endpoint + "'") || source.includes(fixtures.consent.endpoint), 'Ingest endpoint name unchanged');
    const raw = await (await page.request.get(origin + '/')).text();
    assert.match(raw, /<p data-usage-choice-status role="status"><\/p>/, 'The status line is empty in the static page; only the client paints it');
    const config = await (await page.request.get(origin + '/data/usage-config.json')).json();
    await context.clearCookies(); await goto(page, '/');
    await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'load' }); await settle(page);
    const bar = page.locator('#usage-statistics');
    const lines = await bar.locator('.usage-bar-line').evaluateAll(n => n.map(p => p.textContent.trim()));
    assert.deepEqual(lines, ['Optional usage statistics — off until you allow it.', 'Read what is counted.'], 'Consent bar lines');
    assert.equal(await bar.locator('a').getAttribute('href'), fixtures.consent.privacyAnchor, 'Privacy anchor unchanged');
    const allow = bar.getByRole('button', { name: 'Allow', exact: true }), deny = bar.getByRole('button', { name: 'Keep off', exact: true });
    for (const b of [bar.locator('a'), allow, deny]) { const box = await b.boundingBox(); assert(box && box.width >= 44 && box.height >= 44, 'Consent control is 44px'); }
    await page.waitForFunction(() => (document.querySelector('[data-usage-choice-status]') || {}).textContent);
    const status = await bar.locator('[data-usage-choice-status]').innerText();
    if (!config.enabled) { assert.match(status, /not active/, 'Inactive service → the not-active sentence'); assert(await allow.isDisabled(), 'Allow disabled while inactive'); }
    else assert.doesNotMatch(status, /not active/, 'Active service → no not-active sentence');
    await deny.click();
    assert.equal(await page.evaluate(k => localStorage.getItem(k), fixtures.consent.storageKey), 'deny', 'Keep off writes deny');
    assert.equal(await deny.getAttribute('aria-pressed'), 'true');
    await page.reload({ waitUntil: 'load' }); await settle(page);
    assert.equal(await page.locator('[data-usage-choice="deny"]').getAttribute('aria-pressed'), 'true', 'Refusal persists');
    // Positive control: an enabled config makes Allow live and Allow writes allow.
    const enabled = { ...config, enabled: true, allowed_origins: [...(config.allowed_origins || []), origin] };
    await page.route(origin + '/data/usage-config.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(enabled) }));
    await page.reload({ waitUntil: 'load' }); await settle(page);
    await page.waitForFunction(() => !document.querySelector('[data-usage-choice="allow"]').disabled);
    const liveStatus = await page.locator('[data-usage-choice-status]').innerText();
    assert.doesNotMatch(liveStatus, /not active/, 'With an enabled config the not-active sentence is not painted');
    await page.locator('[data-usage-choice="allow"]').click();
    assert.equal(await page.evaluate(k => localStorage.getItem(k), fixtures.consent.storageKey), 'allow', 'Allow writes allow');
    await page.unroute(origin + '/data/usage-config.json');
    await page.evaluate(k => localStorage.removeItem(k), fixtures.consent.storageKey);
    return { serviceEnabled: !!config.enabled, status, liveStatus };
  });

  await check('hero /', async () => {
    await goto(page, '/');
    const images = await page.locator(HEADER + ' img, .hero-art img').evaluateAll(n => n.map(i => ({ src: (i.getAttribute('src') || '').slice(0, 40), w: i.naturalWidth, h: i.naturalHeight, complete: i.complete })));
    assert(images.length >= 2, 'Brand mark and hero artwork present');
    for (const i of images) assert(i.complete && i.w > 0 && i.h > 0, 'Image decodes: ' + JSON.stringify(i));
    return images;
  });

  await check('tiles equal the Lessons hub cards', async () => {
    await goto(page, '/');
    const tiles = await page.locator('[data-subject-tiles] a').evaluateAll(n => n.map(a => new URL(a.href).searchParams.get('subject')));
    await goto(page, '/Lessons/');
    await page.waitForFunction(() => document.querySelectorAll('.scard[data-card]').length > 0);
    const cards = await page.locator('.scard[data-card]').evaluateAll(n => n.map(c => c.dataset.card));
    assert.deepEqual(tiles, cards, 'Homepage subject tiles are the hub cards, slug for slug, in order');
    return { tiles };
  });

  await check('added this half-term is the hub rail', async () => {
    await goto(page, '/');
    const home = await page.evaluate(() => ({ hidden: document.getElementById('added').hidden, heading: document.getElementById('added-h').textContent, rows: [...document.querySelectorAll('#added-rail .acard')].map(a => a.dataset.resourcePath) }));
    await goto(page, '/Lessons/');
    await page.waitForFunction(() => document.querySelectorAll('.scard[data-card]').length > 0);
    const hub = await page.evaluate(() => ({ hidden: document.getElementById('added').hidden, heading: document.getElementById('added-h').textContent, rows: [...document.querySelectorAll('#added-rail .acard')].map(a => a.dataset.resourcePath) }));
    assert.deepEqual(home, hub, 'The homepage rail equals the hub rail (heading, rows, hidden state)');
    return home;
  });

  await check('sitemap carries the overlay routes', async () => {
    // The estate's authored sitemaps are the ones robots.txt names (sitemap.xml and
    // audience-sitemap.xml); the union is what a crawler is told about.
    const robots = fs.readFileSync(path.join(siteRoot, 'robots.txt'), 'utf8');
    const files = [...robots.matchAll(/^Sitemap:\s*(\S+)/gm)].map(m => new URL(m[1]).pathname.replace(/^\//, ''));
    assert(files.length >= 1, 'robots.txt names at least one sitemap');
    const locs = files.flatMap(f => [...fs.readFileSync(path.join(siteRoot, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname));
    const missing = fixtures.appendix.overlayRoutes.filter(r => !locs.includes(r));
    assert.deepEqual(missing, [], 'Overlay routes missing from the authored sitemap');
    return { sitemaps: files, locs: locs.length };
  });

  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    if (!RED) {
      await suite(browser, null);
    } else {
      // Each planted mutation must turn its target case red; nothing else is asserted.
      const outcomes = [];
      for (const [name, mutation] of Object.entries(MUTATIONS)) {
        report.cases.length = 0;
        await suite(browser, mutation);
        const targeted = report.cases.filter(c => c.name.startsWith(mutation.target) && c.status === 'FAIL');
        outcomes.push({ mutation: name, target: mutation.target, red: targeted.length > 0, failedCases: report.cases.filter(c => c.status === 'FAIL').map(c => c.name) });
        console.log((targeted.length ? 'RED  ' : 'GREEN(invalid) ') + name + ' → ' + mutation.target);
      }
      report.redProofs = outcomes;
      report.cases.length = 0;
      for (const o of outcomes) report.cases.push({ name: 'red-proof ' + o.mutation, status: o.red ? 'PASS' : 'FAIL' });
    }
  } catch (error) { report.fatal = String(error && error.stack || error); console.error(error); }
  await browser.close();
  const failed = report.cases.filter(c => c.status === 'FAIL').length;
  report.finishedAt = new Date().toISOString(); report.result = failed || report.fatal ? 'FAIL' : 'PASS';
  fs.writeFileSync(path.join(out, 'ux2-education.json'), JSON.stringify(report, null, 1));
  console.log(`${report.result}: ${report.cases.length - failed} passed, ${failed} failed; ${path.join(out, 'ux2-education.json')}`);
  process.exitCode = failed || report.fatal ? 1 : 0;
})();
