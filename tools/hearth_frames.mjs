/* hearth_frames.mjs — before/after frame pairs for a human eye.
 *
 * Numbers say the rate went from 2.5 to 0.83 peaks/sec and the swing came down.
 * They do not say whether it reads as fire. This writes six pairs across four
 * seconds so Matt can see the character change without loading the game.
 *
 * Both builds are driven from the SAME seeded scene on the SAME deterministic
 * virtual clock, so a pair is genuinely the same moment in two builds rather
 * than two arbitrary moments.
 *
 *   node tools/hearth_frames.mjs --before <path> --after <path> --out <dir>
 */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE_DIR || path.join(HERE, '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const BEFORE = arg('before', null);
const AFTER = arg('after', 'luminahaven/index.html');
const OUT = arg('out', '/tmp/hearth-frames');
const TIMES = [0.0, 0.8, 1.6, 2.4, 3.2, 4.0];
/* Passed in from the measurement run rather than typed here. A caption is a
   claim, and a hard-coded one goes stale the first time the tuning moves —
   this sheet carried "0.83/sec" for a build that measured 1.33. */
const RATE_BEFORE = arg('rate-before', '?');
const RATE_AFTER = arg('rate-after', '?');
const FPS = 60;

const SCENE = JSON.stringify({
  palette: 'hearth', weather: 'sunny', autoLight: false, selectedId: null,
  objects: [{ type: 'fireplace', name: 'Tiny Hearth', id: 1, u: 0.5, v: 0.55, rot: 0, tint: '#6a6675' }],
  nodes: [{ id: 'n1', kind: 'quartz', u: 0.06, v: 0.99, phase: 0 }]
});

function serve(root) {
  const srv = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function shoot(browser, base, file, label) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch (_) {} },
    ['mbm_lumina_haven_state_v1', SCENE]);
  await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await page.evaluate(async () => { document.getElementById('startBtn').click(); await new Promise(r => setTimeout(r, 350)); });
  const shots = await page.evaluate(async ({ times, fps }) => {
    const cbs = [];
    window.requestAnimationFrame = cb => { cbs.push(cb); return cbs.length; };
    await new Promise(r => setTimeout(r, 80));
    const step = 1000 / fps;
    let t = performance.now();
    /* Settle the palette crossfade first, exactly as the measurement does, so
       the frames are of a hearth in a settled room rather than of a fade. */
    for (let i = 0; i < fps * 2; i++) {
      t += step;
      const b = cbs.splice(0, cbs.length);
      for (const cb of b) { try { cb(t); } catch (_) {} }
      if (i % 30 === 0) await new Promise(r => setTimeout(r, 0));
    }
    const c = document.getElementById('game');
    /* Crop to the hearth. A full 1000x720 room shrunk into a contact sheet
       hides the very thing being compared. */
    const cw = 260, ch = 220;
    const cx = Math.round(c.width * 0.5 - cw / 2), cy = Math.round(c.height * 0.42);
    const out = [];
    const last = Math.round(times[times.length - 1] * fps);
    let idx = 0;
    for (let i = 0; i <= last; i++) {
      if (idx < times.length && i >= Math.round(times[idx] * fps)) {
        const o = document.createElement('canvas');
        o.width = cw; o.height = ch;
        o.getContext('2d').drawImage(c, cx, cy, cw, ch, 0, 0, cw, ch);
        out.push(o.toDataURL('image/png'));
        idx++;
      }
      t += step;
      const b = cbs.splice(0, cbs.length);
      for (const cb of b) { try { cb(t); } catch (_) {} }
      if (i % 30 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return out;
  }, { times: TIMES, fps: FPS });
  await ctx.close();
  console.log(`${label}: ${shots.length} frames`);
  return shots;
}

/* The two builds live in different trees, so each gets its own root. */
const rootFor = f => (f.startsWith('/') ? path.dirname(path.dirname(f)) : ROOT);
const fileFor = f => (f.startsWith('/') ? path.join(path.basename(path.dirname(f)), path.basename(f)) : f);

const browser = await chromium.launch();
const srvA = await serve(rootFor(AFTER));
const after = await shoot(browser, `http://127.0.0.1:${srvA.address().port}`, fileFor(AFTER), 'after');
srvA.close();
let before = null;
if (BEFORE) {
  const srvB = await serve(rootFor(BEFORE));
  before = await shoot(browser, `http://127.0.0.1:${srvB.address().port}`, fileFor(BEFORE), 'before');
  srvB.close();
}

fs.mkdirSync(OUT, { recursive: true });
const write = (d, name) => fs.writeFileSync(path.join(OUT, name), Buffer.from(d.split(',')[1], 'base64'));
after.forEach((d, i) => write(d, `after-t${TIMES[i].toFixed(1)}s.png`));
if (before) before.forEach((d, i) => write(d, `before-t${TIMES[i].toFixed(1)}s.png`));

/* The waveform, plotted from the two builds' own formulas.
   SIX STILLS SHOW AMPLITUDE, NOT RHYTHM — and rhythm is the whole change. A
   regular pulse and an irregular flicker can look identical in a sampled strip
   while feeling completely different in motion, so the trace goes on the sheet
   too and the character change becomes visible in a still image. */
function traces(seconds, fps) {
  const H = i => { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
  const O = (t, f) => { const x = t * f, i = Math.floor(x), fr = x - i, u = fr * fr * (3 - 2 * fr); return H(i) * (1 - u) + H(i + 1) * u; };
  const N = t => O(t, 1.00) * 0.44 + O(t, 2.30) * 0.22 + O(t, 5.50) * 0.34;
  const dt = 1 / fps;
  const oldT = [], newT = [];
  let lvl = 0.62;
  /* Two settle seconds first, so the trace lines up with the frames above. */
  for (let i = 0; i < fps * (seconds + 2); i++) {
    const t = i * dt;
    const calm = 0.55 + 0.45 * O(t, 0.12);
    const target = Math.max(0, Math.min(1, 0.5 + (N(t) - 0.5) * calm * 3.2));
    const tau = target > lvl ? 0.032 : 0.09;
    lvl += (target - lvl) * (1 - Math.exp(-dt / tau));
    if (i >= fps * 2) {
      newT.push(0.62 + lvl * 0.38);
      oldT.push(0.8 + Math.sin(t * 8) * 0.12 + Math.sin(t * 17) * 0.08);
    }
  }
  return { oldT, newT };
}
function svgTrace(vals, colour, w, h) {
  const lo = 0.55, hi = 1.02;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - (v - lo) / (hi - lo) * h).toFixed(1)}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">
    <polyline points="${pts}" fill="none" stroke="${colour}" stroke-width="1.6"/></svg>`;
}

/* One contact sheet, so the comparison is a single image. */
if (before) {
  const tr = traces(4.0, FPS);
  const page = await (await browser.newContext({ viewport: { width: 1660, height: 780 } })).newPage();
  const html = `<body style="margin:0;background:#120d16;font:13px system-ui;color:#e8dcf0">
  <div style="padding:14px 16px 6px;font-weight:700;letter-spacing:.02em">Lumina Haven — Tiny Hearth, same six moments in both builds</div>
  <div style="display:grid;grid-template-columns:76px repeat(6,246px);gap:8px;padding:8px 16px;align-items:center">
    <div></div>${TIMES.map(t => `<div style="text-align:center;opacity:.65">t = ${t.toFixed(1)}s</div>`).join('')}
    <div style="opacity:.75">BEFORE<br><span style="opacity:.6;font-size:11px">${RATE_BEFORE}/sec<br>regular</span></div>
    ${before.map(d => `<img src="${d}" style="width:246px;border-radius:8px;display:block">`).join('')}
    <div style="opacity:.75">AFTER<br><span style="opacity:.6;font-size:11px">${RATE_AFTER}/sec<br>irregular</span></div>
    ${after.map(d => `<img src="${d}" style="width:246px;border-radius:8px;display:block">`).join('')}
  </div>
  <div style="padding:10px 16px 4px;opacity:.7">Flame scale over the same four seconds — the change is the rhythm, which six stills cannot show</div>
  <div style="display:grid;grid-template-columns:76px 1524px;gap:8px;padding:0 16px 14px;align-items:center">
    <div style="opacity:.75;font-size:11px">BEFORE</div><div style="background:rgba(255,255,255,.04);border-radius:8px">${svgTrace(tr.oldT, '#ff9a6b', 1524, 84)}</div>
    <div style="opacity:.75;font-size:11px">AFTER</div><div style="background:rgba(255,255,255,.04);border-radius:8px">${svgTrace(tr.newT, '#ffc46b', 1524, 84)}</div>
  </div></body>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(OUT, 'hearth-before-after.png'), fullPage: true });
  console.log('contact sheet: hearth-before-after.png');
}
await browser.close();
console.log(`wrote ${fs.readdirSync(OUT).length} files to ${OUT}`);
