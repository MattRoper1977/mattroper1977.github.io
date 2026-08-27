/**
 * The Micro-Tinkerer live gate — the three release assertions, run from CI
 * against the deployed origin.
 *
 * WHY THIS EXISTS. These three checks were written as a phone checklist, and a
 * phone is still the better instrument. But a phone is not available to an
 * automated pass, and the release is already public, so the choice is between
 * running them from CI and not running them at all. CI reaches the live site;
 * an agent session does not (its egress returns `CONNECT tunnel failed,
 * response 403` for the origin root and for the named route alike, which says
 * nothing about the estate). So they run here, and the result is labelled
 * VERIFIED-CI. It is never to be written down as a phone pass.
 *
 * WHAT IT REFUSES TO ACCEPT AS A PASS.
 *   - An empty console capture from a page that never loaded. Silence is not
 *     health, so the load itself is asserted before the console is read.
 *   - An offline reload that "worked" because the HTTP cache still held the
 *     document. The negative control runs FIRST: a cold offline load with no
 *     worker registered must fail. Without that, the offline assertion is
 *     proving only that browsers cache.
 *   - A sentence that is present in the served markup. Presence is not
 *     visibility on a full-screen WebGL document; each is hit-tested, so a
 *     paragraph painted behind the canvas fails.
 *
 * THE h1 ASSERTION IS A REGRESSION GUARD, NOT DECORATION. On untouched main
 * the menu centred a column taller than its own box, and a flex container
 * centring overflow pushes it out of the TOP where scrolling cannot reach it.
 * The game's own title measured top=-300 at 390x844. `align-items: safe center`
 * fixed it. This asserts it stays fixed.
 *
 *   node tools/mtr_live_gate.mjs [url]      default https://madebymatt.uk/micro-tinkerer/
 */
import { chromium } from 'playwright';

const URL_ = process.argv[2] || process.env.MTR_LIVE_URL || 'https://madebymatt.uk/micro-tinkerer/';
const VIEWPORT = { width: 390, height: 844 };

const S1 = 'This is a playful, fictional hide-and-seek fantasy: tiny players hide from a larger-than-life "Mega Teacher"; it is not a depiction of real pupils, staff or SEMH practice.';
const S2 = 'When available, online multiplayer connects players through the Made by Matt signalling server plus Cloudflare (stun.cloudflare.com:3478) and Google (stun.l.google.com:19302) STUN services; there is no TURN relay fallback, so a minority of home or restricted-network connections will not work.';

let fails = 0;
const gate = (name, ok, detail = '') => {
  if (!ok) fails++;
  console.log(`  ${ok ? '[ ok ]' : '[FAIL]'} ${name}${detail ? '  — ' + detail : ''}`);
};

console.log(`Micro-Tinkerer live gate against ${URL_}`);
console.log(`viewport ${VIEWPORT.width}x${VIEWPORT.height}\n`);

const browser = await chromium.launch();

/* ── Negative control, first. Cold offline with no worker must NOT boot. ──── */
console.log('=== control: offline with nothing installed ===');
{
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  await ctx.setOffline(true);
  const page = await ctx.newPage();
  let booted = true;
  try { await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
  catch { booted = false; }
  gate('CONTROL: a cold offline load with no worker does NOT boot', !booted,
       booted ? 'it booted — every offline assertion below would be vacuous' : 'navigation refused');
  await ctx.close();
}

/* ── 1 · boots to the menu, and the title is reachable ────────────────────── */
console.log('\n=== 1 · boots to the menu ===');
const ctx = await browser.newContext({ viewport: VIEWPORT });
const page = await ctx.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

const resp = await page.goto(URL_, { waitUntil: 'load', timeout: 45000 });
gate('the named route itself was fetched and served 200', !!resp && resp.status() === 200,
     `${resp ? resp.status() : 'no response'} from ${resp ? resp.url() : '-'}`);
await page.waitForTimeout(2500);

const boot = await page.evaluate(() => {
  const menu = document.getElementById('menu');
  const h1 = document.querySelector('.hero h1');
  const mr = menu ? menu.getBoundingClientRect() : null;
  const hr = h1 ? h1.getBoundingClientRect() : null;
  const fatal = document.getElementById('fatal');
  const fs = fatal ? getComputedStyle(fatal) : null;
  return {
    menuExists: !!menu,
    menuShown: !!menu && menu.classList.contains('show'),
    menuVisible: !!mr && mr.width > 0 && mr.height > 0,
    menuScrollTop: menu ? menu.scrollTop : null,
    docScrollY: window.scrollY,
    h1Top: hr ? Math.round(hr.top) : null,
    h1Text: h1 ? (h1.textContent || '').trim() : null,
    fatalShown: !!fatal && fs.display !== 'none' && fs.visibility !== 'hidden' && fatal.getBoundingClientRect().height > 0,
    title: document.title,
    bodyLen: document.body ? document.body.innerHTML.length : 0,
  };
});
gate('the menu is present and shown', boot.menuExists && boot.menuShown && boot.menuVisible);
gate('it is the game, not an error stub', /Micro/i.test(boot.title) && boot.bodyLen > 2000,
     `${boot.bodyLen} chars, title ${JSON.stringify(boot.title)}`);
gate('unscrolled — the menu is at its own scroll origin', boot.menuScrollTop === 0 && boot.docScrollY === 0,
     `menu scrollTop=${boot.menuScrollTop}, window scrollY=${boot.docScrollY}`);
gate("the game's own <h1> has top >= 0 (the #menu overflow regression guard)",
     boot.h1Top !== null && boot.h1Top >= 0,
     `top=${boot.h1Top} — this measured -300 on untouched main before align-items: safe center`);

/* ── 2 · no error overlay, no console error ───────────────────────────────── */
console.log('\n=== 2 · no error overlay, no console error ===');
gate('the page actually loaded, so an empty console capture means something',
     !!resp && resp.ok() && boot.bodyLen > 2000);
gate('no error overlay is showing', !boot.fatalShown);
gate('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | ') || 'none');
gate('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | ') || 'none');

/* ── 3 · both approved sentences, VISIBLE on the served page ──────────────── */
console.log('\n=== 3 · the approved disclosures, on the served page ===');
const seen = await page.evaluate(() => {
  const out = {};
  for (const [k, id, anchor] of [['s1', 'framing-note', 'p.lead'], ['s2', 'multiplayer-note', 'div.sub-actions']]) {
    const el = document.getElementById(id);
    if (!el) { out[k] = { exists: false }; continue; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 8));
    out[k] = {
      exists: true, text: (el.textContent || '').trim(),
      w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top),
      styled: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0,
      visibleFraction: Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / Math.max(r.height, 1),
      hitSelf: !!hit && (hit === el || el.contains(hit)),
      hitTag: hit ? (hit.id ? '#' + hit.id : hit.tagName.toLowerCase()) : null,
      adjacent: (!!el.previousElementSibling && el.previousElementSibling.matches(anchor))
             || (!!el.nextElementSibling && el.nextElementSibling.matches(anchor)),
    };
  }
  return out;
});
for (const [k, label, approved] of [['s1', 'sentence 1 (framing)', S1], ['s2', 'sentence 2 (multiplayer)', S2]]) {
  const v = seen[k];
  gate(`${label}: on the served page`, v.exists);
  if (!v.exists) continue;
  gate(`${label}: text is byte-identical to the approved sentence`, v.text === approved,
       v.text === approved ? `${v.text.length} chars` : `served: ${JSON.stringify(v.text.slice(0, 80))}`);
  gate(`${label}: non-zero box and not hidden`, v.w > 0 && v.h > 0 && v.styled, `${v.w}x${v.h} at top=${v.top}`);
  gate(`${label}: >=90% in the viewport, unscrolled, pre-interaction`, v.visibleFraction >= 0.9,
       `${(v.visibleFraction * 100).toFixed(0)}%`);
  gate(`${label}: hit-tests to itself, not to the canvas`, v.hitSelf, `elementFromPoint -> ${v.hitTag}`);
  gate(`${label}: adjacent to its named anchor in reading order`, v.adjacent);
}

/* ── 4 · second load offline still boots ──────────────────────────────────── */
console.log('\n=== 4 · second load offline ===');
const sw = await page.evaluate(async () => {
  try {
    const r = await Promise.race([
      navigator.serviceWorker.ready.then((reg) => ({ ok: true, scope: reg.scope })),
      new Promise((res) => setTimeout(() => res({ ok: false, scope: null }), 15000)),
    ]);
    const names = await caches.keys();
    return { ...r, caches: names };
  } catch (e) { return { ok: false, scope: null, caches: [], err: e.message }; }
});
gate('a service worker is installed and active on the live origin', sw.ok, `scope=${sw.scope}`);
gate('its scope is /micro-tinkerer/ and no wider', !!sw.scope && sw.scope.endsWith('/micro-tinkerer/'), `${sw.scope}`);
gate('a versioned cache exists', sw.caches.some((n) => /v\d+\.\d+\.\d+/.test(n)), sw.caches.join(',') || 'none');

await ctx.setOffline(true);
let offErr = null;
try { await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
catch (e) { offErr = e.message.split('\n')[0]; }
gate('the second load with the network offline still boots', !offErr, offErr || 'no navigation error');

if (!offErr) {
  const off = await page.evaluate(() => ({
    menu: !!document.getElementById('menu'),
    canvas: !!document.querySelector('canvas'),
    len: document.body ? document.body.innerHTML.length : 0,
    s1: !!document.getElementById('framing-note'),
    s2: !!document.getElementById('multiplayer-note'),
  }));
  gate('and offline it is still the game, with both disclosures',
       off.menu && off.canvas && off.len > 2000 && off.s1 && off.s2,
       `${off.len} chars, menu=${off.menu} canvas=${off.canvas} s1=${off.s1} s2=${off.s2}`);
}

await ctx.close();
await browser.close();

console.log(`\nlive gate: ${fails === 0 ? 'VERIFIED-CI' : 'FAILED'} — ${fails} failed assertion(s)`);
console.log('This is a CI result against the live origin. It is not a phone pass.');
process.exit(fails ? 1 : 0);
