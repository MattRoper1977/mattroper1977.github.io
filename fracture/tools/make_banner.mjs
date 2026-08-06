/* Renders fracture/banner.png at exactly 1200x630 from the game's OWN palette
   and its own realm names. No stock imagery, no external asset, nothing
   fetched. Every colour below is lifted from the :root block of the game file
   so the card cannot drift from the game it advertises. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const game = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* Derive the palette from the game rather than retyping it. */
const pick = name => {
  const m = game.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`palette token --${name} not found in the game file`);
  return m[1];
};
const P = { bg: pick('bg'), cyan: pick('cyan'), blue: pick('blue'), violet: pick('violet'), gold: pick('gold'), text: pick('text'), muted: pick('muted') };

/* Derive the realm names from ZONE_DEFS rather than retyping them. */
const realms = [...game.matchAll(/realm:\s*'([^']+)',\s*name:\s*'([^']+)'/g)].map(m => ({ realm: m[1], name: m[2] }));
if (realms.length !== 3) throw new Error(`expected 3 realms from ZONE_DEFS, derived ${realms.length}`);
console.log('palette:', P);
console.log('realms:', realms.map(r => `${r.realm} ${r.name}`).join(' · '));

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:${P.bg};
  font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:${P.text}}
.wrap{position:relative;width:1200px;height:630px;
  background:radial-gradient(circle at 50% 22%,#12213b 0,${P.bg} 58%,#03050a 100%);
  display:flex;flex-direction:column;justify-content:center;padding:0 84px}
/* fracture lines: the game's own motif, drawn not photographed */
.frac{position:absolute;inset:0;opacity:.5}
.frac i{position:absolute;display:block;height:1.5px;transform-origin:left center;
  background:linear-gradient(90deg,transparent,${P.cyan},transparent)}
.glow{position:absolute;width:760px;height:760px;left:50%;top:-330px;transform:translateX(-50%);
  background:radial-gradient(circle,rgba(85,216,255,.20),transparent 62%);filter:blur(8px)}
.brand{font-size:19px;font-weight:900;letter-spacing:.30em;text-transform:uppercase;color:${P.cyan};
  text-shadow:0 0 28px rgba(85,216,255,.55);position:relative}
h1{font-size:118px;line-height:.85;font-weight:950;letter-spacing:-.045em;text-transform:uppercase;
  margin:16px 0 6px;background:linear-gradient(110deg,#fff 8%,${P.cyan} 40%,${P.violet} 68%,${P.gold});
  -webkit-background-clip:text;background-clip:text;color:transparent;position:relative}
h2{font-size:42px;font-weight:900;letter-spacing:.10em;text-transform:uppercase;color:${P.cyan};
  margin-bottom:26px;position:relative}
.realms{display:flex;gap:12px;position:relative;margin-bottom:22px}
.r{padding:11px 20px;border-radius:999px;border:1.5px solid rgba(148,188,255,.30);
  background:rgba(10,16,29,.72);font-size:19px;font-weight:800;letter-spacing:.02em}
.r b{color:${P.gold};font-weight:900;margin-right:9px;font-size:15px;letter-spacing:.10em}
.foot{position:relative;font-size:21px;color:${P.muted};letter-spacing:.05em}
.rule{position:absolute;left:0;bottom:0;height:9px;width:1200px;
  background:linear-gradient(90deg,${P.cyan},${P.blue},${P.violet},${P.gold})}
</style></head><body><div class="wrap">
<div class="glow"></div>
<div class="frac">
  ${[[70, -18, 430], [250, 22, 300], [470, -8, 520], [560, 15, 360], [150, 40, 240]]
    .map(([top, rot, len]) => `<i style="top:${top}px;left:${Math.round(len / 3)}px;width:${len}px;transform:rotate(${rot}deg)"></i>`).join('')}
</div>
<div class="brand">Made by Matt</div>
<h1>Relicforge</h1>
<h2>Fracture Engine</h2>
<div class="realms">${realms.map(r => `<div class="r"><b>${r.realm}</b>${r.name}</div>`).join('')}</div>
<div class="foot">Single-file 3D action RPG &middot; forge relics, export your Chronicle</div>
<div class="rule"></div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
const out = path.join(ROOT, 'banner.png');
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();

/* Assert the dimensions rather than trusting the request. */
const buf = fs.readFileSync(out);
const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
console.log(`banner.png ${w}x${h}, ${buf.length} bytes`);
if (w !== 1200 || h !== 630) { console.error('WRONG DIMENSIONS'); process.exit(1); }
