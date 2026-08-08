#!/usr/bin/env node
/** Verify the counter circuit breaker and on-device fallback. */
import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';

const SENTINEL = 'mbm-full-repair-upgrade-2026-08-07';
const baseUrl = (process.argv[2] || 'http://127.0.0.1:4173').replace(/\/$/, '');
const siteConfig = JSON.parse(fs.readFileSync('site.json', 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForMBM(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => window.MBM && window.MBM.ready, null, { timeout: 10000 });
  await page.evaluate(() => window.MBM.ready);
}

async function localFallbackCase(browser) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const counterRequests = [];
  context.on('request', request => {
    if (request.url().startsWith('https://api.counterapi.dev/')) counterRequests.push(request.url());
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await waitForMBM(page);
  const result = await page.evaluate(async () => {
    const key = 'audit-local-counter';
    localStorage.removeItem('mbm_c_' + key);
    const before = await window.MBM.read(key);
    const first = await window.MBM.bump(key);
    const second = await window.MBM.bump(key);
    const after = await window.MBM.read(key);
    localStorage.removeItem('mbm_c_' + key);
    return { before, first, second, after, remote: window.MBM.cfg.stats.remoteCounters };
  });
  await context.close();
  assert(errors.length === 0, `default counter page errors: ${errors.join(' | ')}`);
  assert(counterRequests.length === 0, `default mode made ${counterRequests.length} remote counter request(s)`);
  assert(result.remote === false, `remoteCounters default should be false, saw ${result.remote}`);
  assert(result.before === null && result.first === 1 && result.second === 2 && result.after === 2,
    `local fallback sequence mismatch: ${JSON.stringify(result)}`);
  return { counterRequests: counterRequests.length, result };
}

async function challengedRemoteCase(browser) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  let counterRequests = 0;
  await context.route('**/site.json*', async route => {
    const config = structuredClone(siteConfig);
    config.features = config.features || {};
    config.features.stats = config.features.stats || {};
    config.features.stats.remoteCounters = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) });
  });
  await context.route('https://api.counterapi.dev/**', async route => {
    counterRequests += 1;
    await route.fulfill({
      status: 403,
      contentType: 'text/html',
      headers: { 'access-control-allow-origin': '*' },
      body: '<!doctype html><title>challenge</title>',
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await waitForMBM(page);
  await page.evaluate(async () => {
    await Promise.all([
      window.MBM.read('audit-a'),
      window.MBM.read('audit-b'),
      window.MBM.bump('audit-c'),
      window.MBM.read('audit-d'),
    ]);
    for (const key of ['audit-a', 'audit-b', 'audit-c', 'audit-d']) localStorage.removeItem('mbm_c_' + key);
  });
  await context.close();
  assert(errors.length === 0, `challenged counter page errors: ${errors.join(' | ')}`);
  assert(counterRequests === 1, `single-flight probe expected one challenged request, saw ${counterRequests}`);
  return { counterRequests };
}

const browser = await chromium.launch({ headless: true });
try {
  const local = await localFallbackCase(browser);
  const challenged = await challengedRemoteCase(browser);
  console.log(JSON.stringify({ sentinel: SENTINEL, local, challenged }, null, 2));
  console.log('COUNTER FALLBACK PASS — zero default remote calls; one challenged probe; local counts remain usable');
} finally {
  await browser.close();
}
