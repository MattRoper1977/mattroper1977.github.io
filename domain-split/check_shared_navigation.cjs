#!/usr/bin/env node
'use strict';
// Run against the assembled publication using the established CI browser.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const origin = new URL(process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173').origin;
const header = '[data-mbm-navigation="education"]';
const menu = header + ' .mbm-unified-menu';
const panel = header + ' .mbm-unified-panel';
const routes = ['/', '/main/', '/account/', '/members/', '/mailing-list/', '/privacy/',
  '/stats/', '/owner/stats/', '/resources/', '/tools/', '/teach/', '/education-hub/',
  '/for/teachers/', '/for/pupils/', '/for/parents-carers/', '/for/schools-semh/',
  '/for/trusts/', '/for/councils-organisations/', '/for/partners/',
  '/for/governors-trustees/', '/Lessons/', '/Lessons/primary/', '/Matt-s-Apps-/'];
const restricted = ['/for/pupils/', '/resources/', '/Lessons/', '/Lessons/primary/', '/Matt-s-Apps-/'];
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 390, height: 844 } });
      // This navigation test never signs in or contacts a live backend/game.
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      for (const route of routes) {
        assert.equal((await page.goto(origin + route)).status(), 200, route);
        assert.equal(await page.locator(header).count(), 1, 'One header: ' + route);
        const skip = page.locator('body > a[href^="#"]').first();
        if (await skip.count()) {
          await skip.focus();
          assert(await skip.evaluate(el => {
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return hit === el || el.contains(hit);
          }), 'Skip link stays above the header: ' + route);
        }
        const summary = page.locator(menu + ' > summary');
        assert(!await page.locator(panel).isVisible());
        await summary.press('Enter');
        assert(await page.locator(panel).isVisible(), 'Native keyboard menu: ' + route);
        assert(await page.locator(panel + ' a[href="/Lessons/"]').isVisible());
        assert.equal(await page.locator(panel + ' a[href="/games/"], ' + panel + ' a[href$="#about"]').count(), 0);
        if (restricted.includes(route)) {
          assert.equal(await page.locator(header + ' a[href^="/account"], ' + header + ' a[href^="/members"], ' + header + ' a[href^="/mailing-list"]').count(), 0, 'Audience boundary: ' + route);
        }
        if (javaScriptEnabled) {
          await summary.press('Escape');
          assert(!await page.locator(panel).isVisible());
          assert(await summary.evaluate(el => el === document.activeElement), 'Escape returns focus');
        }
      }
      for (const viewport of [{ width: 320, height: 640 }, { width: 768, height: 360 }, { width: 1280, height: 900 }]) {
        await page.setViewportSize(viewport);
        await page.goto(origin + '/');
        await page.locator(menu + ' > summary').click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
        if (javaScriptEnabled) await page.screenshot({ path: 'audit-output/home-play-discovery/shared-menu-' + viewport.width + '.png', animations: 'disabled' });
        const finalLink = page.locator(panel + ' a').last();
        await finalLink.scrollIntoViewIfNeeded();
        const box = await finalLink.boundingBox();
        assert(box.width >= 44 && box.height >= 44 && box.y >= 0 && box.y + box.height <= viewport.height + 1, 'Last link remains reachable in a short viewport');
      }
      await page.goto(origin + '/');
      await page.locator(menu + ' > summary').click();
      await page.locator(panel + ' a[href="/account/"]').click();
      assert.equal(new URL(page.url()).pathname, '/account/');
      await page.locator(header + ' .mbm-unified-brand').click();
      assert.equal(new URL(page.url()).pathname, '/');
      if (javaScriptEnabled) {
        await page.locator(menu + ' > summary').click();
        await page.mouse.click(4, 110);
        assert(!await page.locator(panel).isVisible(), 'Outside click closes menu');
      }
      await context.close();
      console.log('PASS shared navigation: ' + (javaScriptEnabled ? 'enhanced' : 'without JavaScript'));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
