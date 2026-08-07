#!/usr/bin/env node
/** Focused, isolated probe for games that exceeded the broad matrix watchdog. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const SENTINEL = 'mbm-full-repair-upgrade-2026-08-07';
const DEFAULT_TARGETS = [
  '/Lessons/Games/Neon_Garden.html',
  '/Lessons/Games/Neon_Siege.html',
  '/Lessons/Games/Orbital.html',
  '/Lessons/Games/Orbital_source.html',
  '/Lessons/Games/Prism.html',
  '/novasiege/',
];

function args(argv) {
  const out = { baseUrl: 'http://127.0.0.1:4173', report: 'slow-probe.json', markdown: 'slow-probe.md', targets: DEFAULT_TARGETS };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--base-url') out.baseUrl = argv[++i].replace(/\/$/, '');
    else if (argv[i] === '--report') out.report = argv[++i];
    else if (argv[i] === '--markdown') out.markdown = argv[++i];
    else if (argv[i] === '--targets') out.targets = argv[++i].split(',').filter(Boolean);
    else throw new Error(`unknown argument ${argv[i]}`);
  }
  return out;
}

function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 1000); }
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function snapshot(page) {
  return withTimeout(page.evaluate(() => {
    const visible = el => {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const controls = [...document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')]
      .filter(visible)
      .map((el, index) => ({ index, label: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().slice(0, 120) }));
    const start = [...document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')]
      .filter(visible)
      .find(el => /\b(start|play|begin|continue|enter|launch|skip)\b/i.test(`${el.getAttribute('aria-label') || ''} ${el.textContent || ''} ${el.value || ''}`) && !/trailer|video|youtube/i.test(`${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`));
    if (start) start.setAttribute('data-mbm-slow-probe', 'start');
    const canvas = [...document.querySelectorAll('canvas')].find(visible);
    const rect = canvas?.getBoundingClientRect();
    return {
      readyState: document.readyState,
      title: document.title,
      controls,
      startLabel: start ? (start.getAttribute('aria-label') || start.textContent || start.value || '').trim().slice(0, 120) : '',
      canvas: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bitmapWidth: canvas.width, bitmapHeight: canvas.height } : null,
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    };
  }), 7000, 'DOM snapshot');
}

async function ping(cdp, label) {
  const started = Date.now();
  try {
    const result = await withTimeout(cdp.send('Runtime.evaluate', { expression: 'performance.now()', returnByValue: true }), 7000, label);
    return { ok: true, ms: Date.now() - started, value: result?.result?.value ?? null };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, error: clean(error) };
  }
}

async function probe(browser, baseUrl, target, profile) {
  const mobile = profile === 'mobile';
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    isMobile: mobile,
    hasTouch: mobile,
    deviceScaleFactor: mobile ? 2 : 1,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  context.setDefaultTimeout(7000);
  context.setDefaultNavigationTimeout(45000);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push({ code: 'PAGE_ERROR', message: clean(error?.stack || error) }));
  page.on('console', message => { if (message.type() === 'error') errors.push({ code: 'CONSOLE_ERROR', message: clean(message.text()) }); });
  page.on('requestfailed', request => requests.push({ url: request.url(), error: clean(request.failure()?.errorText) }));
  const result = { target, profile, url: new URL(target, `${baseUrl}/`).href, stages: {}, errors, failedRequests: requests };
  const overallStarted = Date.now();
  try {
    const navStarted = Date.now();
    const response = await page.goto(result.url, { waitUntil: 'commit', timeout: 20000 });
    result.stages.commit = { ok: Boolean(response), status: response?.status() ?? null, ms: Date.now() - navStarted };

    const domStarted = Date.now();
    try {
      await page.waitForLoadState('domcontentloaded', { timeout: 35000 });
      result.stages.domcontentloaded = { ok: true, ms: Date.now() - domStarted };
    } catch (error) {
      result.stages.domcontentloaded = { ok: false, ms: Date.now() - domStarted, error: clean(error) };
    }

    result.stages.preStartPing = await ping(cdp, 'pre-start event-loop ping');
    if (!result.stages.preStartPing.ok) return result;
    result.initial = await snapshot(page);

    const alternate = mobile ? { width: 844, height: 390 } : { width: 1024, height: 700 };
    const resizeStarted = Date.now();
    await page.setViewportSize(alternate);
    result.stages.resize = { ok: true, ms: Date.now() - resizeStarted, ping: await ping(cdp, 'resize event-loop ping') };
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 });

    if (result.initial.startLabel) {
      const startStarted = Date.now();
      try {
        await page.locator('[data-mbm-slow-probe="start"]').click({ timeout: 7000 });
        result.stages.start = { ok: true, ms: Date.now() - startStarted, label: result.initial.startLabel };
      } catch (error) {
        result.stages.start = { ok: false, ms: Date.now() - startStarted, label: result.initial.startLabel, error: clean(error) };
      }
      await page.waitForTimeout(900);
    } else {
      result.stages.start = { ok: null, message: 'no safe visible start control found' };
    }

    result.stages.postStartPings = [];
    for (let i = 0; i < 3; i++) {
      const pong = await ping(cdp, `post-start event-loop ping ${i + 1}`);
      result.stages.postStartPings.push(pong);
      if (!pong.ok) break;
      await page.waitForTimeout(200);
    }

    if (mobile && result.initial.canvas && result.stages.postStartPings.every(item => item.ok)) {
      const c = result.initial.canvas;
      try {
        await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 2);
        result.stages.touch = { ok: true };
      } catch (error) {
        result.stages.touch = { ok: false, error: clean(error) };
      }
    }
    result.final = await snapshot(page).catch(error => ({ error: clean(error) }));
  } catch (error) {
    result.harnessError = clean(error?.stack || error);
  } finally {
    result.totalMs = Date.now() - overallStarted;
    await context.close().catch(() => {});
  }
  return result;
}

function markdown(report) {
  const lines = [
    '# Isolated slow-game probe', '', `Sentinel: \`${report.sentinel}\``, '',
    '| Target | Profile | DOM ready | Start | Post-start responsive | Total | Errors |',
    '|---|---|---:|---:|---:|---:|---:|',
  ];
  for (const r of report.results) {
    const dom = r.stages.domcontentloaded;
    const start = r.stages.start;
    const pings = r.stages.postStartPings || [];
    lines.push(`| \`${r.target}\` | ${r.profile} | ${dom ? `${dom.ok ? 'yes' : 'no'} (${dom.ms}ms)` : 'n/a'} | ${start ? `${start.ok === true ? 'yes' : start.ok === false ? 'no' : 'n/a'}` : 'n/a'} | ${pings.length ? (pings.every(x => x.ok) ? 'yes' : 'no') : 'n/a'} | ${r.totalMs}ms | ${r.errors.length} |`);
  }
  lines.push('', '## Details', '');
  for (const r of report.results) lines.push(`### ${r.profile} ${r.target}`, '', '```json', JSON.stringify(r, null, 2), '```', '');
  return lines.join('\n') + '\n';
}

async function main() {
  const opt = args(process.argv);
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const target of opt.targets) {
      for (const profile of ['desktop', 'mobile']) {
        const result = await withTimeout(probe(browser, opt.baseUrl, target, profile), 70000, `${profile} ${target}`)
          .catch(error => ({ target, profile, totalMs: 70000, harnessError: clean(error), stages: {}, errors: [], failedRequests: [] }));
        results.push(result);
        console.log(`${profile.padEnd(7)} ${target} — ${result.harnessError || `${result.totalMs}ms`}`);
      }
    }
  } finally {
    await browser.close();
  }
  const report = { sentinel: SENTINEL, results };
  fs.mkdirSync(path.dirname(opt.report), { recursive: true });
  fs.writeFileSync(opt.report, JSON.stringify(report, null, 2) + '\n');
  fs.mkdirSync(path.dirname(opt.markdown), { recursive: true });
  fs.writeFileSync(opt.markdown, markdown(report));
}

main().catch(error => { console.error(error?.stack || error); process.exit(1); });
