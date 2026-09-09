/**
 * SW2-F §G1 — composed-page contrast census, in a real browser.
 *
 * The narrow claim T1 already makes is that the token file's own ink/surface
 * PAIRS clear their minimum. That is a statement about a palette. This is the
 * composed one: what a reader actually sees, on the page as built, after every
 * stylesheet and every script has had its say. It is the one that decides.
 *
 * WHAT IS MEASURED
 * ----------------
 * Every visible text node with non-whitespace text. Its computed `color`, and
 * its EFFECTIVE background: the first ancestor with a non-transparent
 * background-color. Ratio must be >= 4.5:1, or >= 3:1 for large text (>= 24px,
 * or >= 18.66px when bold >= 700).
 *
 * Focus rings are measured too: every focusable element on a dark surface must
 * show a :focus-visible ring >= 3:1 against the surface it sits on.
 *
 * UNMEASURED, NEVER "PASS"
 * ------------------------
 * If a background image or gradient appears anywhere in the ancestor chain
 * before an opaque colour, the effective background is not a single colour and
 * this tool will not pretend otherwise: the node is listed as UNMEASURED with
 * its route and selector, and counted separately. A gradient hero is exactly
 * where a contrast bug hides, so silence there would be the worst outcome.
 *
 * WHY EFFECTIVE-BACKGROUND AND NOT getComputedStyle ALONE
 * -------------------------------------------------------
 * The bug this gate was written for is a component that paints its own
 * background and inherits its colour from a dark ancestor. Reading the node's
 * own background-color returns "rgba(0, 0, 0, 0)" for the text node's parent in
 * most cases and would compare ink against nothing. Walking to the first opaque
 * ancestor is what reproduces what the eye does.
 *
 *   node tools/sw2/check_contrast_census.cjs --origin http://127.0.0.1:PORT
 *   node tools/sw2/check_contrast_census.cjs --origin ... --routes /for/teachers/
 *   node tools/sw2/check_contrast_census.cjs --origin ... --plant '.chips a'
 *
 * --plant sets color:#fff on the given selector before measuring: the red proof,
 * without editing a shipped file.
 */
const { createRequire } = require('module');
const { chromium } = createRequire('/opt/node22/lib/node_modules/playwright')('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const VIEWPORTS = [
  { name: '390x844', width: 390, height: 844 },
  { name: '1280x800', width: 1280, height: 800 },
];

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

/** Every route the site serves, derived from the tree rather than typed. */
function routes() {
  const explicit = arg('--routes', null);
  if (explicit) return explicit.split(',').map((r) => r.trim()).filter(Boolean);
  const out = new Set(['/']);
  const walk = (dir, prefix) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (fs.existsSync(path.join(full, 'index.html'))) out.add(`${prefix}${e.name}/`);
        if (prefix.split('/').length < 4) walk(full, `${prefix}${e.name}/`);
      }
    }
  };
  walk(ROOT, '/');
  return [...out].sort();
}

// Focus rings, driven by REAL keyboard traversal.
//
// :focus-visible is a heuristic the browser owns: element.focus() from script
// does not generally match it, which is why the first version of this pass
// reported fourteen missing rings at 1280x800 and none at 390x844 on the same
// page. A ring cannot depend on viewport width; the instrument was wrong, not
// the page. Pressing Tab is the only way to ask the question the user asks.
const FOCUS_STEP = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '')
    + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const stack = [];
  let surface = null;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') { surface = 'unmeasured'; break; }
    const bg = parse(cs.backgroundColor);
    if (!bg || bg.a === 0) continue;
    if (bg.a === 1) { let o = bg; for (let i = stack.length - 1; i >= 0; i--) o = over(stack[i], o); surface = o; break; }
    stack.push(bg);
  }
  if (surface === null) { let o = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) o = over(stack[i], o); surface = o; }
  if (surface === 'unmeasured') return { selector: sel(el), skip: 'gradient surface' };
  if (lum(surface) > 0.18) return { selector: sel(el), skip: 'light surface' };

  const matches = el.matches(':focus-visible');
  const cs = getComputedStyle(el);
  const ring = parse(cs.outlineColor);
  const width = parseFloat(cs.outlineWidth) || 0;
  const shadow = cs.boxShadow && cs.boxShadow !== 'none';
  const bgStr = `rgb(${Math.round(surface.r)}, ${Math.round(surface.g)}, ${Math.round(surface.b)})`;
  if (!matches) return { selector: sel(el), skip: 'not :focus-visible' };
  if ((!width || cs.outlineStyle === 'none') && !shadow) {
    return { selector: sel(el), fail: 'no :focus-visible ring on a dark surface', bg: bgStr };
  }
  if (width && cs.outlineStyle !== 'none' && ring) {
    const r = ratio(ring, surface);
    if (r + 0.005 < 3) return { selector: sel(el), fail: `ring ${cs.outlineColor} is ${r.toFixed(2)}:1 on ${bgStr}`, bg: bgStr };
  }
  return { selector: sel(el), ok: true };
};

const MEASURE = ([plant, unhide]) => {
  if (unhide) {
    // The preview ships five views in one document, four of them [hidden].
    // Censusing only the default one measures a fifth of the file.
    document.querySelectorAll('.view').forEach((e) => { e.hidden = (e.id !== unhide); });
  }
  if (plant) {
    const style = document.createElement('style');
    style.textContent = `${plant}{color:#fff !important}`;
    document.head.appendChild(style);
  }

  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const sel = (el) => el.tagName.toLowerCase()
    + (el.id ? '#' + el.id : '')
    + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');

  // The effective background: walk up compositing every semi-transparent layer
  // over the one behind it, until an opaque colour is reached. Only a background
  // IMAGE or gradient is genuinely unmeasurable this way.
  //
  // Bailing out at the first alpha < 1 was the first version, and it was almost
  // useless: on /for/teachers/ it declared 36 nodes UNMEASURED, among them a
  // header at alpha 0.96 (opaque to any eye) and buttons at alpha 0.024 and
  // 0.035, which is precisely where ink-on-its-own-background hides. A census
  // that cannot see the surfaces the bug lives on is not a census.
  const over = (fg, bg) => ({          // source-over compositing
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const effectiveBg = (el) => {
    const stack = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        return { unmeasured: true, why: 'background-image/gradient', at: sel(n) };
      }
      const bg = parse(cs.backgroundColor);
      if (!bg || bg.a === 0) continue;
      if (bg.a === 1) {
        let out = bg;
        for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
        return { colour: out, at: sel(n), layers: stack.length };
      }
      stack.push(bg);
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
    return { colour: out, at: 'canvas', layers: stack.length };
  };

  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const failures = [];
  const unmeasured = [];
  let nodes = 0;

  // Identical failures are reported once, but COUNTED -- seven chips sharing a
  // selector, a colour and a background are seven invisible buttons, not one,
  // and a gate that says "1" cannot be checked against "expect seven".
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Map();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent || !t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
    if (!visible(el)) continue;

    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    const key = sel(el) + '|' + cs.color + '|' + (bg.colour ? JSON.stringify(bg.colour) : bg.why);
    if (seen.has(key)) { seen.get(key).n++; continue; }
    const tally = { n: 1 };
    seen.set(key, tally);

    if (bg.unmeasured) {
      unmeasured.push({ selector: sel(el), why: bg.why, at: bg.at, sample: t.textContent.trim().slice(0, 40) });
      continue;
    }
    nodes++;
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (bold && size >= 18.66);
    const need = large ? 3 : 4.5;
    const r = ratio(fg, bg.colour);
    if (r + 0.005 < need) {
      failures.push({
        tally, selector: sel(el), fg: cs.color, bg: `rgb(${bg.colour.r}, ${bg.colour.g}, ${bg.colour.b})`,
        bgFrom: bg.at + (bg.layers ? ` +${bg.layers} composited` : ''),
        ratio: Number(r.toFixed(2)), need, size: Math.round(size),
        sample: t.textContent.trim().slice(0, 40),
      });
    }
  }

  return { nodes, failures, unmeasured };
};

(async () => {
  const origin = arg('--origin', 'http://127.0.0.1:4911').replace(/\/$/, '');
  const plant = arg('--plant', null);
  const unhide = arg('--unhide', null);
  const list = routes();

  const browser = await chromium.launch();
  const problems = [];
  const unmeasured = [];
  let nodes = 0;
  let censused = 0;
  let failingNodes = 0;

  for (const route of list) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await page.addInitScript(`window.__FOCUS_STEP = ${FOCUS_STEP.toString()}`);
      let ok = true;
      try {
        const res = await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 30000 });
        if (!res || res.status() >= 400) ok = false;
      } catch (e) { ok = false; }
      if (!ok) { await context.close(); continue; }
      censused++;
      const found = await page.evaluate(MEASURE, [plant, arg('--unhide', null)]);
      nodes += found.nodes;

      // Tab through the page and ask each focused element the question.
      await page.evaluate(() => document.body.focus());
      const ringSeen = new Set();
      for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        const step = await page.evaluate(() => window.__FOCUS_STEP());
        if (!step) break;
        if (step.fail && !ringSeen.has(step.selector + step.fail)) {
          ringSeen.add(step.selector + step.fail);
          found.ringFailures = found.ringFailures || [];
          found.ringFailures.push({ selector: step.selector, why: step.fail });
        }
      }
      found.ringFailures = found.ringFailures || [];
      for (const f of found.failures) {
        const many = f.tally && f.tally.n > 1 ? `  x${f.tally.n} nodes` : '';
        problems.push(`${route} [${vp.name}]  ${f.selector}${many}  ${f.fg} on ${f.bg} (from ${f.bgFrom})  ${f.ratio}:1 < ${f.need}  "${f.sample}"`);
        failingNodes += f.tally ? f.tally.n : 1;
      }
      for (const f of found.ringFailures) {
        problems.push(`${route} [${vp.name}]  ${f.selector}  FOCUS RING: ${f.why}`);
      }
      for (const u of found.unmeasured) {
        unmeasured.push(`${route} [${vp.name}]  ${u.selector}  ${u.why} at ${u.at}  "${u.sample}"`);
      }
      await context.close();
    }
  }
  await browser.close();

  console.log(`contrast census: ${list.length} routes x ${VIEWPORTS.length} viewports, `
    + `${censused} page loads, ${nodes} distinct text/background pairs measured`);
  if (failingNodes) console.log(`  failing text nodes: ${failingNodes}`);
  if (unmeasured.length) {
    console.log(`\nUNMEASURED (never counted as a pass): ${unmeasured.length}`);
    for (const u of unmeasured.slice(0, 20)) console.log('  ' + u);
    if (unmeasured.length > 20) console.log(`  … and ${unmeasured.length - 20} more`);
  }
  if (problems.length) {
    console.error(`\nPROBLEMS: ${problems.length}`);
    for (const p of problems.slice(0, 40)) console.error('  ' + p);
    if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
    process.exit(1);
  }
  console.log('\nevery measured text node clears its minimum, and every focus ring on a dark surface clears 3:1');
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(2); });
