import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const SENTINEL = 'mbm-live-showcase-video-2026-08-08';
const BASE = 'https://madebymatt.uk/';
const OUT = path.resolve(process.env.SHOWCASE_OUT || 'showcase-output');
const RAW = path.join(OUT, 'raw');
const SHOTS = JSON.parse(await fs.readFile(new URL('./shots.json', import.meta.url), 'utf8'));
const report = {
  sentinel: SENTINEL,
  capturedAt: new Date().toISOString(),
  base: BASE,
  browser: null,
  productionChecks: [],
  scenes: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: []
};

await fs.mkdir(RAW, { recursive: true });

function recordPageDiagnostics(page, sceneId) {
  page.on('console', msg => {
    if (msg.type() === 'error') report.consoleErrors.push({ scene: sceneId, text: msg.text().slice(0, 500) });
  });
  page.on('pageerror', err => report.pageErrors.push({ scene: sceneId, text: String(err).slice(0, 500) }));
  page.on('requestfailed', req => {
    const url = req.url();
    if (/google-analytics|doubleclick|counterapi|youtube|fonts\.googleapis/i.test(url)) return;
    report.requestFailures.push({ scene: sceneId, url, error: req.failure()?.errorText || 'request failed' });
  });
}

async function settle(page, extra = 900) {
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(extra);
}

async function gotoLive(page, url, sceneId) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const status = response ? response.status() : null;
  const title = await page.title().catch(() => '');
  report.productionChecks.push({ scene: sceneId, url, status, title });
  if (!response || status >= 400) throw new Error(`Live route failed: ${url} (${status})`);
  await settle(page);
  return response;
}

async function smoothScroll(page, top, duration = 1200) {
  await page.evaluate(({ top, duration }) => new Promise(resolve => {
    const start = window.scrollY;
    const delta = top - start;
    const t0 = performance.now();
    const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    function step(now) {
      const p = Math.min(1, (now - t0) / duration);
      window.scrollTo(0, start + delta * ease(p));
      if (p < 1) requestAnimationFrame(step); else resolve();
    }
    requestAnimationFrame(step);
  }), { top, duration }).catch(() => {});
}

async function visible(locator, timeout = 1800) {
  return locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
}

async function clickTextButton(page, regex, timeout = 1600) {
  const byRole = page.getByRole('button', { name: regex }).first();
  if (await visible(byRole, timeout)) { await byRole.click(); return true; }
  const byText = page.locator('button').filter({ hasText: regex }).first();
  if (await visible(byText, 500)) { await byText.click(); return true; }
  return false;
}

async function clickTextLink(page, regex, timeout = 2500) {
  const byRole = page.getByRole('link', { name: regex }).first();
  if (await visible(byRole, timeout)) { await byRole.click(); return true; }
  const byText = page.locator('a').filter({ hasText: regex }).first();
  if (await visible(byText, 500)) { await byText.click(); return true; }
  return false;
}

async function largestCanvasBox(page) {
  return page.locator('canvas').evaluateAll(nodes => {
    const boxes = nodes.map(n => {
      const r = n.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, area: r.width * r.height };
    }).filter(b => b.width > 40 && b.height > 40).sort((a, b) => b.area - a.area);
    return boxes[0] || null;
  }).catch(() => null);
}

async function gameGesture(page) {
  const b = await largestCanvasBox(page);
  if (!b) return false;
  const sx = b.x + b.width * 0.48;
  const sy = b.y + b.height * 0.67;
  const ex = b.x + b.width * 0.56;
  const ey = b.y + b.height * 0.43;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(ex, ey, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(900);
  await page.keyboard.down('ArrowLeft').catch(() => {});
  await page.waitForTimeout(350);
  await page.keyboard.up('ArrowLeft').catch(() => {});
  await page.keyboard.press('Space').catch(() => {});
  return true;
}

async function lessonInteraction(page) {
  const next = page.locator('#next');
  for (let i = 0; i < 8; i++) {
    if (await page.locator('#e7pos').isVisible().catch(() => false)) break;
    if (await visible(next, 400)) await next.click(); else await page.keyboard.press('ArrowRight').catch(() => {});
    await page.waitForTimeout(420);
  }
  const range = page.locator('#e7pos');
  if (await visible(range, 1200)) {
    for (const v of [80, 165, 245, 330]) {
      await range.evaluate((el, value) => {
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, v);
      await page.waitForTimeout(620);
    }
    const play = page.locator('#e7play');
    if (await visible(play, 500)) { await play.click(); await page.waitForTimeout(700); await play.click(); }
    return true;
  }
  return false;
}

async function designStudioInteraction(page) {
  const canvas = page.locator('#disp');
  const box = await canvas.boundingBox().catch(() => null);
  if (!box) return false;
  let changed = false;

  if (await clickTextButton(page, /Text/i, 1000)) {
    await page.mouse.click(box.x + box.width * 0.50, box.y + box.height * 0.42);
    const area = page.locator('#textArea');
    if (await visible(area, 1000)) {
      await area.fill('Learn · Build · Explore');
      const done = page.locator('#textDone');
      if (await visible(done, 500)) await done.click();
      changed = true;
      await page.waitForTimeout(1000);
    }
  }

  if (await clickTextButton(page, /Shape/i, 800)) {
    const shapeChoice = page.locator('#shapeKinds button').first();
    if (await visible(shapeChoice, 700)) await shapeChoice.click();
    await page.mouse.click(box.x + box.width * 0.67, box.y + box.height * 0.61);
    changed = true;
    await page.waitForTimeout(900);
  }

  if (!changed) {
    const draw = page.locator('button').filter({ hasText: /Draw|Brush|Pen/i }).first();
    if (await visible(draw, 700)) await draw.click();
    await page.mouse.move(box.x + box.width * 0.34, box.y + box.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.39, { steps: 8 });
    await page.mouse.move(box.x + box.width * 0.58, box.y + box.height * 0.57, { steps: 8 });
    await page.mouse.up();
    changed = true;
  }
  return changed;
}

async function captureScene(browser, spec) {
  const { id, width, height, mobile = false, run, seconds } = spec;
  const scene = { id, width, height, mobile, requestedSeconds: seconds, startedAt: new Date().toISOString(), interactions: [] };
  const context = await browser.newContext({
    viewport: { width, height },
    screen: { width, height },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    permissions: [],
    recordVideo: { dir: RAW, size: { width, height } }
  });
  const page = await context.newPage();
  recordPageDiagnostics(page, id);
  const video = page.video();
  try {
    await run(page, scene);
    scene.ok = true;
  } catch (err) {
    scene.ok = false;
    scene.error = String(err?.stack || err).slice(0, 2000);
    await page.waitForTimeout(1500).catch(() => {});
  }
  await page.waitForTimeout(550).catch(() => {});
  await context.close();
  const destination = path.join(RAW, `${id}.webm`);
  if (video) await video.saveAs(destination);
  scene.video = destination;
  scene.finishedAt = new Date().toISOString();
  report.scenes.push(scene);
  await fs.writeFile(path.join(OUT, 'capture-progress.json'), JSON.stringify(report, null, 2));
}

const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] });
report.browser = await browser.version();

const desktop = Object.fromEntries(SHOTS.desktop.map(s => [s.id, s.seconds]));
const mobile = Object.fromEntries(SHOTS.mobile.map(s => [s.id, s.seconds]));

await captureScene(browser, {
  id: 'home', width: 1920, height: 1080, seconds: desktop.home,
  run: async (page, scene) => {
    await gotoLive(page, BASE, scene.id);
    scene.interactions.push('homepage loaded');
    await page.waitForTimeout(1400);
    await smoothScroll(page, 430, 1500); scene.interactions.push('smooth scroll to audience routes');
    await page.waitForTimeout(900);
    await smoothScroll(page, 980, 1500); scene.interactions.push('smooth scroll through catalogue/new releases');
    await page.waitForTimeout(800);
    await smoothScroll(page, 90, 1300);
    await page.waitForTimeout(1600);
  }
});

await captureScene(browser, {
  id: 'games', width: 1920, height: 1080, seconds: desktop.games,
  run: async (page, scene) => {
    await gotoLive(page, `${BASE}games/`, scene.id);
    scene.interactions.push('Games hub loaded');
    await page.waitForTimeout(1500);
    await smoothScroll(page, 560, 1500); scene.interactions.push('curated collection shown');
    await page.waitForTimeout(900);
    let clicked = await clickTextLink(page, /Apex Kick/i, 3500);
    if (clicked) { scene.interactions.push('opened Apex Kick from live hub'); await settle(page, 1000); }
    else { await gotoLive(page, `${BASE}apexkick/`, scene.id); scene.interactions.push('opened Apex Kick direct fallback'); }
    await page.waitForTimeout(1100);
    if (await gameGesture(page)) scene.interactions.push('performed live canvas gameplay gesture');
    await page.waitForTimeout(4300);
  }
});

await captureScene(browser, {
  id: 'lessons', width: 1920, height: 1080, seconds: desktop.lessons,
  run: async (page, scene) => {
    await gotoLive(page, `${BASE}Lessons/`, scene.id);
    scene.interactions.push('Lesson Hub loaded');
    await page.waitForTimeout(1100);
    for (const name of [/BUILD/i, /GROW/i, /LAUNCH/i]) {
      if (await clickTextButton(page, name, 700)) { scene.interactions.push(`pathway ${name}`); await page.waitForTimeout(500); }
    }
    const search = page.locator('input[placeholder*="bonding" i], input[placeholder*="Try:" i], input[type="search"]').first();
    if (await visible(search, 1200)) { await search.fill('Night and day'); scene.interactions.push('searched Lesson Hub for Night and day'); await page.waitForTimeout(1100); }
    let clicked = await clickTextLink(page, /Night and day/i, 2200);
    if (clicked) { scene.interactions.push('opened Y5 Night and day from hub'); await settle(page, 900); }
    else { await gotoLive(page, `${BASE}Lessons/primary/year5/science/autumn/space/Lesson7_NightAndDay.html`, scene.id); scene.interactions.push('opened Y5 Night and day direct fallback'); }
    if (await lessonInteraction(page)) scene.interactions.push('used live Earth rotation/day-night control');
    await page.waitForTimeout(2600);
  }
});

await captureScene(browser, {
  id: 'apps', width: 1920, height: 1080, seconds: desktop.apps,
  run: async (page, scene) => {
    await gotoLive(page, `${BASE}Matt-s-Apps-/`, scene.id);
    scene.interactions.push('Creator Hub loaded');
    await page.waitForTimeout(1200);
    if (await clickTextButton(page, /STUDENT/i, 700)) { scene.interactions.push('audience filter: student'); await page.waitForTimeout(650); }
    if (await clickTextButton(page, /^ALL$/i, 700)) { scene.interactions.push('audience filter: all'); await page.waitForTimeout(500); }
    const search = page.locator('input[placeholder*="poster" i], input[type="search"]').first();
    if (await visible(search, 1000)) { await search.fill('design'); scene.interactions.push('searched studios for design'); await page.waitForTimeout(750); }
    let clicked = await clickTextLink(page, /Design Studio/i, 1800);
    if (clicked) { scene.interactions.push('opened Design Studio from hub'); await settle(page, 850); }
    else { await gotoLive(page, `${BASE}Matt-s-Apps-/Design_Studio.html`, scene.id); scene.interactions.push('opened Design Studio direct fallback'); }
    if (await designStudioInteraction(page)) scene.interactions.push('created temporary on-canvas demo content in clean browser context');
    await page.waitForTimeout(3100);
  }
});

await captureScene(browser, {
  id: 'tools', width: 1920, height: 1080, seconds: desktop.tools,
  run: async (page, scene) => {
    await gotoLive(page, `${BASE}tools/`, scene.id);
    scene.interactions.push('Tools Hub loaded');
    await page.waitForTimeout(1500);
    const uasHeading = page.getByRole('heading', { name: /UAS REGISTER/i }).first();
    if (await visible(uasHeading, 1500)) await uasHeading.scrollIntoViewIfNeeded(); else await smoothScroll(page, 520, 1200);
    await page.waitForTimeout(1500);
    if (await clickTextLink(page, /OPEN UAS REGISTER/i, 1600)) { scene.interactions.push('opened UAS Register'); await settle(page, 1000); }
    else { await gotoLive(page, `${BASE}uas/app.html`, scene.id); scene.interactions.push('opened UAS Register direct fallback'); }
    await smoothScroll(page, 420, 1000);
    await page.waitForTimeout(3200);
  }
});

await captureScene(browser, {
  id: 'resources', width: 1920, height: 1080, seconds: desktop.resources,
  run: async (page, scene) => {
    await gotoLive(page, `${BASE}resources/`, scene.id);
    scene.interactions.push('Resource catalogue loaded');
    await page.waitForTimeout(1300);
    const chipScience = page.locator('button.rx-chip').filter({ hasText: /Science/i }).first();
    if (await visible(chipScience, 2200)) { await chipScience.click(); scene.interactions.push('subject filter: Science'); await page.waitForTimeout(900); }
    const typeLesson = page.locator('button.rx-chip').filter({ hasText: /Lesson/i }).first();
    if (await visible(typeLesson, 900)) { await typeLesson.click(); scene.interactions.push('type filter: Lesson'); await page.waitForTimeout(750); }
    const search = page.locator('input[placeholder*="Physics" i], .rx-search input, input[type="search"]').first();
    if (await visible(search, 1000)) { await search.fill('space'); scene.interactions.push('catalogue search: space'); await page.waitForTimeout(1200); }
    const firstCard = page.locator('.rx-cardx').first();
    if (await visible(firstCard, 1400)) await firstCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2400);
    if (await visible(search, 600)) { await search.fill(''); scene.interactions.push('cleared search to restore catalogue breadth'); await page.waitForTimeout(950); }
    await smoothScroll(page, 430, 900);
    await page.waitForTimeout(1600);
  }
});

await captureScene(browser, {
  id: 'closing', width: 1920, height: 1080, seconds: desktop.closing,
  run: async (page, scene) => {
    await gotoLive(page, BASE, scene.id);
    scene.interactions.push('returned to homepage');
    await page.waitForTimeout(1300);
    await smoothScroll(page, 200, 1000);
    await page.waitForTimeout(4500);
  }
});

const mobileUA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
async function mobileScene(id, seconds, run) {
  return captureScene(browser, { id, width: 390, height: 844, mobile: true, seconds, run: async (page, scene) => {
    await page.setExtraHTTPHeaders({ 'Sec-CH-UA-Mobile': '?1' }).catch(() => {});
    await run(page, scene);
  }});
}

await mobileScene('mobile_home', mobile.mobile_home, async (page, scene) => {
  await gotoLive(page, BASE, scene.id); await page.waitForTimeout(1000);
  const menu = page.getByRole('button', { name: /Menu/i }).first();
  if (await visible(menu, 900)) { await menu.click(); scene.interactions.push('opened mobile menu'); await page.waitForTimeout(850); await menu.click().catch(() => {}); }
  await smoothScroll(page, 500, 1100); scene.interactions.push('mobile homepage scroll'); await page.waitForTimeout(1700);
});

await mobileScene('mobile_games', mobile.mobile_games, async (page, scene) => {
  await gotoLive(page, `${BASE}games/`, scene.id); await page.waitForTimeout(950);
  await smoothScroll(page, 620, 1100); scene.interactions.push('mobile curated games shelf'); await page.waitForTimeout(900);
  if (await clickTextLink(page, /Apex Kick/i, 1300)) { await settle(page, 650); scene.interactions.push('opened Apex Kick on mobile viewport'); }
  else await gotoLive(page, `${BASE}apexkick/`, scene.id);
  const b = await largestCanvasBox(page);
  if (b) { await page.touchscreen.tap(b.x + b.width * 0.5, b.y + b.height * 0.6).catch(() => {}); scene.interactions.push('mobile game tap'); }
  await page.waitForTimeout(2200);
});

await mobileScene('mobile_lessons', mobile.mobile_lessons, async (page, scene) => {
  await gotoLive(page, `${BASE}Lessons/`, scene.id); await page.waitForTimeout(900);
  for (const name of [/BUILD/i, /GROW/i, /LAUNCH/i]) { if (await clickTextButton(page, name, 700)) await page.waitForTimeout(450); }
  scene.interactions.push('mobile BUILD/GROW/LAUNCH pathway taps');
  await smoothScroll(page, 660, 900); await page.waitForTimeout(1700);
});

await mobileScene('mobile_apps', mobile.mobile_apps, async (page, scene) => {
  await gotoLive(page, `${BASE}Matt-s-Apps-/`, scene.id); await page.waitForTimeout(900);
  if (await clickTextButton(page, /STUDENT/i, 800)) { scene.interactions.push('mobile audience filter'); await page.waitForTimeout(700); }
  await smoothScroll(page, 520, 1000); await page.waitForTimeout(700);
  if (await clickTextLink(page, /Design Studio/i, 1000)) { await settle(page, 700); scene.interactions.push('opened Design Studio on mobile'); }
  else await gotoLive(page, `${BASE}Matt-s-Apps-/Design_Studio.html`, scene.id);
  await page.waitForTimeout(1700);
});

await mobileScene('mobile_tools', mobile.mobile_tools, async (page, scene) => {
  await gotoLive(page, `${BASE}tools/`, scene.id); await page.waitForTimeout(900);
  await smoothScroll(page, 630, 1100); scene.interactions.push('mobile teacher tools scroll');
  await page.waitForTimeout(2200);
});

await mobileScene('mobile_resources', mobile.mobile_resources, async (page, scene) => {
  await gotoLive(page, `${BASE}resources/`, scene.id); await page.waitForTimeout(900);
  const search = page.locator('input[placeholder*="Physics" i], .rx-search input, input[type="search"]').first();
  if (await visible(search, 1500)) { await search.fill('science'); scene.interactions.push('mobile catalogue search: science'); await page.waitForTimeout(1000); }
  const chip = page.locator('button.rx-chip').filter({ hasText: /Science/i }).first();
  if (await visible(chip, 900)) { await chip.click(); scene.interactions.push('mobile subject chip'); await page.waitForTimeout(800); }
  await smoothScroll(page, 590, 950); await page.waitForTimeout(1700);
});

await mobileScene('mobile_closing', mobile.mobile_closing, async (page, scene) => {
  await gotoLive(page, BASE, scene.id); scene.interactions.push('mobile closing homepage');
  await page.waitForTimeout(3400);
});

await browser.close();

report.completedAt = new Date().toISOString();
report.privacy = {
  cleanBrowserContexts: true,
  persistedProfileUsed: false,
  realPupilOrStaffDataEntered: false,
  credentialsOrPersonalNotificationsExposed: false,
  productionWriteActions: false
};
await fs.writeFile(path.join(OUT, 'capture-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ sentinel: SENTINEL, scenes: report.scenes.length, productionChecks: report.productionChecks.length, output: OUT }, null, 2));
