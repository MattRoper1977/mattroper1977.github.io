#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = (process.env.APEXPOOL_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const ARTIFACTS = process.env.APEXPOOL_ARTIFACT_DIR || path.join(__dirname, '..', 'artifacts', 'apexpool');
fs.mkdirSync(ARTIFACTS, { recursive: true });

let pass = 0;
let fail = 0;
function ok(name, condition, detail = '') {
  if (condition) { pass++; console.log('  PASS  ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '   ' + detail : '')); }
}
function head(title) { console.log('\n== ' + title + ' =='); }
function captureErrors(page, bucket) {
  page.on('console', (message) => { if (message.type() === 'error') bucket.push('console: ' + message.text()); });
  page.on('pageerror', (error) => bucket.push('pageerror: ' + (error.stack || error.message || String(error))));
  page.on('requestfailed', (request) => bucket.push('requestfailed: ' + request.url()));
}
async function renderedTargets(page) {
  return page.evaluate(() => [...document.querySelectorAll('button, a.btn, button.mode-card, button.person, button.shopitem')]
    .map((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        label: (element.getAttribute('aria-label') || element.textContent || element.id || element.className).trim().replace(/\s+/g, ' ').slice(0, 70),
        width: box.width,
        height: box.height,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
      };
    }).filter((item) => item.visible));
}
async function assertTargets(page, label) {
  const targets = await renderedTargets(page);
  const bad = targets.filter((item) => Math.round(item.width) < 44 || Math.round(item.height) < 44);
  console.log(`  DATA  ${label}: ${targets.length} targets` + (bad.length ? '; undersized ' + bad.map((x) => `${x.label} ${x.width.toFixed(1)}×${x.height.toFixed(1)}`).join(' | ') : ''));
  ok(`${label}-targets-at-least-44px`, targets.length > 0 && bad.length === 0);
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    head('360×640 interaction floor and chooser layout');
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    const external = [];
    captureErrors(page, errors);
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== new URL(BASE).origin) external.push(request.url());
    });
    const response = await page.goto(BASE + '/apexpool/', { waitUntil: 'load' });
    ok('game-responds-200', response && response.status() === 200, response ? String(response.status()) : 'no response');
    await page.waitForFunction(() => window.__AP_DEBUG && document.querySelector('.wordmark'));
    await page.waitForTimeout(1300);
    const rotateVisible = await page.locator('#rotateHint').isVisible();
    ok('portrait-path-remains-unblocked', !rotateVisible);
    if (rotateVisible) {
      await assertTargets(page, 'portrait-choice');
      await page.locator('#dismissRotate').click();
      await page.waitForFunction(() => getComputedStyle(document.getElementById('rotateHint')).display === 'none');
    }
    await assertTargets(page, 'title');

    await page.locator('#settingsBtn').click();
    await assertTargets(page, 'settings');
    await page.locator('#backSettings').click();
    await page.locator('#shopBtn').click();
    await assertTargets(page, 'shop');
    await page.locator('#backShop').click();
    await page.locator('#aiCard').click();
    await assertTargets(page, 'opponent-picker');
    await page.locator('#backAI').click();

    await page.evaluate(() => window.__AP_DEBUG.start('classic'));
    await page.waitForFunction(() => !document.getElementById('hud').classList.contains('hidden'));
    await page.evaluate(() => {
      document.getElementById('rotateHint').style.display = 'none';
      document.getElementById('screens').innerHTML = '';
      const chooser = document.getElementById('pocketChooser');
      chooser.classList.remove('hidden');
      document.getElementById('pocketGrid').innerHTML = Array.from({ length: 6 }, (_, i) => `<button aria-label="Pocket ${i + 1}">${i + 1}</button>`).join('');
    });
    const layout = await page.evaluate(() => {
      const rect = (element) => {
        const b = element.getBoundingClientRect();
        return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        chooser: rect(document.getElementById('pocketChooser')),
        controls: rect(document.getElementById('controls')),
        buttons: [...document.querySelectorAll('#pocketGrid button')].map(rect),
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }
      };
    });
    console.log('  DATA  chooser=' + JSON.stringify(layout.chooser) + ' controls=' + JSON.stringify(layout.controls));
    ok('six-pocket-buttons-render', layout.buttons.length === 6);
    ok('every-pocket-button-is-44px-high', layout.buttons.every((button) => button.height >= 44));
    ok('chooser-remains-above-control-deck', layout.chooser.bottom <= layout.controls.top, `${layout.chooser.bottom.toFixed(1)} <= ${layout.controls.top.toFixed(1)}`);
    ok('chooser-remains-inside-360x640', layout.chooser.left >= 0 && layout.chooser.right <= layout.viewport.width && layout.chooser.top >= 0 && layout.chooser.bottom <= layout.viewport.height);
    ok('no-360x640-document-overflow', layout.document.width === layout.viewport.width && layout.document.height === layout.viewport.height, JSON.stringify(layout.document));
    await assertTargets(page, 'in-game');
    await page.screenshot({ path: path.join(ARTIFACTS, 'landing-360x640.png'), fullPage: true });
    const negative = await page.evaluate(() => {
      const button = document.querySelector('#pocketGrid button');
      button.style.setProperty('height', '38px', 'important');
      button.style.setProperty('min-height', '38px', 'important');
      return button.getBoundingClientRect().height < 44;
    });
    ok('target-detector-negative-control', negative);
    ok('zero-console-page-or-request-errors', errors.length === 0, errors.join(' | ') || 'none');
    ok('zero-external-runtime-requests', external.length === 0, external.join(' | ') || 'none');
    await context.close();

    head('Sibling storage byte identity');
    const storageContext = await browser.newContext({ viewport: { width: 1000, height: 700 } });
    const storagePage = await storageContext.newPage();
    const storageErrors = [];
    captureErrors(storagePage, storageErrors);
    await storagePage.goto(BASE + '/apexpool/', { waitUntil: 'load' });
    await storagePage.waitForFunction(() => window.__AP_DEBUG);
    const sibling = {
      'apexkick.v1': '{"owner":"kick","bytes":"UNCHANGED"}',
      'apexkick.muted': '1',
      'apexGolf.v1.settings': '{"owner":"golf","slot":"settings"}',
      'apexGolf.v1.progress': '{"owner":"golf","slot":"progress"}',
      'apexGolf.v1.statistics': '{"owner":"golf","slot":"statistics"}',
      'apexGolf.v1.editor': '{"owner":"golf","slot":"editor"}',
      'voxelfrontier.world.v2.12345': '{"owner":"voxel","seed":12345}',
      'voxelfrontier.lastseed.v1': '12345',
      'voxelfrontier.prefs.v1': '{"owner":"voxel","renderDistance":4}'
    };
    const before = await storagePage.evaluate((values) => {
      localStorage.clear();
      Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
      return Object.fromEntries(Object.keys(values).map((key) => [key, localStorage.getItem(key)]));
    }, sibling);
    await storagePage.evaluate(() => {
      window.__AP_DEBUG.start('classic');
      window.__AP_DEBUG.setCall(430, 240, true);
      window.__AP_DEBUG.finishMatch(true, 'Storage isolation fixture completed.');
    });
    const after = await storagePage.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])));
    const changed = Object.keys(sibling).filter((key) => before[key] !== after[key]);
    const poolKeys = Object.keys(after).filter((key) => key.startsWith('mbm_apexpool_'));
    const unexpected = Object.keys(after).filter((key) => !Object.prototype.hasOwnProperty.call(sibling, key) && !key.startsWith('mbm_apexpool_'));
    console.log('  DATA  sibling keys=' + Object.keys(sibling).join(' | '));
    console.log('  DATA  Apex Pool keys=' + poolKeys.join(' | '));
    ok('all-sibling-values-byte-identical', changed.length === 0, changed.join(' | ') || 'all unchanged');
    ok('full-match-writes-only-apexpool-prefix', poolKeys.length >= 1 && unexpected.length === 0, unexpected.join(' | ') || poolKeys.join(' | '));
    ok('storage-comparator-negative-control', Object.keys(sibling).some((key) => ({ ...after, [key]: 'tamper' })[key] !== before[key]));
    ok('storage-path-zero-errors', storageErrors.length === 0, storageErrors.join(' | ') || 'none');
    await storageContext.close();

    head('Reduced motion and recovery renders');
    const reducedContext = await browser.newContext({ viewport: { width: 800, height: 700 }, reducedMotion: 'reduce' });
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto(BASE + '/apexpool/', { waitUntil: 'load' });
    const reduced = await reducedPage.evaluate(() => ({
      media: matchMedia('(prefers-reduced-motion: reduce)').matches,
      splash: getComputedStyle(document.getElementById('mbmSplash')).transitionDuration,
      rule: getComputedStyle(document.querySelector('#mbmSplash .mbm-rule')).animationDuration,
      replayGuard: document.documentElement.innerHTML.includes('!G.replayPlayed&&!reduced')
    }));
    console.log('  DATA  reduced=' + JSON.stringify(reduced));
    ok('reduced-motion-media-active', reduced.media);
    ok('splash-motion-suppressed', parseFloat(reduced.splash) <= 0.001 && parseFloat(reduced.rule) <= 0.001);
    ok('replay-flourish-suppressed', reduced.replayGuard);
    await reducedContext.close();

    const noJsContext = await browser.newContext({ viewport: { width: 800, height: 700 }, javaScriptEnabled: false });
    const noJsPage = await noJsContext.newPage();
    await noJsPage.goto(BASE + '/apexpool/', { waitUntil: 'load' });
    const noJs = await noJsPage.evaluate(() => ({ text: document.body.innerText, splash: getComputedStyle(document.getElementById('mbmSplash')).display }));
    ok('noscript-fallback-renders', noJs.text.includes('Apex Pool needs JavaScript'));
    ok('noscript-fallback-hides-splash', noJs.splash === 'none', noJs.splash);
    await noJsPage.screenshot({ path: path.join(ARTIFACTS, 'landing-noscript.png'), fullPage: true });
    await noJsContext.close();

    const noCanvasContext = await browser.newContext({ viewport: { width: 800, height: 700 } });
    await noCanvasContext.addInitScript(() => Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: () => null }));
    const noCanvasPage = await noCanvasContext.newPage();
    const noCanvasErrors = [];
    captureErrors(noCanvasPage, noCanvasErrors);
    await noCanvasPage.goto(BASE + '/apexpool/', { waitUntil: 'load' });
    const guard = await noCanvasPage.evaluate(() => {
      const element = document.getElementById('noCanvas');
      return { display: getComputedStyle(element).display, text: element.innerText };
    });
    ok('noCanvas-guard-renders', guard.display === 'flex' && guard.text.includes('Canvas is unavailable'), JSON.stringify(guard));
    ok('noCanvas-path-zero-errors', noCanvasErrors.length === 0, noCanvasErrors.join(' | ') || 'none');
    await noCanvasPage.screenshot({ path: path.join(ARTIFACTS, 'landing-no-canvas.png'), fullPage: true });
    await noCanvasContext.close();
  } catch (error) {
    fail++;
    console.error(error.stack || error);
  } finally {
    if (browser) await browser.close();
  }
  console.log('\n' + '='.repeat(64));
  console.log(fail === 0 ? `ALL ${pass} LANDING BROWSER CHECKS PASSED` : `${pass} passed, ${fail} FAILED`);
  console.log('='.repeat(64));
  process.exit(fail ? 1 : 0);
})();
