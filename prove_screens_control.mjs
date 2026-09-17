// Control for prove_screens_still_true.mjs: render the SAME bytes twice.
// A route that differs from itself cannot be judged by that instrument at all, so a
// "DIFFERS" verdict there says nothing about whether the change altered the page.
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const SITE = process.argv[2];
const ROUTES = process.argv.slice(3);
const TYPES = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ico': 'image/x-icon'};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
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
const verdict = {};
for (const route of ROUTES) {
  const shots = [];
  for (let i = 0; i < 2; i++) {
    const ctx = await browser.newContext({viewport: {width: 1280, height: 720}, reducedMotion: 'reduce'});
    const page = await ctx.newPage();
    await page.goto(`${origin}${route}?splash=skip`, {waitUntil: 'load'}).catch(() => {});
    await page.waitForTimeout(3500);
    shots.push(await page.screenshot({type: 'png'}));
    await ctx.close();
  }
  const stable = Buffer.compare(shots[0], shots[1]) === 0;
  verdict[route] = stable;
  console.log(`${route.padEnd(18)} ${stable ? 'DETERMINISTIC' : 'NONDETERMINISTIC'} (same bytes rendered twice)`);
}
const unstable = Object.entries(verdict).filter(([, s]) => !s).map(([r]) => r);
console.log(unstable.length
  ? `\n${unstable.length} route(s) do not render deterministically; the before/after comparison cannot judge them`
  : '\nevery route renders deterministically, so a before/after difference is a real difference');
await browser.close();
server.close();
