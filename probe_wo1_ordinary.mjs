// WO1 ordinary page: why does Tab pressed on the exit not leave the exit?
// Replays the control's exact sequence and reports what actually happens to the key
// and to focus, rather than inferring it.
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || process.cwd();
const ROUTE = process.argv[3] || '/cyberpulse/';

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
const page = await (await browser.newContext({viewport: {width: 1280, height: 800}})).newPage();
await page.goto(origin + ROUTE + '?splash=force', {waitUntil: 'load'});
await page.waitForFunction(() => !document.querySelector('[data-mbm-maker-splash]'), null, {timeout: 15000}).catch(() => {});
await page.waitForTimeout(700);

// Watch the Tab key and every focus move from now on.
await page.evaluate(() => {
  window.__wo = {keys: [], focus: []};
  window.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    window.__wo.keys.push({phase: 'capture-window', from: document.activeElement && (document.activeElement.id || document.activeElement.tagName)});
  }, true);
  window.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    window.__wo.keys.push({phase: 'bubble-window', defaultPrevented: e.defaultPrevented});
  }, false);
  document.addEventListener('focusin', e => {
    window.__wo.focus.push({to: e.target.id || e.target.tagName, cls: String(e.target.className || '').slice(0, 30)});
  }, true);
});

const before = await page.evaluate(() => {
  const exit = document.querySelector('#mbmexit-back,#mbmhud-back');
  exit.focus();
  const tabbable = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]')]
    .filter(el => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return !el.disabled && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0
        && el.getAttribute('tabindex') !== '-1';
    })
    .map(el => ({id: el.id || null, tag: el.tagName, tabindex: el.getAttribute('tabindex')}));
  return {
    activeNow: document.activeElement.id || document.activeElement.tagName,
    exitId: exit.id,
    exitIndexAmongTabbable: tabbable.findIndex(t => t.id === exit.id),
    tabbableCount: tabbable.length,
    tabbable: tabbable.slice(0, 20),
  };
});

await page.keyboard.press('Tab');
await page.waitForTimeout(120);
const after = await page.evaluate(() => ({
  active: document.activeElement.id || document.activeElement.tagName,
  moved: document.activeElement !== document.querySelector('#mbmexit-back,#mbmhud-back'),
  keys: window.__wo.keys,
  focus: window.__wo.focus,
}));

console.log(JSON.stringify({before, after}, null, 1));
await browser.close();
server.close();
