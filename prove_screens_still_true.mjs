// Before rebinding a captured screen to new payload bytes, prove the picture still
// depicts the page: render the OLD bytes and the NEW bytes and compare pixels.
// A screen binding says "this photograph is of these bytes". Moving it without
// checking would make that a claim I had not tested.
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const SITE = process.argv[2];
const OLD_REF = process.argv[3];          // commit holding the pre-re-stamp bytes
const ROUTES = process.argv.slice(4);

const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ico': 'image/x-icon'};

let override = null; // {urlPath, body}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  if (override && p === override.urlPath) {
    res.writeHead(200, {'content-type': 'text/html'});
    res.end(override.body);
    return;
  }
  const file = path.join(SITE, p);
  if (!file.startsWith(SITE) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('nope'); return;
  }
  res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;

const browser = await chromium.launch({headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
let differing = 0;

for (const route of ROUTES) {
  const rel = route.replace(/^\//, '').replace(/\/$/, '') + '/index.html';
  const urlPath = '/' + rel;
  let oldBody;
  try {
    oldBody = execFileSync('git', ['-C', SITE, 'show', `${OLD_REF}:${rel}`], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  } catch {
    console.log(`${route.padEnd(18)} SKIP  no ${OLD_REF} version`);
    continue;
  }
  const shots = [];
  for (const which of ['old', 'new']) {
    override = which === 'old' ? {urlPath, body: oldBody} : null;
    const ctx = await browser.newContext({viewport: {width: 1280, height: 720}, reducedMotion: 'reduce'});
    const page = await ctx.newPage();
    // ?splash=skip so the capture is of the game's own start surface, which is what a
    // screen depicts, not the maker mark that precedes it.
    await page.goto(`${origin}${route}?splash=skip`, {waitUntil: 'load'}).catch(() => {});
    await page.waitForTimeout(3500);
    shots.push(await page.screenshot({type: 'png'}));
    await ctx.close();
  }
  const same = Buffer.compare(shots[0], shots[1]) === 0;
  if (!same) differing++;
  console.log(`${route.padEnd(18)} ${same ? 'IDENTICAL' : 'DIFFERS  '} old=${shots[0].length}B new=${shots[1].length}B`);
}

console.log(differing
  ? `\n${differing} route(s) render differently - those screens must be recaptured, not rebound`
  : '\nevery route renders identically: the captured screens still depict these pages');
await browser.close();
server.close();
process.exit(differing ? 1 : 0);
