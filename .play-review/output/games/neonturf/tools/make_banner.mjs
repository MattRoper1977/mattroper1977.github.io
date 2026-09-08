/* Renders neonturf/banner.png at exactly 1200x630 from the game's OWN palette
   tokens and its OWN arena names, both read out of index.html so the card
   cannot drift from the game. No stock imagery, nothing fetched. */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const pick = n => { const m = game.match(new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{6})`)); if (!m) throw new Error(`token --${n} missing`); return m[1]; };
const P = { cyan: pick('cyan'), pink: pick('pink'), gold: pick('gold'), ink: pick('ink'), text: pick('text') };
const i = game.indexOf('const ARENAS');
const arenas = [...game.slice(i, i + 1400).matchAll(/name:'([A-Za-z ]+)'/g)].map(m => m[1]).slice(0, 3);
if (arenas.length !== 3) throw new Error(`expected 3 arenas, derived ${arenas.length}`);
console.log('palette', P); console.log('arenas', arenas.join(' · '));
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:${P.ink};font-family:Inter,ui-sans-serif,system-ui,"Segoe UI",sans-serif;color:${P.text}}
.wrap{position:relative;width:1200px;height:630px;background:radial-gradient(ellipse at 50% 120%,rgba(40,244,255,.16),${P.ink} 60%);display:flex;flex-direction:column;justify-content:center;padding:0 84px}
.grid{position:absolute;inset:0;opacity:.5;
 background-image:linear-gradient(${P.cyan}22 1px,transparent 1px),linear-gradient(90deg,${P.cyan}22 1px,transparent 1px);
 background-size:56px 56px;transform:perspective(600px) rotateX(58deg) scale(1.7);transform-origin:50% 100%}
.turf{position:absolute;left:0;top:0;width:47%;height:100%;background:linear-gradient(90deg,${P.pink}22,transparent);}
.turf2{position:absolute;right:0;top:0;width:38%;height:100%;background:linear-gradient(270deg,${P.cyan}22,transparent);}
.ball{position:absolute;left:80%;top:26%;width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fff,${P.gold});box-shadow:0 0 40px ${P.gold}cc,0 0 90px ${P.gold}55}
.brand{position:relative;font-size:19px;font-weight:900;letter-spacing:.30em;text-transform:uppercase;color:${P.cyan};text-shadow:0 0 26px ${P.cyan}88}
h1{position:relative;font-size:104px;line-height:.86;font-weight:950;letter-spacing:-.04em;text-transform:uppercase;margin:14px 0 4px;
 background:linear-gradient(100deg,#fff 6%,${P.cyan} 38%,${P.pink} 78%);-webkit-background-clip:text;background-clip:text;color:transparent}
h2{position:relative;font-size:39px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:${P.pink};margin-bottom:24px}
.rows{position:relative;display:flex;gap:11px;margin-bottom:20px}
.r{padding:11px 19px;border-radius:999px;border:1.5px solid ${P.cyan}44;background:rgba(8,12,28,.8);font-size:18px;font-weight:800}
.foot{position:relative;font-size:21px;color:#9fb2d0;letter-spacing:.04em}
.rule{position:absolute;left:0;bottom:0;height:9px;width:1200px;background:linear-gradient(90deg,${P.cyan},${P.pink},${P.gold})}
</style></head><body><div class="wrap">
<div class="grid"></div><div class="turf"></div><div class="turf2"></div><div class="ball"></div>
<div class="brand">Made by Matt</div>
<h1>Neon Turf</h1><h2>Overdrive</h2>
<div class="rows">${arenas.map(a => `<div class="r">${a}</div>`).join('')}</div>
<div class="foot">Rocket-car football &middot; paint the grid &middot; win the turf tiebreak</div>
<div class="rule"></div>
</div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: 'load' });
await p.screenshot({ path: path.join(ROOT, 'banner.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await b.close();
const buf = fs.readFileSync(path.join(ROOT, 'banner.png'));
const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
console.log(`banner.png ${w}x${h}, ${buf.length} bytes`);
if (w !== 1200 || h !== 630) { console.error('WRONG DIMENSIONS'); process.exit(1); }
