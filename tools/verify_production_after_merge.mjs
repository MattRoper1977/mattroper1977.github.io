/* Post-merge production verification. Runs in CI, against madebymatt.uk.
 *
 * WHY THIS IS A CI JOB AND NOT A CLAIM
 * The sandbox this branch was built in gets 403 on CONNECT to madebymatt.uk,
 * so nothing in it can see production. Every production statement made during
 * the R4 run was therefore an inference from the deployed ref, not an
 * observation. This job is the observation, and it runs where egress is real.
 *
 * WHY IT RETRIES, AND WHY IT PRINTS THE FAILURES
 * GitHub Pages deploys after the merge, not with it. A 404 in the first
 * seconds means "not yet", not "broken" — and that exact confusion has already
 * cost this estate a false alarm once. So every attempt is reported, including
 * the ones that failed, and the report says which attempt succeeded. A run that
 * passes on attempt 4 is a pass with a visible deploy lag, not a silent pass.
 */
import { chromium } from 'playwright';

const BASE = process.env.MBM_PROD_BASE || 'https://madebymatt.uk';
const ATTEMPTS = Number(process.env.MBM_ATTEMPTS || 8);
const WAIT_MS = Number(process.env.MBM_WAIT_MS || 30000);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const rows = [];
const check = (ok, what, detail = '') => {
  rows.push({ ok: !!ok, what, detail });
  console.log(`  ${ok ? '[ ok ]' : '[FAIL]'} ${what}${detail ? '  — ' + detail : ''}`);
  return !!ok;
};

/* ---- the deploy-lag loop -------------------------------------------------- */
async function waitForDeploy(paths) {
  console.log(`Waiting for deployment. Up to ${ATTEMPTS} attempts, ${WAIT_MS / 1000}s apart.`);
  console.log(`Every attempt is reported, including the ones that fail.\n`);
  for (let i = 1; i <= ATTEMPTS; i++) {
    const results = [];
    for (const p of paths) {
      try {
        const r = await fetch(BASE + p, { redirect: 'follow' });
        results.push({ p, status: r.status });
      } catch (e) { results.push({ p, status: 'ERR ' + e.message.slice(0, 40) }); }
    }
    const allOk = results.every(r => r.status === 200);
    console.log(`  attempt ${i}/${ATTEMPTS}  ${allOk ? 'ALL 200' : 'not ready'}  ` +
      results.map(r => `${r.p} ${r.status}`).join(' · '));
    if (allOk) { console.log(`\n  deployment observed on attempt ${i}.\n`); return i; }
    if (i < ATTEMPTS) await sleep(WAIT_MS);
  }
  console.log(`\n  deployment NOT observed after ${ATTEMPTS} attempts.\n`);
  return null;
}

const NEW_ROUTES = ['/apexcurl/', '/apexvelodrome/'];
const attempt = await waitForDeploy(NEW_ROUTES);
check(attempt !== null, `both new routes serve 200 on ${BASE}`,
  attempt ? `first seen on attempt ${attempt}` : `still 404 after ${ATTEMPTS} attempts`);
if (attempt === null) { summarise(); process.exit(1); }

const browser = await chromium.launch();
try {
  /* ---- per-game: splash, exit control at 390px, no off-origin ------------- */
  for (const route of NEW_ROUTES) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const offOrigin = [];
    page.on('request', r => {
      const u = new URL(r.url());
      if (u.origin !== new URL(BASE).origin) offOrigin.push(r.url());
    });
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(2500);

    check(await page.locator('.mbm-splash').count() > 0 ||
          await page.evaluate(() => !!window.__mbmSplashStarted),
      `${route}: the Made by Matt splash rendered`);

    /* the exit control must be FOUND ON A PHONE, not merely present in source */
    const exit = await page.evaluate(() => {
      const e = document.querySelector('#mbmexit-back');
      if (!e) return null;
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      const mid = document.elementFromPoint(Math.round(r.left + r.width / 2),
                                            Math.round(r.top + r.height / 2));
      return { w: r.width, h: r.height, href: e.getAttribute('href'),
               vis: cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0,
               onTop: !!mid && (mid === e || e.contains(mid)) };
    });
    check(exit && exit.vis && exit.w >= 44 && exit.h >= 44 && exit.href === '/games/' && exit.onTop,
      `${route}: the exit control renders ≥44×44, resolves and is tappable at 390px`,
      exit ? `${Math.round(exit.w)}×${Math.round(exit.h)} href=${exit.href} onTop=${exit.onTop}` : 'absent');

    check(offOrigin.length === 0, `${route}: zero off-origin requests at load`,
      offOrigin.slice(0, 3).join(', '));
    await page.close();
  }

  /* ---- the shelf lists both, exactly once -------------------------------- */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + '/games/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    for (const r of NEW_ROUTES) {
      const n = await page.evaluate(h =>
        [...document.querySelectorAll(`a[href="${h}"]`)].length, r);
      check(n === 1, `/games/ lists ${r} exactly once`, `${n} link(s)`);
    }
    /* the canonical heading, asserted BY CODEPOINT */
    const heading = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h1,h2,h3')]
        .map(e => e.textContent.trim()).find(t => /top picks/i.test(t));
      return h || null;
    });
    check(heading === "Made by Matt's Top Picks", `/games/ serves the canonical rail heading`,
      JSON.stringify(heading));
    const cps = [...(heading || '')].filter(c => c === "'" || c === '’')
      .map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
    check(cps.length === 1 && cps[0] === 'U+0027',
      `/games/ heading apostrophe is U+0027, by codepoint`, cps.join(',') || 'none');
    await page.close();
  }

  /* ---- the pupil page: heading, and its search finds both new games ------- */
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(BASE + '/for/pupils/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1200);

    const ph = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h1,h2,h3')]
        .map(e => e.textContent.trim()).find(t => /top picks/i.test(t));
      return h || null;
    });
    check(ph === "Made by Matt's Top Picks", `/for/pupils/ serves the canonical rail heading`,
      JSON.stringify(ph));
    const pcps = [...(ph || '')].filter(c => c === "'" || c === '’')
      .map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
    check(pcps.length === 1 && pcps[0] === 'U+0027',
      `/for/pupils/ heading apostrophe is U+0027, by codepoint`, pcps.join(',') || 'none');

    for (const name of ['Apex Curl', 'Apex Velodrome']) {
      await page.fill('[data-mbm-pupil-search]', '');
      await page.type('[data-mbm-pupil-search]', name, { delay: 15 });
      await page.waitForTimeout(400);
      const found = await page.evaluate(t => {
        const shown = [...document.querySelectorAll('.mf-pupil-game')].filter(c => !c.hidden);
        const hit = shown.find(c => (c.querySelector('h3') || {}).textContent.trim() === t);
        return { hit: !!hit, href: hit ? hit.querySelector('a[href]').getAttribute('href') : null };
      }, name);
      check(found.hit, `/for/pupils/ search finds "${name}" on production`, `route ${found.href}`);
    }
    await page.close();
  }

  /* ---- the two index entries resolve ------------------------------------- */
  {
    const r = await fetch(BASE + '/data/mbm-search-index.json');
    const idx = await r.json();
    for (const route of NEW_ROUTES) {
      const e = idx.entries.find(x => x.route === route);
      check(!!e, `the search index carries an entry for ${route}`, e ? e.id : 'absent');
      if (e) {
        const hit = await fetch(BASE + e.route, { method: 'GET' });
        check(hit.status === 200, `and ${e.id} resolves to a live page`, `HTTP ${hit.status}`);
        check(e.safeForPupils === true, `and ${e.id} is marked safeForPupils:true`);
      }
    }
  }

  /* ---- P2: NOT ASSERTED, AND SAID SO -------------------------------------
     §C6.3 lists "the rewritten copy is live on all five audience pages". P2 is
     held RED under §3.9 — the 20-pair swap test returned 19/20 twice, and the
     surviving pair (closing: councils <-> partners) is in the authorised copy
     itself. So the copy is NOT in the merge and asserting it would fail for the
     right reason at the wrong time. This block is the placeholder, and it
     REPORTS rather than silently omitting. Turn it on in the commit that lands
     P2, not before. */
  console.log(`\n  [ -- ] the five rewritten audience pages: NOT ASSERTED — P2 is not in this merge`);
  console.log(`         (held under §3.9; see .rescue/p2/ and PR #172 for the held work)`);
} finally { await browser.close(); }

function summarise() {
  const bad = rows.filter(r => !r.ok);
  console.log(`\nproduction: ${rows.length - bad.length}/${rows.length} passed`);
  if (bad.length) {
    console.error(`\n${bad.length} FAILED on production:`);
    for (const b of bad) console.error(`  - ${b.what}${b.detail ? '  — ' + b.detail : ''}`);
  }
}
summarise();
process.exit(rows.some(r => !r.ok) ? 1 : 0);
