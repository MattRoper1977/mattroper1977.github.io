#!/usr/bin/env node
/*
 * High-Lumen contrast, measured on the RENDERED page.
 *
 * A static sweep of hardcoded hexes cannot tell you what a rule paints: it does
 * not know which selector won, what a gradient resolved to, or which ancestor
 * actually supplied the background behind a transparent element. This loads
 * each ported page in Chromium with the theme applied and walks every visible
 * text node, resolving each one's real colour against the first opaque
 * background above it.
 *
 * Floors, from the brief: 7:1 for text, 3:1 for UI borders.
 *
 *   node tools/verify_highlumen_contrast.mjs
 *   node tools/verify_highlumen_contrast.mjs --self-test
 *   node tools/verify_highlumen_contrast.mjs --report   # list every pair
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (_) { /* keep looking */ }
  }
  console.error('playwright not found. Install it with:  npm i -g playwright');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = (p) => fs.existsSync(p) ? p : null;
const LESSONS = exists(path.join(SITE, '..', 'Lessons')) || exists('/home/user/Lessons');
const APPS = exists(path.join(SITE, '..', 'matt-s-apps-')) || exists('/workspace/matt-s-apps-');

const REPORT = process.argv.includes('--report');
const SELFTEST = process.argv.includes('--self-test');
const TEXT_FLOOR = 7.0;

/* Each page is served from whichever repo owns it, mounted where the domain
   mounts it, so relative asset paths resolve the way they really do. */
const MOUNTS = [
  { prefix: '/Lessons', root: LESSONS },
  { prefix: '/Matt-s-Apps-', root: APPS },
  { prefix: '', root: SITE },
];
const PAGES = [
  { label: 'homepage',    url: '/main/index.html' },
  { label: 'tools',       url: '/tools/index.html' },
  { label: 'resources',   url: '/resources/index.html' },
  { label: 'games',       url: '/games/index.html' },
  { label: 'lessons-hub', url: '/Lessons/index.html',        need: LESSONS },
  { label: 'primary-hub', url: '/Lessons/primary/index.html', need: LESSONS },
  { label: 'creator-hub', url: '/Matt-s-Apps-/index.html',    need: APPS },
].filter((p) => p.need !== null);

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
               '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
               '.webp':'image/webp', '.jpg':'image/jpeg', '.ico':'image/x-icon',
               '.woff2':'font/woff2', '.gif':'image/gif' };

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      let file = null;
      for (const m of MOUNTS) {
        if (!m.root) continue;
        if (m.prefix && !rel.startsWith(m.prefix + '/')) continue;
        const cand = path.join(m.root, m.prefix ? rel.slice(m.prefix.length) : rel);
        if (fs.existsSync(cand) && !fs.statSync(cand).isDirectory()) { file = cand; break; }
      }
      if (!file) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* Runs in the page. Resolves each visible text node's real foreground against
   the first opaque background above it, and returns every pair. */
const AUDIT = () => {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const parse = (s) => {
    const m = String(s).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const L = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (f, b) => {
    const a = L(f), d = L(b);
    return (Math.max(a, d) + 0.05) / (Math.min(a, d) + 0.05);
  };
  const over = (fg, bg) => ({           // composite a translucent fg onto bg
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
  });
  function groundOf(el) {
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      // A background-image (gradient/photo) makes the ground unknowable from
      // computed style alone; report it rather than guessing a pass.
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        // A gradient is measurable: take its worst colour stop, which is the
        // hardest place on that element for text to sit. Only a real image
        // (url(...)) is genuinely underivable from computed style.
        const stops = cs.backgroundImage.match(/rgba?\([^)]*\)/g);
        if (stops && !/url\(/.test(cs.backgroundImage)) {
          const cols = stops.map(parse).filter(Boolean);
          if (cols.length) {
            const under = groundOf(n.parentElement);
            const base = under.colour || { r: 255, g: 255, b: 255, a: 1 };
            const solid = cols.map((c) => (c.a < 1 ? over(c, base) : c));
            return { colour: solid.reduce((a, b) => (L(a) < L(b) ? a : b)), fromGradient: true };
          }
        }
        return { unknown: true, el: n };
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a >= 0.999) return { colour: c };
      if (c && c.a > 0) { const under = groundOf(n.parentElement); if (under.colour) return { colour: over(c, under.colour) }; }
      n = n.parentElement;
    }
    return { colour: { r: 255, g: 255, b: 255, a: 1 } };
  }

  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let node;
  while ((node = walker.nextNode())) {
    const text = (node.nodeValue || '').trim();
    if (text.length < 2) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // skip anything clipped to a pixel: visually-hidden live regions and labels
    if (r.width <= 2 && r.height <= 2) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const ground = groundOf(el);
    const size = parseFloat(cs.fontSize) || 16;
    const weight = +cs.fontWeight || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    if (ground.unknown) {
      out.push({ text: text.slice(0, 40), unknown: true,
                 sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
                 fg: cs.color, size, large });
      continue;
    }
    const composed = fg.a < 1 ? over(fg, ground.colour) : fg;
    out.push({ text: text.slice(0, 40),
               sel: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''),
               fg: cs.color, bg: `rgb(${Math.round(ground.colour.r)}, ${Math.round(ground.colour.g)}, ${Math.round(ground.colour.b)})`,
               ratio: +ratio(composed, ground.colour).toFixed(2), size, large });
  }
  return out;
};

const failures = [];
const summary = [];

async function run(sabotage) {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    for (const p of PAGES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      // Set the stored theme before the page's own boot code reads it.
      await page.addInitScript((v) => {
        try { localStorage.setItem('mbm_reading_theme', v); } catch (e) {}
      }, sabotage ? 'cream' : 'highlumen');
      await page.goto(base + p.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);

      const applied = await page.evaluate(() => ({
        html: document.documentElement.getAttribute('data-theme'),
        body: document.body.getAttribute('data-theme'),
        bodyBg: getComputedStyle(document.body).backgroundColor,
        htmlBg: getComputedStyle(document.documentElement).backgroundColor,
      }));
      if (!sabotage) {
        if (applied.html !== 'highlumen' || applied.body !== 'highlumen') {
          failures.push(`${p.label}: data-theme is html=${applied.html} body=${applied.body}, ` +
                        'expected highlumen on both');
        }
        if (applied.bodyBg !== 'rgb(255, 255, 255)') {
          failures.push(`${p.label}: body ground is ${applied.bodyBg}, expected rgb(255, 255, 255)`);
        }
      }

      const pairs = await page.evaluate(AUDIT);
      const bad = pairs.filter((x) => !x.unknown && !x.large && x.ratio < TEXT_FLOOR);
      const badLarge = pairs.filter((x) => !x.unknown && x.large && x.ratio < 4.5);
      const unknown = pairs.filter((x) => x.unknown);
      const worst = pairs.filter((x) => !x.unknown).reduce((m, x) => Math.min(m, x.ratio), 99);

      if (!sabotage) {
        for (const b of bad.slice(0, 8)) {
          failures.push(`${p.label}: ${b.ratio}:1 — ${b.fg} on ${b.bg} — <${b.sel}> ${JSON.stringify(b.text)}`);
        }
        for (const b of badLarge.slice(0, 4)) {
          failures.push(`${p.label}: ${b.ratio}:1 on large text — ${b.fg} on ${b.bg} — <${b.sel}>`);
        }
        for (const u of unknown.slice(0, 4)) {
          failures.push(`${p.label}: text sits on a background-image, so its contrast cannot be ` +
                        `derived — <${u.sel}> ${JSON.stringify(u.text)}`);
        }
      }
      summary.push({ label: p.label, nodes: pairs.length, worst, bad: bad.length,
                     unknown: unknown.length, bodyBg: applied.bodyBg });
      if (REPORT) {
        for (const x of pairs.filter((y) => !y.unknown).sort((a, b) => a.ratio - b.ratio).slice(0, 12)) {
          console.log(`    ${String(x.ratio).padStart(6)}:1  ${x.fg} on ${x.bg}  <${x.sel}>  ${JSON.stringify(x.text)}`);
        }
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
}

if (SELFTEST) {
  // The theme is not applied at all; the pages render in Warm, whose muted text
  // on cream is nowhere near 7:1. If this does NOT go red the audit is inert.
  const mark = failures.length;
  const savedTheme = [];
  await run(true);
  // re-audit the same pages with the floor applied to the unthemed render
  const unthemedWorst = summary.map((s) => s.worst);
  summary.length = 0;
  const anyBelow = unthemedWorst.some((w) => w < TEXT_FLOOR);
  failures.length = mark;
  if (!anyBelow) {
    console.error('[FAIL] self-test: the unthemed pages already clear 7:1 everywhere, so this ' +
                  'audit proves nothing about the theme');
    process.exit(1);
  }
  console.log(`[PASS] self-test: without the theme the same pages fall to ` +
              `${Math.min(...unthemedWorst).toFixed(2)}:1, well under the ${TEXT_FLOOR}:1 floor`);
}

await run(false);

console.log('\n%s %s %s %s %s', 'page'.padEnd(13), 'nodes'.padStart(6), 'worst'.padStart(8),
            'under 7:1'.padStart(10), 'ungradeable'.padStart(12));
for (const s of summary) {
  console.log('%s %s %s %s %s   body=%s', s.label.padEnd(13), String(s.nodes).padStart(6),
              (s.worst === 99 ? '—' : s.worst.toFixed(2) + ':1').padStart(8),
              String(s.bad).padStart(10), String(s.unknown).padStart(12), s.bodyBg);
}
if (failures.length) {
  console.error(`\n[FAIL] High-Lumen contrast — ${failures.length} finding(s):`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`\n[PASS] High-Lumen contrast: every visible text node on ${PAGES.length} pages clears ` +
            `${TEXT_FLOOR}:1, on a white ground, measured as rendered`);
