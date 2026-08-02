// Real motion from Apex Kick, driven through the game's own input paths.
// Playwright records the page at ~25fps to WebM; we transcode to h264 later.
// No canvas readback: WebGL here is preserveDrawingBuffer:false and returns
// pure black, a trap already recorded on this estate.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const DIR = process.argv[2] || '/tmp/claude-0/film/akvid';
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });

const b = await chromium.launch({ args: ['--force-device-scale-factor=1'] });
const ctx = await b.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: DIR, size: { width: 1920, height: 1080 } },
});
const p = await ctx.newPage();

// GATE Z: clean profile before any pixel
await p.goto('http://127.0.0.1:8501/404.html', { waitUntil: 'domcontentloaded' });
const pre = await p.evaluate(() => {
  const ls = []; for (let i = 0; i < localStorage.length; i++) ls.push(localStorage.key(i));
  return { ls, cookie: document.cookie };
});
console.log('GATE Z before nav: localStorage keys=' + pre.ls.length + ' cookies=' + (pre.cookie ? 1 : 0));

await p.goto('http://127.0.0.1:8501/apexkick/index.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(2600);

// mute so nothing surprises anyone, then into Practice (no rewards, no progression)
await p.evaluate(() => { const m = document.querySelector('#bMute'); if (m && /on/i.test(m.textContent)) m.click(); });
await p.waitForTimeout(400);
await p.click('#bPractice');
await p.waitForTimeout(2600);

const shot = async (fromX, fromY, toX, toY, holdMs) => {
  await p.mouse.move(fromX, fromY);
  await p.mouse.down();
  const steps = 22;
  for (let i = 1; i <= steps; i++) {
    await p.mouse.move(fromX + (toX - fromX) * i / steps, fromY + (toY - fromY) * i / steps);
    await p.waitForTimeout(8);
  }
  await p.mouse.up();
  await p.waitForTimeout(holdMs);
};

// three curling free kicks, swiped across the ball to impart spin
await shot(960, 880, 1180, 470, 4200);
await shot(960, 880, 760, 500, 4200);
await shot(960, 880, 1120, 430, 4600);

const state = await p.evaluate(() => ({
  ls: (() => { const a = []; for (let i = 0; i < localStorage.length; i++) a.push(localStorage.key(i)); return a; })(),
}));
console.log('localStorage after play: ' + JSON.stringify(state.ls));

await ctx.close();   // finalises the video file
await b.close();

const f = fs.readdirSync(DIR).filter(x => x.endsWith('.webm'));
for (const x of f) console.log('captured video: ' + x + '  ' + fs.statSync(DIR + '/' + x).size + ' bytes');
