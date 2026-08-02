/* Renders every title card, beat card and caption strip for the launch film.
 *
 * Nothing here is AI-generated and nothing is stock. The only geometry used is
 * the "M" path lifted verbatim from assets/brand/micro_mark.svg, and the colours
 * are the estate's own --dx-* tokens. Type is the site's own stack; Poppins is
 * not installed in the build container and the site self-hosts no webfont, so
 * this falls through to system-ui exactly as it does for most visitors.
 *
 * Output: 1920x1080 PNGs (cards) and 1920x1080 transparent PNGs (captions).
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || '/tmp/claude-0/film/cards';
fs.mkdirSync(OUT, { recursive: true });

const P = {
  navy: '#161D3D', deep: '#0F1530', mint: '#B9E6CD', mintd: '#2F6B4D',
  amber: '#F2A24A', ambd: '#C97F2E', cream: '#E8E2D4', mut: '#C9D1E2',
};
const FONT = `Poppins,"Segoe UI",system-ui,sans-serif`;

/* the M, verbatim from assets/brand/micro_mark.svg */
const MARK = (size, bg) => `<svg viewBox="0 0 100 100" width="${size}" height="${size}">
<rect width="100" height="100" rx="22" fill="${bg || P.navy}"/>
<path d="M26 76 L26 30 L50 55 L74 30 L74 76" fill="none" stroke="${P.cream}"
 stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const shell = (body, extra = '') => `<!doctype html><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;font-family:${FONT};-webkit-font-smoothing:antialiased}
body{background:${P.navy};display:grid;place-items:center;overflow:hidden}
.rule{height:6px;width:120px;background:${P.amber};border-radius:99px}
${extra}
</style>${body}`;

/* ---------- full-frame cards ---------- */
const CARDS = {
  title: shell(`<div style="text-align:center">
    <div style="display:flex;align-items:center;justify-content:center;gap:34px;margin-bottom:34px">
      ${MARK(150, P.deep)}
      <div style="text-align:left">
        <div style="font-size:88px;font-weight:900;color:${P.cream};letter-spacing:.02em;line-height:1">MADE BY MATT</div>
        <div style="font-size:30px;font-weight:700;color:${P.mint};letter-spacing:.42em;margin-top:14px">LEARN &nbsp;·&nbsp; BUILD &nbsp;·&nbsp; EXPLORE</div>
      </div>
    </div>
    <div class="rule" style="margin:44px auto 30px"></div>
    <div style="font-size:38px;color:${P.mut};font-weight:500">Free classroom tools, games and lessons</div>
  </div>`),

  beat1: shell(`<div style="text-align:center;max-width:1500px">
    <div style="font-size:26px;font-weight:800;letter-spacing:.30em;color:${P.amber};margin-bottom:26px">ONE</div>
    <div style="font-size:104px;font-weight:900;color:${P.cream};line-height:1.06">No sign-up.<br>Nothing collected.</div>
    <div class="rule" style="margin:42px auto 28px"></div>
    <div style="font-size:36px;color:${P.mut};line-height:1.5">There is no account to make, and no password box anywhere on the site.</div>
  </div>`),

  beat2: shell(`<div style="text-align:center;max-width:1500px">
    <div style="font-size:26px;font-weight:800;letter-spacing:.30em;color:${P.amber};margin-bottom:26px">TWO</div>
    <div style="font-size:118px;font-weight:900;color:${P.cream};line-height:1.04">Apex Kick</div>
    <div class="rule" style="margin:42px auto 28px"></div>
    <div style="font-size:38px;color:${P.mut};line-height:1.5">Curl a free kick round the wall.<br>
      <span style="color:${P.mint};font-weight:700">Card stats set the physics, never the dice.</span></div>
  </div>`),

  beat3: shell(`<div style="text-align:center;max-width:1560px">
    <div style="font-size:26px;font-weight:800;letter-spacing:.30em;color:${P.amber};margin-bottom:26px">THREE</div>
    <div style="font-size:104px;font-weight:900;color:${P.cream};line-height:1.06">Year 10&ndash;11 Biology</div>
    <div class="rule" style="margin:42px auto 28px"></div>
    <div style="font-size:36px;color:${P.mut};line-height:1.5">Fifteen new lessons across five weeks &mdash;
      <span style="color:${P.mint};font-weight:700">Discover, Use, Master</span></div>
  </div>`),

  end: shell(`<div style="text-align:center">
    ${MARK(132, P.deep)}
    <div style="font-size:96px;font-weight:900;color:${P.cream};margin-top:34px;letter-spacing:.01em">madebymatt.uk</div>
    <div class="rule" style="margin:40px auto 30px"></div>
    <div style="font-size:38px;color:${P.mut};line-height:1.55">Free to use. No sign-up, no account, nothing to install.<br>
      <span style="color:${P.mint};font-weight:700">Built in a real SEMH classroom.</span></div>
  </div>`),
};

/* ---------- lower-third caption strips, transparent ---------- */
const CAPTIONS = {
  'cap-privacy-1':  ['Data and privacy', 'Written by checking what the pages actually do'],
  'cap-privacy-2':  ['Measured, not promised', '0 of 27 pages set a cookie · no analytics of any kind'],
  'cap-members':    ['No members’ area, on purpose', 'Nothing was ever behind a login — so the login went'],
  'cap-apex-1':     ['Power, curve, accuracy', 'The card’s stats decide how tight the error cone is'],
  'cap-apex-2':     ['48 cards, 7 leagues, 16 nations', 'Chemistry between players changes the ballistics'],
  'cap-doors':      ['Everything on one page', 'Games, lessons, teacher tools — all free'],
  'cap-bio-1':      ['Edexcel GCSE Biology 1BI0 Foundation', 'Paper 1, Topic 1 — cells, transport and the core practical'],
  'cap-bio-2':      ['Discover · Use · Master', 'Five per stage, across five weeks'],
  'cap-bio-3':      ['Built for the room they’re taught in', 'Print packs at three levels in every lesson'],
};

const capHTML = (t, s) => shell(`<div style="position:absolute;left:0;right:0;bottom:0;height:262px;
  background:linear-gradient(to top, rgba(15,21,48,.97) 0%, rgba(15,21,48,.90) 62%, rgba(15,21,48,0) 100%);
  display:flex;flex-direction:column;justify-content:flex-end;padding:0 96px 62px">
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:14px">
    <span style="display:block;width:64px;height:6px;background:${P.amber};border-radius:99px"></span>
    <span style="font-size:52px;font-weight:900;color:${P.cream};line-height:1.1">${t}</span>
  </div>
  <div style="font-size:32px;color:${P.mut};font-weight:500;padding-left:84px">${s}</div>
</div>`, 'body{background:transparent!important;display:block!important;position:relative}');

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const made = [];

for (const [name, html] of Object.entries(CARDS)) {
  const f = path.join(OUT, name + '.png');
  await p.setContent(html, { waitUntil: 'load' });
  await p.waitForTimeout(150);
  await p.screenshot({ path: f });
  made.push(name);
}
for (const [name, [t, s]] of Object.entries(CAPTIONS)) {
  const f = path.join(OUT, name + '.png');
  await p.setContent(capHTML(t, s), { waitUntil: 'load' });
  await p.waitForTimeout(150);
  await p.screenshot({ path: f, omitBackground: true });
  made.push(name);
}
await b.close();
console.log('rendered ' + made.length + ' PNGs into ' + OUT);
made.forEach(n => console.log('    ' + n + '.png'));
