/**
 * SW2 T4 — computed-style token census, in a real browser.
 *
 * Asserts that every stamped page type RESOLVES the same design tokens: one
 * background, one ink, one heading colour, one card fill, one radius, one
 * shadow. It reads the tokens themselves through getComputedStyle rather than
 * reading the file, so a page that fails to load the token file, loads a stale
 * copy, or has a token overridden further down its own stylesheet is caught.
 *
 * Why the tokens and not the pages' present colours: T3 landed the token file
 * INERT, by design — it declares custom properties and no selectors, so no
 * page's rendering changed. The pages adopt the tokens in Parts L, R, H and U,
 * where the repaint is visible and owned. Until then, asserting the pages' own
 * background and ink are identical would be asserting that those parts had
 * already happened. This gate asserts what T3 actually delivers and what every
 * later part depends on: the same vocabulary, resolving to the same values,
 * everywhere.
 *
 * It also carries T4's third-party gate, and that half measures REQUESTS, not
 * <link> tags. The first version counted any absolute-URL <link> and reported
 * twelve failures; all twelve were rel="canonical" at the estate's own
 * production origin, which issues no request whatsoever. A tag census cannot
 * tell a canonical hint from a webfont. So every request the page actually
 * makes is recorded and its host checked against the estate's own hosts.
 *
 * The control is not vacuous: --unlink removes the token link from one page and
 * the census must then differ for that page.
 *
 *   node tools/sw2/check_token_census.cjs --origin http://127.0.0.1:PORT
 *   node tools/sw2/check_token_census.cjs --origin ... --unlink /privacy/
 */
const { createRequire } = require('module');
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright')('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

const ROUTES = [
  ['/', 'index.html'],
  ['/main/', 'main/index.html'],
  ['/games/', 'games/index.html'],
  ['/tools/', 'tools/index.html'],
  ['/resources/', 'resources/index.html'],
  ['/members/', 'members/index.html'],
  ['/privacy/', 'privacy/index.html'],
  ['/stats/', 'stats/index.html'],
  ['/account/', 'account/index.html'],
  ['/mailing-list/', 'mailing-list/index.html'],
  ['/teach/', 'teach/index.html'],
  ['/education-hub/', 'education-hub/index.html'],
];

// Derived from the shipped file, never a hand-kept copy of it: a hardcoded
// list silently stops covering a token the moment one is added, and keeps
// asserting one that has been removed -- which would have censused the five
// deferred names to the empty string on all twelve pages and called it a pass.
const TOKENS = [...new Set(
  [...fs.readFileSync(path.join(ROOT, 'assets', 'mbm-tokens.css'), 'utf8')
    .matchAll(/(--mbm-[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
)].sort();

// The estate's own hosts. A request to one of these is first-party; anything
// else is a third-party request and fails the gate. Requests to a production
// host while serving locally are reported separately -- same-origin once
// deployed, but a live dependency on production from a local tree.
const ESTATE_HOSTS = new Set([
  'madebymatt.uk',
  'www.madebymatt.uk',
  'mattroper1977.github.io',
]);

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

(async () => {
  const origin = arg('--origin', 'http://127.0.0.1:4911').replace(/\/$/, '');
  const unlink = arg('--unlink', null);

  const browser = await chromium.launch();
  const rows = [];
  const problems = [];

  for (const [route, file] of ROUTES) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    if (unlink && route === unlink) {
      // The control. Strip the token stylesheet before the page evaluates, so
      // the census must lose this page's tokens.
      await page.route('**' + route, async (r) => {
        const response = await r.fetch();
        const body = (await response.text()).replace(
          /<link rel="stylesheet" href="\/assets\/mbm-tokens\.css">/,
          '',
        );
        await r.fulfill({ response, body });
      });
    }

    const requests = [];
    page.on('request', (r) => requests.push(r.url()));

    let ok = true;
    try {
      const response = await page.goto(origin + route, { waitUntil: 'load', timeout: 20000 });
      if (!response || response.status() >= 400) ok = false;
    } catch (e) {
      ok = false;
    }
    if (!ok) {
      problems.push(`${file}: unreachable at ${origin}${route}`);
      await context.close();
      continue;
    }

    const measured = await page.evaluate((tokens) => {
      const cs = getComputedStyle(document.documentElement);
      const out = {};
      for (const t of tokens) out[t] = cs.getPropertyValue(t).trim();
      const links = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((l) => l.getAttribute('href'))
        .filter((h) => h && h.includes('mbm-tokens.css'));
      out._tokenLinks = links.length;
      // Reported, not failed: an absolute-URL reference to a resource the
      // headless browser may never fetch. A favicon is the case that matters --
      // headless Chromium does not request one, so a request census alone would
      // leave it invisible. rel=canonical is excluded: it is a hint, not a
      // resource.
      out._absoluteRefs = [...document.querySelectorAll('link[href], script[src], img[src]')]
        .map((e) => ({ rel: e.getAttribute('rel') || e.tagName.toLowerCase(),
                       url: e.getAttribute('href') || e.getAttribute('src') }))
        .filter((r) => r.url && /^https?:\/\//.test(r.url) && r.rel !== 'canonical');
      return out;
    }, TOKENS);

    const local = new URL(origin).host;
    const foreign = [];
    const production = [];
    for (const url of requests) {
      let host;
      try { host = new URL(url).host; } catch (e) { continue; }
      if (host === local) continue;
      if (ESTATE_HOSTS.has(host)) production.push(url);
      else foreign.push(url);
    }

    rows.push({ file, route, measured, requests: requests.length, foreign, production });
    await context.close();
  }

  await browser.close();

  // Every token must resolve to one value across every page.
  for (const token of TOKENS) {
    const byValue = new Map();
    for (const r of rows) {
      const v = r.measured[token];
      if (!byValue.has(v)) byValue.set(v, []);
      byValue.get(v).push(r.file);
    }
    if (byValue.size !== 1) {
      const detail = [...byValue.entries()]
        .map(([v, files]) => `${JSON.stringify(v)} on ${files.length} (${files[0]}${files.length > 1 ? ' …' : ''})`)
        .join('  |  ');
      problems.push(`${token}: ${byValue.size} distinct values — ${detail}`);
    }
  }

  for (const r of rows) {
    if (r.measured._tokenLinks !== 1) {
      problems.push(`${r.file}: token file linked ${r.measured._tokenLinks} times, expected exactly 1`);
    }
    for (const url of r.foreign) {
      problems.push(`${r.file}: third-party request to ${new URL(url).host} (${url})`);
    }
  }

  console.log(`token census: ${rows.length} page types, ${TOKENS.length} tokens`);
  const sample = rows[0];
  if (sample) {
    for (const t of TOKENS) console.log(`  ${t.padEnd(28)} ${sample.measured[t]}`);
  }
  console.log(`  token file linked exactly once on ${rows.filter((r) => r.measured._tokenLinks === 1).length}/${rows.length}`);
  const totalRequests = rows.reduce((n, r) => n + r.requests, 0);
  console.log(`  ${totalRequests} requests observed across ${rows.length} page types`);
  console.log(`  third-party requests: ${rows.reduce((n, r) => n + r.foreign.length, 0)}`);
  const abs = rows.filter((r) => r.measured._absoluteRefs.length);
  if (abs.length) {
    console.log(`  absolute-URL resource refs (reported, not fetched headless):`);
    for (const r of abs) for (const a of r.measured._absoluteRefs) console.log(`    ${r.file}  ${a.rel}  ${a.url}`);
  }
  const prod = rows.filter((r) => r.production.length);
  if (prod.length) {
    console.log(`  requests to an estate production host (same-origin once deployed):`);
    for (const r of prod) for (const u of r.production) console.log(`    ${r.file}  ${u}`);
  }

  if (problems.length) {
    console.error(`\nPROBLEMS: ${problems.length}`);
    for (const p of problems) console.error('  ' + p);
    process.exit(1);
  }
  console.log('\nevery token resolves identically on every page type');
})().catch((e) => {
  console.error(String(e).slice(0, 300));
  process.exit(2);
});
