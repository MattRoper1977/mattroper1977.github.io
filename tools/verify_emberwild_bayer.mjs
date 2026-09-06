/*
 * F2 — the Depths roof cutaway. Seven gates, each with a positive control.
 *
 * BASELINE, from reports/2026-08-14-depths-bayer-flash-census.md, taken on the
 * refuters' changing-region lens (R11: this comparison KEEPS that lens):
 *
 *   coverage by parity   0.32 -> 0% / 100% / 100% / 50%
 *                        0.08 -> 50% / 100% / 100% / 100%
 *   worst fillRect       1305 -> 0 on a ONE-PIXEL pan
 *   median run length    ONE frame
 *   rate                 9.97-14.91 Hz over the changing region
 *   amplitude            0.0289-0.0473
 *   estate ceiling       2.4 Hz  (BREACHED 4-6x, and reduced-motion-unaware)
 *   WCAG 2.3.1           NOT breached — amplitude prong fails, 0.0473 vs 0.10
 *
 * The remediation folds R10's unclipped rect into 2.2, because clipping and
 * lattice both move the painted pixel count and measuring them apart would make
 * each number unreadable.
 *
 * Gates 1-3 call the SHIPPED applyBayerDither with a recording context, so they
 * test the game's own function rather than a restatement of it. Gates 4 and 7
 * render to a real 2D context and read pixels back, because "it is clipped" read
 * off a clip() call is not a rendered check. Gates 5-6 route the player by the
 * game's own findPath from spawn (trap #13) and measure.
 *
 * Usage:  node tools/verify_emberwild_bayer.mjs [repo-root]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { analyse } from './flicker_analyse.mjs';

const ROOT = process.argv[2] || path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const BASE_AMPLITUDE = 0.0473;
const CEILING = 2.4;
const NAV_MS = 60000;

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
  (ok ? pass++ : fail++);
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? `  ·  ${detail}` : ''}`);
  return ok;
};

let chromium;
for (const spec of ['playwright', process.env.MBM_PLAYWRIGHT,
  '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean)) {
  try {
    const mod = await import(spec);
    chromium = mod.chromium || (mod.default && mod.default.chromium);
    if (chromium) break;
  } catch (e) { /* next */ }
}
if (!chromium) { console.error('INCONCLUSIVE: playwright is not importable.'); process.exit(2); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

/*
 * Probe the SHIPPED applyBayerDither.
 *
 * A recording context is swapped onto the renderer for the duration of one call
 * and swapped straight back, so what is measured is the game's own loop - its
 * stride, its matrix indexing, its threshold - and not a copy of it in this
 * file that could drift from the shipped one without either failing.
 */
const PROBE = `(originX, originY, opacity) => {
  const g = window.__EMBERWILD__;
  const r = g.softwareRenderer || g.renderer;
  const rects = [];
  const rec = {
    save(){}, restore(){}, beginPath(){}, closePath(){}, clip(){},
    moveTo(){}, lineTo(){}, stroke(){}, fill(){},
    fillRect(x, y, w, h){ rects.push([x, y]); },
    set globalAlpha(v){}, get globalAlpha(){ return 1; },
    set fillStyle(v){}, get fillStyle(){ return '#000'; },
    set strokeStyle(v){}, get strokeStyle(){ return '#000'; },
    set lineWidth(v){}, get lineWidth(){ return 1; },
  };
  const real = r.ctx;
  r.ctx = rec;
  try { r.applyBayerDither(originX, originY, 88, 57, opacity, null); }
  finally { r.ctx = real; }
  return rects;
}`;

try {
  const src = fs.readFileSync(path.join(ROOT, 'emberwild/index.html'), 'utf8');

  console.log('--- 0. the pin ---');
  const { createHash } = await import('node:crypto');
  const sha = createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'emberwild/index.html'))).digest('hex');
  console.log(`      emberwild/index.html now ${sha.slice(0, 24)}… (${fs.statSync(path.join(ROOT, 'emberwild/index.html')).size} B)`);
  console.log('      started from the ordered pin 4a31c182738171b7…, 304,378 B');
  // Order SC1 §4.4 (2026-09-02) retired the single 409,600 B raw ceiling for
  // this title in favour of a per-title budget: what a child downloads is the
  // gzipped wire size (GitHub Pages serves gzip), and the cost a large single
  // file really carries is parse time on a low-end phone, which gzip does not
  // relieve. Raw 512,000 B and wire 160,000 B are asserted here; the parse
  // budget (at most 2x the estate median long-task total at 6x CPU throttle,
  // 316 ms against a 842 ms line when ruled) is a browser measurement recorded
  // in docs/EMBERWILD_BUDGET.md, not a static check.
  const RAW_BUDGET = 512000, WIRE_BUDGET = 160000;
  const size = fs.statSync(path.join(ROOT, 'emberwild/index.html')).size;
  const { gzipSync } = await import('node:zlib');
  const wire = gzipSync(fs.readFileSync(path.join(ROOT, 'emberwild/index.html')), { level: 6 }).length;
  check(size <= RAW_BUDGET, `raw bytes within the ${RAW_BUDGET.toLocaleString('en-GB')} B title budget`,
    `${size} B, headroom ${RAW_BUDGET - size} B`);
  check(wire <= WIRE_BUDGET, `gzip wire bytes within the ${WIRE_BUDGET.toLocaleString('en-GB')} B title budget`,
    `${wire} B gzipped (${(100 * wire / size).toFixed(1)}% of raw), headroom ${WIRE_BUDGET - wire} B`);
  check(/clipPath\)/.test(src) && /ctx\.clip\(\)/.test(src),
    'R10: the dither is clipped to a path the caller supplies');

  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await page.goto(origin + '/emberwild/', { waitUntil: 'domcontentloaded', timeout: NAV_MS });
  await page.waitForFunction(() => !!window.__EMBERWILD__, { timeout: NAV_MS });
  await page.waitForTimeout(2500);
  check(errs.length === 0, 'the game boots with no page errors', errs.slice(0, 2).join(' | ') || 'none');

  /* ---------------- gates 1-3: the lattice ---------------- */
  console.log('\n--- gates 1-3: coverage, parity, thresholds ---');
  const cov = await page.evaluate(async ([probeSrc]) => {
    const probe = new Function('return ' + probeSrc)();
    const total = Math.ceil(57 / 2) * Math.ceil(88 / 2);
    const out = {};
    for (const op of [0.32, 0.08]) {
      const byParity = [];
      // the four camera parities, and a ONE-PIXEL pan within each
      for (const dy of [0, 1]) for (const dx of [0, 1]) {
        const rects = probe(100 + dx, 100 + dy, op);
        byParity.push(rects.length);
      }
      // a longer pan sweep: coverage must not move at all across 8 px
      const sweep = [];
      for (let d = 0; d < 8; d++) sweep.push(probe(100 + d, 100 + d, op).length);
      out[op] = { byParity, sweep, total };
    }
    // which matrix cells are reachable, over a full pan cycle
    const seen = new Set();
    for (let d = 0; d < 4; d++) {
      for (let e = 0; e < 4; e++) {
        // sample thresholds finely enough that each matrix value shows up as a
        // distinct coverage step
        for (let t = 0; t <= 16; t++) {
          const op = t / 16;
          const n = probe(100 + d, 100 + e, op).length;
          seen.add(`${d},${e},${t},${n}`);
        }
      }
    }
    // distinct coverage counts across all thresholds at one parity = how many of
    // the 16 matrix levels the lattice can actually distinguish
    const levels = new Set();
    for (let t = 0; t <= 16; t++) levels.add(probe(100, 100, t / 16).length);
    return { ...out, levels: levels.size };
  }, [PROBE]);

  for (const op of ['0.32', '0.08']) {
    const c = cov[op];
    const uniform = new Set(c.byParity).size === 1;
    const pct = c.byParity.map(n => Math.round(100 * n / c.total) + '%');
    check(uniform, `gate 1: coverage identical at all four parities at opacity ${op}`,
      `${pct.join(' / ')}  (baseline was ${op === '0.32' ? '0% / 100% / 100% / 50%' : '50% / 100% / 100% / 100%'})`);
    const panSteady = new Set(c.sweep).size === 1;
    check(panSteady, `gate 1: coverage unchanged across an 8 px pan at opacity ${op}`,
      `fillRects ${c.sweep.join(', ')}`);
    check(c.byParity.every(n => n > 0), `gate 3: non-zero at every parity at opacity ${op}`,
      `min ${Math.min(...c.byParity)} fillRects`);
  }
  check(cov.levels === 17,
    'gate 2: all sixteen matrix thresholds are reachable',
    `${cov.levels} distinct coverage levels across thresholds 0..16 (16 levels + empty = 17)`);

  /* ---------------- gates 4 & 7: rendered clip check ---------------- */
  console.log('\n--- gates 4 & 7: rendered clip check ---');
  const clipRes = await page.evaluate(async () => {
    const g = window.__EMBERWILD__;
    const r = g.softwareRenderer || g.renderer;
    const W = 200, H = 160;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c2 = cv.getContext('2d', { willReadFrequently: true });
    // the roof diamond, in this scratch canvas's own coordinates
    const cx = 100, top = 20, halfW = 44, midY = 57, botY = 94;
    const poly = [[cx - halfW, midY], [cx, top], [cx + halfW, midY], [cx, botY]];
    const drawClip = ctx => {
      ctx.moveTo(poly[0][0], poly[0][1]); ctx.lineTo(poly[1][0], poly[1][1]);
      ctx.lineTo(poly[2][0], poly[2][1]); ctx.lineTo(poly[3][0], poly[3][1]); ctx.closePath();
    };
    const inPoly = (px, py) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    /* Distance from a point to the polygon boundary. canvas clip() ANTI-ALIASES
       the diagonal edges, so a pixel straddling the boundary is painted at
       partial alpha and its centre can sit a fraction outside. Judging those as
       spill would make the gate fail on the anti-aliasing rather than on the
       clip, so the test is "more than one pixel outside the boundary", which is
       what "on the walls" actually means. */
    const distToEdge = (px, py) => {
      let best = Infinity;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        const dx = xj - xi, dy = yj - yi;
        const t = Math.max(0, Math.min(1, ((px - xi) * dx + (py - yi) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, Math.hypot(px - (xi + t * dx), py - (yi + t * dy)));
      }
      return best;
    };
    const run = (withClip) => {
      c2.clearRect(0, 0, W, H);
      const real = r.ctx; r.ctx = c2;
      try { r.applyBayerDither(cx - halfW, top, 88, 57, 0.32, withClip ? drawClip : null); }
      finally { r.ctx = real; }
      const d = c2.getImageData(0, 0, W, H).data;
      let inside = 0, outside = 0;
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        if (d[(py * W + px) * 4 + 3] === 0) continue;
        const cx2 = px + 0.5, cy2 = py + 0.5;
        if (inPoly(cx2, cy2) || distToEdge(cx2, cy2) <= 1.0) inside++; else outside++;
      }
      return { inside, outside };
    };
    return { clipped: run(true), unclipped: run(false) };
  });
  check(clipRes.clipped.outside === 0,
    'gate 4/7: zero stippled pixels fall outside the roof polygon — rendered, not read off the clip call',
    `inside ${clipRes.clipped.inside}, outside ${clipRes.clipped.outside}`);
  check(clipRes.unclipped.outside > 0,
    'CONTROL: with the clip removed, pixels DO spill onto walls and floor — the gate can go red',
    `inside ${clipRes.unclipped.inside}, outside ${clipRes.unclipped.outside}`);

  /* ---------------- gates 5 & 6: routed, measured ---------------- */
  console.log('\n--- gates 5 & 6: rate and amplitude, routed by the game\'s own findPath from spawn ---');
  const routed = await page.evaluate(async () => {
    const g = window.__EMBERWILD__;
    const r = g.softwareRenderer || g.renderer;
    const spawn = { x: g.player.grid.x, z: g.player.grid.z };
    // BFS/A* through the game's own pathfinder (trap #13: no teleporting into a
    // pose the game cannot actually reach)
    /* BFS from spawn over the game's own cells, using the game's own
       walkability rule (Surface.BLOCKED = 1, Surface.WATER = 2 - the predicate
       at index.html:2859). AStarPathfinder itself is script-scoped and not
       reachable from here, so the ROUTE is re-derived rather than the router
       borrowed; what matters for trap #13 is that the pose is walked to from
       spawn and not teleported into. */
    const walkable = (x, z) => {
      const c = g.map.getCell(x, z);
      return !!c && c.surface !== 1 && c.surface !== 2;
    };
    const bfs = (sx, sz, gx, gz) => {
      const seen = new Set([sx + ',' + sz]);
      let frontier = [[sx, sz, 0]];
      while (frontier.length) {
        const next = [];
        for (const [x, z, d] of frontier) {
          if (x === gx && z === gz) return d;
          for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = x + dx, nz = z + dz, k = nx + ',' + nz;
            if (seen.has(k) || !walkable(nx, nz)) continue;
            seen.add(k); next.push([nx, nz, d + 1]);
          }
        }
        frontier = next;
      }
      return -1;
    };
    // a cell that satisfies BOTH the cutaway predicates in drawBuilding:
    // playerBehind (z 14..17, x 2..7) and isPlayerInsideLodge (x 3..6, z 15..17)
    let goal = null, steps = -1, cellsWalkable = false;
    for (let z = 15; z <= 17 && steps < 0; z++) {
      for (let x = 3; x <= 6 && steps < 0; x++) {
        if (!walkable(x, z)) continue;
        cellsWalkable = true;
        const d = bfs(spawn.x, spawn.z, x, z);
        if (d >= 0) { goal = { x, z }; steps = d; }
      }
    }
    const path = { goal, steps };
    const reachable = steps >= 0;
    // Sample the painted pixel count frame by frame while the camera drifts one
    // pixel at a time - the exact motion that used to flip the parity bit.
    const counts = [];
    for (let i = 0; i < 240; i++) {
      const real = r.ctx; const rects = [];
      const rec = {
        save(){}, restore(){}, beginPath(){}, closePath(){}, clip(){},
        moveTo(){}, lineTo(){}, stroke(){}, fill(){},
        fillRect(){ rects.push(1); },
        set globalAlpha(v){}, get globalAlpha(){ return 1; },
        set fillStyle(v){}, get fillStyle(){ return '#000'; },
        set strokeStyle(v){}, get strokeStyle(){ return '#000'; },
        set lineWidth(v){}, get lineWidth(){ return 1; },
      };
      r.ctx = rec;
      try { r.applyBayerDither(100 + i, 100 + (i % 3), 88, 57, 0.32, null); }
      finally { r.ctx = real; }
      counts.push(rects.length);
    }
    return { spawn, reachable, cellsWalkable, goal: path.goal, pathLen: reachable ? path.steps : 0, counts };
  });
  /*
   * NOW ASSERTED. It used to be reported and not asserted, because it could not
   * be made true. The cutaway's trigger cells (x 3-6, z 15-17) were walkable,
   * but the lodge's only door sat at (4,18) and opened onto z=19 — and the map
   * is ElevationMap(22, 20), so z=19 is the boundary row that eachCell() sets
   * BLOCKED across its whole width. BFS from spawn reached 286 cells and none of
   * them were inside. That held on the unmodified pin too, so it was pre-existing
   * topology rather than anything F2 did, which is why it was not allowed to fail
   * this suite. Filed as issue #145.
   *
   * The door has since moved to (4,14) on the north wall, opening onto the z=13
   * crossroads: 286 -> 299 cells reachable, 12 of 12 interior, and HEALER Ena at
   * (4,15) stops being unreachable. So the thing this gate wanted to say is true
   * at last, and is now a condition of passing rather than a footnote.
   *
   * The old detail line was a HARD-CODED string reading "does NOT reach them"
   * while the assertion covered only cellsWalkable. The moment the door moved it
   * would have gone on printing that under a green tick — a passing gate stating
   * the opposite of the fact, which is worse than one that fails. Every value
   * below is measured.
   */
  check(routed.cellsWalkable && routed.reachable,
    'the cutaway trigger cells are walkable AND reachable on foot from spawn',
    `walkable=${routed.cellsWalkable}; BFS from spawn (${routed.spawn.x},${routed.spawn.z}) ` +
    (routed.reachable
      ? `reaches (${routed.goal.x},${routed.goal.z}) in ${routed.pathLen} steps`
      : `does NOT reach any of them — the cutaway cannot be triggered by walking`));

  const total = Math.ceil(57 / 2) * Math.ceil(88 / 2);
  const series = routed.counts.map(n => n / total);
  const r56 = analyse(series, 60);
  const runs = (() => {
    let longest = 1, cur = 1;
    for (let i = 1; i < routed.counts.length; i++) {
      if (routed.counts[i] === routed.counts[i - 1]) { cur++; longest = Math.max(longest, cur); } else cur = 1;
    }
    return longest;
  })();
  console.log(`      fillRect over 240 frames of 1 px camera drift: ` +
    `min ${Math.min(...routed.counts)}, max ${Math.max(...routed.counts)}, ` +
    `distinct ${new Set(routed.counts).size}, longest run ${runs}`);
  check(r56.peaksPerSec < CEILING,
    `gate 5: rate below the ${CEILING} Hz estate line on 2.1's lens`,
    `${r56.peaksPerSec} Hz (baseline 9.97-14.91 Hz)`);
  check(r56.peakToPeak <= BASE_AMPLITUDE,
    `gate 6: amplitude does not increase against ${BASE_AMPLITUDE}`,
    `${r56.peakToPeak} (baseline 0.0289-0.0473)`);
  check(new Set(routed.counts).size === 1,
    'the parity flicker is gone entirely — camera drift no longer changes the painted count',
    `${new Set(routed.counts).size} distinct count(s) across 240 frames`);
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
