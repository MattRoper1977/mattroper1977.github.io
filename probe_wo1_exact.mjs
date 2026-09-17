// The gate's WO1 sequence, replayed exactly: same context options, same route,
// same waits, no extra instrumentation before the Tab. Runs both variants N times.
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
const ROUTE = process.argv[3] || '/cyberpulse/';
const RUNS = Number(process.argv[4] || 3);

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ico': 'image/x-icon'};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nope'); return;
  }
  res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;

const browser = await chromium.launch({headless: true});
for (let run = 1; run <= RUNS; run++) {
  for (const [label, starve] of [['starved', true], ['ordinary', false]]) {
    const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, reducedMotion: 'no-preference', serviceWorkers: 'block'});
    const page = await ctx.newPage();
    await page.goto(`${origin}${ROUTE}?splash=force`, {waitUntil: 'load'});
    if (starve) await page.addStyleTag({content: 'button:not(#mbmexit-back):not(#mbmhud-back),a[href]:not(#mbmexit-back):not(#mbmhud-back),[tabindex]:not(#mbmexit-back):not(#mbmhud-back):not([data-mbm-maker-splash]){display:none!important}'});
    await page.waitForFunction(() => !document.querySelector('[data-mbm-maker-splash]'), null, {timeout: 15000}).catch(() => {});
    await page.waitForTimeout(700);
    const wo = await page.evaluate(() => {
      const exit = document.querySelector('#mbmexit-back,#mbmhud-back');
      const handedTo = (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || null;
      if (!exit) return {exit: false, handedTo};
      exit.focus();
      return {exit: true, handedTo, before: document.activeElement === exit};
    });
    let moved = null, landed = null;
    if (wo.exit) {
      await page.keyboard.press('Tab');
      const r = await page.evaluate(() => ({
        moved: document.activeElement !== document.querySelector('#mbmexit-back,#mbmhud-back'),
        active: document.activeElement.id || document.activeElement.tagName,
      }));
      moved = r.moved; landed = r.active;
    }
    await ctx.close();
    console.log(`run ${run} ${label.padEnd(9)} handedTo=${String(wo.handedTo).padEnd(12)} focusedFirst=${wo.before} moved=${moved} landed=${landed}`);
  }
}
await browser.close();
server.close();
