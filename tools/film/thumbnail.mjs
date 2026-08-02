/* Thumbnail (YouTube) and poster (the site's click-to-load facade), 1280x720.
 *
 * The background is a REAL frame of real gameplay, not a mock-up and not
 * generated. Text is kept to four words because the thing has to survive being
 * shown 168 px wide in a sidebar.
 *
 * The standing lesson here is the Evening Workshop banner, which shipped with
 * baked-in gibberish nobody read at full size. Both outputs are OCR'd by
 * tools/film/ocr_inventory.py before they go anywhere.
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const RAW = process.argv[2] || '/tmp/claude-0/film/raw';
const OUT = process.argv[3] || '/tmp/claude-0/film/out';
fs.mkdirSync(OUT, { recursive: true });

const bg = fs.readFileSync(RAW + '/apex-flight.png').toString('base64');
const P = { navy: '#161D3D', deep: '#0F1530', mint: '#B9E6CD', amber: '#F2A24A', cream: '#E8E2D4' };
const FONT = `Poppins,"Segoe UI",system-ui,sans-serif`;
const MARK = s => `<svg viewBox="0 0 100 100" width="${s}" height="${s}">
<rect width="100" height="100" rx="22" fill="${P.deep}"/>
<path d="M26 76 L26 30 L50 55 L74 30 L74 76" fill="none" stroke="${P.cream}"
 stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const page = (headline, sub) => `<!doctype html><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;font-family:${FONT};overflow:hidden}
body{position:relative;background:#000}
.shot{position:absolute;inset:0;background:url(data:image/png;base64,${bg}) center/cover no-repeat}
.scrim{position:absolute;inset:0;background:linear-gradient(100deg,
  rgba(15,21,48,.97) 0%, rgba(15,21,48,.93) 46%, rgba(15,21,48,.42) 70%, rgba(15,21,48,.06) 100%)}
.txt{position:absolute;left:64px;top:50%;transform:translateY(-50%);width:800px}
/* nowrap: the first cut broke NO SIGN-UP across the hyphen into three lines,
   which is invisible at full size and unreadable at 168 px. */
.h{font-size:92px;font-weight:900;color:${P.cream};line-height:1.02;letter-spacing:-.015em;white-space:nowrap}
.h em{font-style:normal;color:${P.amber}}
.s{margin-top:26px;font-size:34px;font-weight:700;color:${P.mint};line-height:1.3}
.brand{position:absolute;left:64px;bottom:46px;display:flex;align-items:center;gap:16px}
.brand b{font-size:30px;font-weight:900;color:${P.cream};letter-spacing:.02em}
</style>
<div class="shot"></div><div class="scrim"></div>
<div class="txt"><div class="h">${headline}</div><div class="s">${sub}</div></div>
<div class="brand">${MARK(56)}<b>MADE BY MATT</b></div>`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

await p.setContent(page('FREE.<br><em>NO SIGN-UP.</em>', 'Games, lessons and teacher tools'), { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.screenshot({ path: OUT + '/thumb-launch-1280x720.png' });
await b.close();

// The poster is the same composition, re-encoded to WebP to match the six
// posters already in assets/video/. Playwright cannot write WebP, so ffmpeg does.
import { execFileSync } from 'node:child_process';
const FF = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'])
  .toString().trim();
execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-i', OUT + '/thumb-launch-1280x720.png',
  '-c:v', 'libwebp', '-quality', '86', OUT + '/poster-launch.webp', '-y']);

for (const f of fs.readdirSync(OUT)) {
  console.log('  ' + f.padEnd(34) + fs.statSync(OUT + '/' + f).size + ' bytes');
}
