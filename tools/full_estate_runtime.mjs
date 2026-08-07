#!/usr/bin/env node
/**
 * MadeByMatt runtime smoke matrix.
 * Sentinel: mbm-full-repair-upgrade-2026-08-07
 *
 * Loads every derived game target at desktop and touch-mobile widths, plus the
 * representative navigation/lesson pages, and records page exceptions, console
 * errors, failed requests, HTTP failures, horizontal overflow, unusable canvases,
 * and materially undersized button controls. The runner also exercises a safe
 * start/play control, basic keyboard/touch input, resize and focus-loss paths.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const SENTINEL = 'mbm-full-repair-upgrade-2026-08-07';

function parseArgs(argv) {
  const out = { targets: '', baseUrl: 'http://127.0.0.1:4173', report: 'runtime-report.json', markdown: 'runtime-report.md', selfTest: false, concurrency: 2 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--self-test') out.selfTest = true;
    else if (arg === '--targets') out.targets = argv[++i];
    else if (arg === '--base-url') out.baseUrl = argv[++i].replace(/\/$/, '');
    else if (arg === '--report') out.report = argv[++i];
    else if (arg === '--markdown') out.markdown = argv[++i];
    else if (arg === '--concurrency') out.concurrency = Math.max(1, Number(argv[++i]) || 1);
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

function sameOrigin(url, baseUrl) {
  try { return new URL(url).origin === new URL(baseUrl).origin; }
  catch { return false; }
}

function normaliseMessage(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
}

function isIgnorableConsole(text) {
  return /favicon\.ico.*404/i.test(text) || /Download the React DevTools/i.test(text);
}

async function collectPage(browser, item, baseUrl) {
  const profile = item.profile;
  const isMobile = profile === 'mobile';
  const context = await browser.newContext({
    viewport: isMobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    isMobile,
    hasTouch: isMobile,
    deviceScaleFactor: isMobile ? 2 : 1,
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const issues = [];
  const observations = [];
  let stage = 'load';

  page.on('pageerror', error => issues.push({ severity: 'P0', code: 'PAGE_ERROR', stage, message: normaliseMessage(error?.stack || error) }));
  page.on('console', msg => {
    if (msg.type() === 'error' && !isIgnorableConsole(msg.text())) {
      issues.push({ severity: 'P1', code: 'CONSOLE_ERROR', stage, message: normaliseMessage(msg.text()) });
    }
  });
  page.on('requestfailed', request => {
    const url = request.url();
    issues.push({
      severity: sameOrigin(url, baseUrl) ? 'P1' : 'P2',
      code: sameOrigin(url, baseUrl) ? 'REQUEST_FAILED' : 'EXTERNAL_REQUEST_FAILED',
      stage,
      message: `${request.method()} ${url} — ${normaliseMessage(request.failure()?.errorText)}`,
    });
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      const url = response.url();
      issues.push({
        severity: sameOrigin(url, baseUrl) ? 'P1' : 'P2',
        code: sameOrigin(url, baseUrl) ? 'HTTP_FAILURE' : 'EXTERNAL_HTTP_FAILURE',
        stage,
        message: `${response.status()} ${response.request().method()} ${url}`,
      });
    }
  });

  const targetUrl = new URL(item.target, `${baseUrl}/`).href;
  let loaded = false;
  try {
    const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    loaded = Boolean(response && response.ok());
    await page.waitForTimeout(700);
  } catch (error) {
    issues.push({ severity: 'P0', code: 'NAVIGATION_FAILED', stage, message: normaliseMessage(error) });
  }

  if (loaded) {
    stage = 'initial-state';
    try {
      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const visible = el => {
          const style = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && r.width > 0 && r.height > 0;
        };
        const buttons = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')]
          .filter(visible)
          .map(el => {
            const r = el.getBoundingClientRect();
            return { w: r.width, h: r.height, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80) };
          });
        const canvases = [...document.querySelectorAll('canvas')].filter(visible).map(canvas => {
          const r = canvas.getBoundingClientRect();
          return { cssW: r.width, cssH: r.height, bitmapW: canvas.width, bitmapH: canvas.height, right: r.right, bottom: r.bottom };
        });
        return {
          title: document.title,
          readyState: document.readyState,
          viewportW: root.clientWidth,
          scrollW: Math.max(root.scrollWidth, body?.scrollWidth || 0),
          viewportH: root.clientHeight,
          scrollH: Math.max(root.scrollHeight, body?.scrollHeight || 0),
          buttons,
          canvases,
          activeTag: document.activeElement?.tagName || '',
          textLength: (body?.innerText || '').trim().length,
        };
      });
      observations.push({ code: 'INITIAL_METRICS', metrics });
      if (metrics.scrollW > metrics.viewportW + 4) {
        issues.push({ severity: 'P2', code: 'HORIZONTAL_OVERFLOW', stage, message: `document scrollWidth ${metrics.scrollW}px exceeds viewport ${metrics.viewportW}px` });
      }
      if (metrics.textLength === 0 && metrics.canvases.length === 0) {
        issues.push({ severity: 'P1', code: 'EMPTY_PAGE', stage, message: 'page has no visible text and no visible canvas' });
      }
      for (const canvas of metrics.canvases) {
        if (canvas.bitmapW <= 0 || canvas.bitmapH <= 0 || canvas.cssW <= 0 || canvas.cssH <= 0) {
          issues.push({ severity: 'P1', code: 'CANVAS_ZERO_SIZE', stage, message: `canvas bitmap ${canvas.bitmapW}x${canvas.bitmapH}, CSS ${canvas.cssW}x${canvas.cssH}` });
        }
        if (canvas.right > metrics.viewportW + 4) {
          issues.push({ severity: 'P2', code: 'CANVAS_OVERFLOW', stage, message: `canvas right edge ${Math.round(canvas.right)}px exceeds viewport ${metrics.viewportW}px` });
        }
      }
      if (isMobile) {
        const tiny = metrics.buttons.filter(button => button.w < 40 || button.h < 40);
        if (tiny.length) {
          issues.push({ severity: 'P2', code: 'SMALL_TOUCH_TARGET', stage, message: `${tiny.length}/${metrics.buttons.length} visible button controls are below 40px in at least one dimension; examples: ${tiny.slice(0, 4).map(x => `${Math.round(x.w)}x${Math.round(x.h)} ${x.text}`).join('; ')}` });
        }
      }
    } catch (error) {
      issues.push({ severity: 'P1', code: 'METRICS_FAILED', stage, message: normaliseMessage(error) });
    }

    if (item.kind === 'game') {
      stage = 'start-control';
      try {
        const candidates = page.locator('button:visible, [role="button"]:visible, input[type="button"]:visible, input[type="submit"]:visible');
        const count = await candidates.count();
        let clicked = false;
        for (let i = 0; i < Math.min(count, 40); i++) {
          const el = candidates.nth(i);
          const label = `${await el.getAttribute('aria-label') || ''} ${await el.textContent().catch(() => '') || ''} ${await el.getAttribute('value') || ''}`.trim();
          if (/\b(start|play|begin|continue|enter|launch|skip)\b/i.test(label) && !/trailer|video|youtube/i.test(label)) {
            await el.click({ timeout: 3000 }).catch(() => {});
            clicked = true;
            observations.push({ code: 'START_CONTROL', label: label.slice(0, 120) });
            await page.waitForTimeout(600);
            break;
          }
        }
        if (!clicked) observations.push({ code: 'NO_START_CONTROL', message: 'no visible safe start/play control was derived' });
      } catch (error) {
        issues.push({ severity: 'P2', code: 'START_EXERCISE_FAILED', stage, message: normaliseMessage(error) });
      }

      stage = 'input';
      try {
        if (isMobile) {
          const canvas = page.locator('canvas:visible').first();
          if (await canvas.count()) {
            const box = await canvas.boundingBox();
            if (box) {
              await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
              observations.push({ code: 'TOUCH_INPUT', message: 'tapped visible canvas centre' });
            }
          }
        } else {
          await page.keyboard.press('ArrowRight');
          await page.keyboard.press('Space');
          await page.keyboard.press('Escape');
          observations.push({ code: 'KEYBOARD_INPUT', message: 'ArrowRight, Space and Escape dispatched' });
        }
        await page.waitForTimeout(350);
      } catch (error) {
        issues.push({ severity: 'P2', code: 'INPUT_EXERCISE_FAILED', stage, message: normaliseMessage(error) });
      }

      stage = 'focus-loss';
      try {
        await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        await page.waitForTimeout(150);
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      } catch (error) {
        issues.push({ severity: 'P2', code: 'FOCUS_EXERCISE_FAILED', stage, message: normaliseMessage(error) });
      }

      stage = 'restart-control';
      try {
        const candidates = page.locator('button:visible, [role="button"]:visible, input[type="button"]:visible');
        const count = await candidates.count();
        for (let i = 0; i < Math.min(count, 40); i++) {
          const el = candidates.nth(i);
          const label = `${await el.getAttribute('aria-label') || ''} ${await el.textContent().catch(() => '') || ''} ${await el.getAttribute('value') || ''}`.trim();
          if (/\b(restart|retry|reset|again|new game)\b/i.test(label)) {
            await el.click({ timeout: 2500 }).catch(() => {});
            observations.push({ code: 'RESTART_CONTROL', label: label.slice(0, 120) });
            await page.waitForTimeout(350);
            break;
          }
        }
      } catch (error) {
        issues.push({ severity: 'P2', code: 'RESTART_EXERCISE_FAILED', stage, message: normaliseMessage(error) });
      }
    }

    stage = 'resize';
    try {
      const alternate = isMobile ? { width: 844, height: 390 } : { width: 1024, height: 700 };
      await page.setViewportSize(alternate);
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - document.documentElement.clientWidth);
      if (overflow > 4) issues.push({ severity: 'P2', code: 'RESIZE_OVERFLOW', stage, message: `horizontal overflow after resize: ${Math.round(overflow)}px` });
    } catch (error) {
      issues.push({ severity: 'P2', code: 'RESIZE_EXERCISE_FAILED', stage, message: normaliseMessage(error) });
    }
  }

  await context.close();
  const unique = [];
  const seen = new Set();
  for (const issue of issues) {
    const key = `${issue.severity}|${issue.code}|${issue.stage}|${issue.message}`;
    if (!seen.has(key)) { seen.add(key); unique.push(issue); }
  }
  return { target: item.target, kind: item.kind, profile, loaded, issues: unique, observations };
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
      const failures = results[index].issues.filter(x => x.severity === 'P0' || x.severity === 'P1').length;
      console.log(`${String(index + 1).padStart(3)}/${items.length} ${items[index].profile.padEnd(7)} ${items[index].target} — ${failures ? `${failures} blocking` : 'ok'}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

function writeMarkdown(report, filepath) {
  const lines = [
    '# MadeByMatt runtime smoke matrix', '',
    `Sentinel: \`${report.sentinel}\``, '',
    `Targets: **${report.targetCount}** · Executions: **${report.executionCount}** · P0: **${report.counts.P0 || 0}** · P1: **${report.counts.P1 || 0}** · P2: **${report.counts.P2 || 0}**`, '',
    '| Target | Kind | Profile | Loaded | P0/P1 | P2 |',
    '|---|---|---|---:|---:|---:|',
  ];
  for (const result of report.results) {
    const blocking = result.issues.filter(x => x.severity === 'P0' || x.severity === 'P1').length;
    const medium = result.issues.filter(x => x.severity === 'P2').length;
    lines.push(`| \`${result.target}\` | ${result.kind} | ${result.profile} | ${result.loaded ? 'yes' : 'no'} | ${blocking} | ${medium} |`);
  }
  lines.push('', '## Findings', '');
  for (const result of report.results) {
    for (const issue of result.issues) {
      lines.push(`- **${issue.severity} ${issue.code}** \`${result.profile} ${result.target}\` (${issue.stage}) — ${issue.message}`);
    }
  }
  if (!report.results.some(r => r.issues.length)) lines.push('No runtime findings.');
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, lines.join('\n') + '\n');
}

async function selfTest(browser, baseUrl) {
  const context = await browser.newContext();
  await context.route('**/__mbm_runtime_selftest__', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>control</title><script src="/__mbm_missing_control__.js"></script><script>setTimeout(()=>{throw new Error("MBM_RUNTIME_CONTROL")},0)</script>',
    });
  });
  const page = await context.newPage();
  let pageError = false;
  let missing = false;
  page.on('pageerror', error => { if (String(error).includes('MBM_RUNTIME_CONTROL')) pageError = true; });
  page.on('response', response => { if (response.url().includes('__mbm_missing_control__') && response.status() >= 400) missing = true; });
  await page.goto(`${baseUrl}/__mbm_runtime_selftest__`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(100);
  await context.close();
  if (!pageError || !missing) throw new Error(`SELF-TEST FAILED: pageError=${pageError} missingRequest=${missing}`);
  console.log('SELF-TEST PASSED — injected page exception and missing same-origin script were both detected');
}

async function main() {
  const args = parseArgs(process.argv);
  const browser = await chromium.launch({ headless: true });
  try {
    if (args.selfTest) {
      await selfTest(browser, args.baseUrl);
      return;
    }
    if (!args.targets) throw new Error('--targets is required');
    const targetDoc = JSON.parse(fs.readFileSync(args.targets, 'utf8'));
    const games = [...new Set(targetDoc.games || [])];
    const pages = [...new Set(targetDoc.pages || [])].filter(target => !games.includes(target));
    const items = [];
    for (const target of games) {
      items.push({ target, kind: 'game', profile: 'desktop' });
      items.push({ target, kind: 'game', profile: 'mobile' });
    }
    for (const target of pages) {
      items.push({ target, kind: 'page', profile: 'desktop' });
      items.push({ target, kind: 'page', profile: 'mobile' });
    }
    const results = await runPool(items, args.concurrency, item => collectPage(browser, item, args.baseUrl));
    const counts = {};
    for (const result of results) for (const issue of result.issues) counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    const report = { sentinel: SENTINEL, targetCount: games.length + pages.length, executionCount: items.length, counts, results };
    fs.mkdirSync(path.dirname(args.report), { recursive: true });
    fs.writeFileSync(args.report, JSON.stringify(report, null, 2) + '\n');
    writeMarkdown(report, args.markdown);
    console.log(JSON.stringify({ sentinel: SENTINEL, targetCount: report.targetCount, executionCount: report.executionCount, counts }, null, 2));
    if ((counts.P0 || 0) + (counts.P1 || 0) > 0) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exit(1);
});
