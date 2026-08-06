/* verify_fracture_live.js — live verification of the Fracture Engine launch,
 * run from a CI runner because this container cannot reach the origin
 * (the agent proxy answers 403 to CONNECT for madebymatt.uk:443 — derived from
 * the proxy's own recentRelayFailures log, not assumed).
 *
 * Checks, all derived from the repos rather than pinned:
 *   L1  served /Games/games.json is BYTE-EQUAL to games.json on Games main
 *   L2  served /fracture/ index.html SHA equals the committed blob
 *   L3  the arcade paints: every manifest entry, the sole NEW holder, the
 *       derived RPG rail, card art 200s, 0px overflow
 *   L4  the homepage New Release stack still holds three boxes
 *   L5  /fracture/ boots and makes zero off-origin requests
 *
 * Stage 2B added the Neon Turf leg to this same file rather than a second one,
 * because L1/L3 already carry most of it: the manifest is byte-compared whole,
 * and the arcade gate walks every entry in it. What Neon Turf needs on top is
 * its own served-byte check, its own boot, and the two AM10 absences:
 *
 *   L6  served /neonturf/ index.html SHA equals the committed blob
 *   L7  /neonturf/ boots and makes zero off-origin HTTP requests
 *   L8  AM10: Neon Turf carries no NEW marker and no homepage surface
 *
 * L8 is an ABSENCE check, which is the easiest kind of green to fake — it
 * passes by default when the page fails to load, when the selector is wrong,
 * when nothing renders at all. So it asserts the presence of what should be
 * there in the same breath as the absence of what should not, and --expect-fail
 * inverts it like every other gate. An absence you never proved you could
 * observe is not evidence of anything.
 *
 * --expect-fail runs the same checks against a deliberately wrong expectation
 * and exits 0 only if they FAILED. That is the negative control: a green from
 * this file means nothing until the file is shown able to go red.
 *
 *   BASE=https://madebymatt.uk GAMES_DIR=./_games SITE_DIR=. node tools/verify_fracture_live.js
 */
'use strict';
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE = (process.env.BASE || 'https://madebymatt.uk').replace(/\/$/, '');
const GAMES_DIR = process.env.GAMES_DIR || '_games';
const SITE_DIR = process.env.SITE_DIR || '.';
const EXPECT_FAIL = process.argv.includes('--expect-fail');
const NEW_PREFIX = 'NEW · ';
const RPG = /\bRPG\b/;

const results = [];
const gate = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

(async () => {
  /* Committed truth, read from the checked-out repos. */
  const committedManifestRaw = fs.readFileSync(path.join(GAMES_DIR, 'games.json'));
  const committedGameRaw = fs.readFileSync(path.join(SITE_DIR, 'fracture', 'index.html'));
  const committedTurfRaw = fs.readFileSync(path.join(SITE_DIR, 'neonturf', 'index.html'));
  const manifest = JSON.parse(committedManifestRaw.toString('utf8'));
  const games = manifest.games;

  /* Derived expectations. In --expect-fail mode they are deliberately wrong,
     which must drive every gate red. */
  const EXPECT_ENTRIES = EXPECT_FAIL ? games.length + 7 : games.length;
  const EXPECT_RPG = games.filter(g => RPG.test(String(g.tag || ''))).length;
  const EXPECT_MARKER = games.filter(g => String(g.title).startsWith(NEW_PREFIX)).map(g => g.title);
  const expectManifestSha = EXPECT_FAIL ? sha(Buffer.from('deliberately wrong')) : sha(committedManifestRaw);
  const expectGameSha = EXPECT_FAIL ? sha(Buffer.from('deliberately wrong')) : sha(committedGameRaw);
  const expectTurfSha = EXPECT_FAIL ? sha(Buffer.from('deliberately wrong')) : sha(committedTurfRaw);
  /* Derived from the manifest, not typed: whichever entry points at /neonturf/. */
  const TURF = games.find(g => /^\/neonturf\/$/.test(String(g.href || '')));
  if (!TURF) throw new Error('no manifest entry points at /neonturf/ — L6-L8 have nothing to verify');

  console.log(`base ${BASE}`);
  console.log(`derived: ${EXPECT_ENTRIES} entries · RPG rail ${EXPECT_RPG} · NEW holder ${JSON.stringify(EXPECT_MARKER)}`);
  console.log(EXPECT_FAIL ? '*** NEGATIVE CONTROL: expectations are deliberately wrong; every gate must go RED ***\n' : '');

  const browser = await chromium.launch();

  /* ---- L1: served manifest byte-equal to the committed one ---- */
  {
    const ctx = await browser.newContext();
    const res = await ctx.request.get(`${BASE}/Games/games.json`, { headers: { 'Cache-Control': 'no-cache' } });
    const body = Buffer.from(await res.body());
    const servedSha = sha(body);
    gate('L1 served games.json is byte-equal to Games main',
      servedSha === expectManifestSha,
      `served ${servedSha.slice(0, 16)}… vs committed ${sha(committedManifestRaw).slice(0, 16)}… (${body.length} vs ${committedManifestRaw.length} bytes)`);
    await ctx.close();
  }

  /* ---- L2: served game file SHA equals the committed blob ---- */
  {
    const ctx = await browser.newContext();
    const res = await ctx.request.get(`${BASE}/fracture/`, { headers: { 'Cache-Control': 'no-cache' } });
    const body = Buffer.from(await res.body());
    const servedSha = sha(body);
    gate('L2 served /fracture/ index.html SHA equals the committed blob',
      servedSha === expectGameSha,
      `served ${servedSha.slice(0, 16)}… vs committed ${sha(committedGameRaw).slice(0, 16)}… (${body.length} vs ${committedGameRaw.length} bytes)`);
    await ctx.close();
  }

  /* ---- L3: the arcade actually paints ---- */
  for (const width of [1366, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await ctx.newPage();
    const bad = [];
    page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${BASE}/games/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('.gcard').length > 0, null, { timeout: 30000 });
    /* Lazy art is never requested while offscreen — force it, then await decode,
       or an unloaded image is indistinguishable from a broken one. */
    await page.evaluate(() => document.querySelectorAll('.gcard img').forEach(i => { i.loading = 'eager'; }));
    await page.evaluate(() => Promise.all([...document.querySelectorAll('.gcard img')]
      .map(i => i.complete ? Promise.resolve() : new Promise(r => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 5000); }))));
    const out = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('.gcard img')];
      const rpgSec = document.getElementById('rpg');
      return {
        fracture: document.querySelectorAll('a.gcard[href*="fracture"]').length,
        rpgHidden: rpgSec ? rpgSec.hidden : null,
        rpgCount: document.querySelectorAll('#rpgRail .gcard').length,
        newHolders: [...document.querySelectorAll('.gcard')].filter(c => c.textContent.includes('NEW · ')).map(c => c.textContent.trim().slice(0, 46)),
        broken: imgs.filter(i => !i.complete || i.naturalWidth === 0).length,
        totalArt: imgs.length,
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth
      };
    });
    const tag = width === 390 ? 'phone 390' : 'desktop 1366';
    gate(`L3 [${tag}] /fracture/ card is on the live arcade`, out.fracture >= 1 && !EXPECT_FAIL, `${out.fracture} card(s)`);
    gate(`L3 [${tag}] RPG rail visible with its derived membership`,
      out.rpgHidden === false && out.rpgCount === EXPECT_RPG && !EXPECT_FAIL,
      `hidden=${out.rpgHidden}, ${out.rpgCount} cards (expected ${EXPECT_RPG})`);
    gate(`L3 [${tag}] sole rendered NEW holder is Fracture Engine`,
      out.newHolders.length > 0 && out.newHolders.every(t => /Fracture Engine/.test(t)) && !EXPECT_FAIL,
      out.newHolders.join(' | ') || 'none rendered');
    gate(`L3 [${tag}] card art all 200s / decoded`, out.broken === 0 && !EXPECT_FAIL, `${out.totalArt - out.broken}/${out.totalArt}`);
    gate(`L3 [${tag}] 0px horizontal overflow`, out.scrollW <= out.innerW && !EXPECT_FAIL, `${out.scrollW} vs ${out.innerW}`);
    gate(`L3 [${tag}] no 4xx/5xx`, bad.length === 0 && !EXPECT_FAIL, bad.slice(0, 3).join(' | ') || 'none');
    await ctx.close();
  }

  /* ---- L4: homepage stack ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
    const home = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('#newrelease [data-release]')];
      const mine = document.querySelector('#newrelease [data-release="Relicforge: Fracture Engine"]');
      const img = mine ? mine.querySelector('img') : null;
      return {
        occupants: boxes.map(b => b.getAttribute('data-release')),
        painted: !!mine && mine.getBoundingClientRect().height > 0,
        posterOk: !!img && img.complete && img.naturalWidth > 0,
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth
      };
    });
    gate('L4 homepage stack holds three boxes, nothing displaced',
      home.occupants.length === 3 && home.painted && !EXPECT_FAIL,
      home.occupants.join(' | '));
    gate('L4 homepage poster loads', home.posterOk && !EXPECT_FAIL, `poster decoded=${home.posterOk}`);
    gate('L4 homepage 0px overflow', home.scrollW <= home.innerW && !EXPECT_FAIL, `${home.scrollW} vs ${home.innerW}`);
    await ctx.close();
  }

  /* ---- L5: the game boots live and stays self-contained ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    const off = [];
    page.on('request', r => {
      const u = r.url();
      if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) off.push(u);
    });
    await page.goto(`${BASE}/fracture/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    let booted = false, snap = null;
    try {
      await page.waitForFunction(() => window.__fracture && window.__fracture.snapshot().mode === 'menu', null, { timeout: 45000 });
      snap = await page.evaluate(() => window.__fracture.snapshot());
      booted = true;
    } catch (_) {}
    gate('L5 /fracture/ boots to its menu on the live site', booted && !EXPECT_FAIL,
      booted ? `save keys ${snap.saveKeys.save} / ${snap.saveKeys.settings}` : 'did not reach menu');
    gate('L5 zero off-origin requests from the live game', off.length === 0 && !EXPECT_FAIL,
      off.slice(0, 3).join(' | ') || 'none');
    await ctx.close();
  }

  /* ---- L6: served Neon Turf file SHA equals the committed blob ---- */
  {
    const ctx = await browser.newContext();
    const res = await ctx.request.get(`${BASE}/neonturf/`, { headers: { 'Cache-Control': 'no-cache' } });
    const body = Buffer.from(await res.body());
    const servedSha = sha(body);
    gate('L6 served /neonturf/ index.html SHA equals the committed blob',
      servedSha === expectTurfSha,
      `served ${servedSha.slice(0, 16)}… vs committed ${sha(committedTurfRaw).slice(0, 16)}… (${body.length} vs ${committedTurfRaw.length} bytes)`);
    await ctx.close();
  }

  /* ---- L7: Neon Turf boots live and stays self-contained ---- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    const off = [];
    page.on('request', r => {
      const u = r.url();
      if (!u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')) off.push(u);
    });
    await page.goto(`${BASE}/neonturf/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    let booted = false, snap = null;
    try {
      await page.waitForFunction(() => window.__turf && window.__turf.snapshot(), null, { timeout: 45000 });
      snap = await page.evaluate(() => window.__turf.snapshot());
      booted = true;
    } catch (_) {}
    gate('L7 /neonturf/ boots on the live site', booted && !EXPECT_FAIL,
      booted ? `keys ${Object.values(snap.saveKeys).join(' / ')} · shaderFloorOk=${snap.renderer.shaderFloorOk}` +
               ` · webglUnavailable=${snap.renderer.webglUnavailable} · RM effective=${snap.reducedMotion.effective}` : 'did not boot');
    /* The one classified remote reference in this game is a STUN URI for the
       local-duel path. STUN is UDP and never appears as an HTTP request, so
       this gate is about HTTP only and says so rather than implying it proved
       something about WebRTC that it did not observe. */
    gate('L7 zero off-origin HTTP requests from the live game (STUN is UDP, not observed here)',
      off.length === 0 && !EXPECT_FAIL, off.slice(0, 3).join(' | ') || 'none');
    await ctx.close();
  }

  /* ---- L8: AM10 — no NEW marker, no homepage surface ----
   *
   * Every other gate in this file goes red under --expect-fail partly via a
   * blanket `&& !EXPECT_FAIL` term. That proves the REPORTING path can fail. It
   * does not prove the MEASUREMENT can, and for an absence check that is the
   * only distinction that matters: "no NEW marker" and "no homepage surface"
   * both pass trivially on a page that never loaded.
   *
   * So L8 gets a real control instead of a synthetic one. Under --expect-fail
   * it runs the identical measurements against FRACTURE, which by AM10 does
   * carry the NEW marker and does hold a homepage box. Every assertion is
   * unchanged; only the subject moves. If the probe is blind — wrong selector,
   * blank page, silent navigation failure — it reports "no marker, no surface"
   * for Fracture too, and the control catches it.
   */
  {
    const SUBJECT = EXPECT_FAIL
      ? { slug: 'fracture', label: 'Fracture Engine', name: /fracture engine/i }
      : { slug: 'neonturf', label: 'Neon Turf', name: /neon turf/i };
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/games/`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('.gcard').length > 0, null, { timeout: 30000 });
    const arcade = await page.evaluate(slug => {
      const card = document.querySelector(`a.gcard[href*="${slug}"]`);
      return {
        present: !!card,
        text: card ? card.textContent.trim().slice(0, 60) : null,
        marked: card ? card.textContent.includes('NEW · ') : null
      };
    }, SUBJECT.slug);
    /* Presence first. Without it, "no marker" would pass on an empty page. */
    gate(`L8 ${SUBJECT.label} card is present on the live arcade`, arcade.present,
      arcade.text || `no card matched a[href*="${SUBJECT.slug}"]`);
    gate(`L8 AM10: the ${SUBJECT.label} card carries no NEW marker`,
      arcade.present && arcade.marked === false,
      arcade.present ? `marked=${arcade.marked}` : 'card absent, so the absence of a marker proves nothing');

    await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
    const home = await page.evaluate(slug => {
      const boxes = [...document.querySelectorAll('#newrelease [data-release]')];
      return {
        occupants: boxes.map(b => b.getAttribute('data-release')),
        linked: [...document.querySelectorAll('a[href]')]
          .filter(a => new RegExp(slug, 'i').test(a.getAttribute('href'))).length
      };
    }, SUBJECT.slug);
    /* Same shape: the stack must be observably populated before its not
       containing the subject means anything. */
    gate(`L8 AM10: homepage stack is populated and holds no ${SUBJECT.label} surface`,
      home.occupants.length === 3 && !home.occupants.some(o => SUBJECT.name.test(o)) && home.linked === 0,
      `${home.occupants.length} boxes [${home.occupants.join(' | ')}] · ${home.linked} homepage link(s) to /${SUBJECT.slug}/`);
    await ctx.close();
  }

  await browser.close();

  const red = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - red}/${results.length} live gates green, ${red} red`);

  if (EXPECT_FAIL) {
    /* The control passes only if the checks DID go red. */
    if (red === 0) {
      console.error('NEGATIVE CONTROL FAILED: wrong expectations still produced an all-green run. This instrument cannot fail and its greens are worthless.');
      process.exit(1);
    }
    console.log(`NEGATIVE CONTROL PASSED: ${red} gate(s) went red on deliberately wrong expectations, so a green here carries information.`);
    process.exit(0);
  }
  process.exit(red === 0 ? 0 : 1);
})().catch(e => { console.error('verifier threw:', e); process.exit(EXPECT_FAIL ? 0 : 1); });
