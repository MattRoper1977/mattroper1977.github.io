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
  '/for/governors-trustees/', '/Lessons/', '/Lessons/primary/', '/Matt-s-Apps-/',
  '/stats/on-this-device/', '/asdan/', '/uas/', '/Lessons/Science_Teesside/',
  '/Lessons/Humanities_Teesside/', '/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/'];
const restricted = ['/for/pupils/', '/resources/', '/Lessons/primary/'];
const themeRoutes = ['/Lessons/', '/Matt-s-Apps-/', '/Lessons/Science_Teesside/', '/Lessons/Humanities_Teesside/'];
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 390, height: 844 } });
      // This navigation test never signs in or contacts a live backend/game.
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      for (const route of routes) {
        assert.equal((await page.goto(origin + route)).status(), 200, route);
        assert.equal(await page.locator(header).count(), 1, 'One header: ' + route);
        const skip = page.locator('body > a[href^="#"]').first();
        if (await skip.count()) {
          await skip.focus();
          assert(await skip.evaluate(el => {
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return document.activeElement === el && (hit === el || el.contains(hit));
          }), 'Skip link stays above the header: ' + route);
        }
        const summary = page.locator(menu + ' > summary');
        assert(!await page.locator(panel).isVisible());
        await summary.press('Enter');
        assert(await page.locator(panel).isVisible(), 'Native keyboard menu: ' + route);
        const lessonLink=page.locator(panel).getByRole('link',{name:'Lessons',exact:true});
        assert(await lessonLink.isVisible(),'Learning destination: '+route);
        assert.equal(new URL(await lessonLink.getAttribute('href'),page.url()).pathname,'/Lessons/','Keep catalogue return selection: '+route);
        const firstLink = page.locator(panel + ' a').first();
        assert(await firstLink.evaluate(el => {
          const r=el.getBoundingClientRect();
          const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          return hit===el || el.contains(hit);
        }), 'Menu is clickable below the header, not clipped: '+route);
        if (['/asdan/', '/uas/'].includes(route)) {
          assert.equal(await page.locator('main h1, body > header:not(.mbm-unified-header) h1').count(), 1, 'Keep register landing heading');
          assert(await page.locator('a').filter({hasText:/Open/}).count() > 0, 'Keep register Open action');
        }
        assert.equal(await page.locator(panel + ' a[href="/games/"], ' + panel + ' a[href$="#about"]').count(), 0);
        if (restricted.includes(route)) {
          assert.equal(await page.locator(header + ' a[href^="/account"], ' + header + ' a[href^="/members"], ' + header + ' a[href^="/mailing-list"]').count(), 0, 'Audience boundary: ' + route);
        }
        if (javaScriptEnabled) {
          await summary.press('Escape');
          assert(!await page.locator(panel).isVisible());
          assert(await summary.evaluate(el => el === document.activeElement), 'Escape returns focus');
        }
        assert.deepEqual(pageErrors, [], 'No page errors: '+route);
        if (javaScriptEnabled) await page.screenshot({path:'audit-output/home-play-discovery/template-390-'+routes.indexOf(route)+'.png',animations:'disabled'});
      }
      if (javaScriptEnabled) {
        // Each distinct front-door template is exercised at narrow phone,
        // tablet and desktop widths, in addition to the 390px contract above.
        for (const width of [320,768,1280]) for (const route of routes) {
          await page.setViewportSize({width,height:900});
          await page.goto(origin+route);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), 'Page reflows: '+route+' at '+width);
          await page.locator(menu+' > summary').press('Enter');
          assert(await page.locator(panel).isVisible());
          const link=page.locator(panel+' a').last();
          await link.scrollIntoViewIfNeeded();
          assert(await link.evaluate(el=>{const r=el.getBoundingClientRect();return r.width>=44&&r.height>=44}), 'Tap target: '+route);
          await page.locator(menu+' > summary').press('Escape');
          assert(await page.locator(menu+' > summary').evaluate(el=>el===document.activeElement));
          await page.screenshot({path:'audit-output/home-play-discovery/template-'+width+'-'+routes.indexOf(route)+'.png',animations:'disabled'});
        }
        for (const width of [320,390]) for (const route of themeRoutes) {
          await page.setViewportSize({width,height:844});
          await page.goto(origin+route);
          await page.locator(menu+' > summary').click();
          await page.locator('.mbm-menu-display > summary').click();
          const blue=page.locator('[data-mbm-theme-slot] button[data-t="blue"]');
          await blue.click();
          assert.equal(await page.locator('html').getAttribute('data-theme'),'blue');
          assert.equal(await blue.getAttribute('aria-pressed'),'true');
          await page.reload();
          assert.equal(await page.locator('html').getAttribute('data-theme'),'blue','Stored theme survives reload');
          await page.locator(menu+' > summary').click();
          await page.locator('.mbm-menu-display > summary').click();
          await page.locator('[data-mbm-theme-slot] button[data-t="cream"]').click();
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
        }
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.goto(origin+'/');
        await page.locator(menu+' > summary').press('Enter');
        assert.equal(await page.locator(menu+' > summary').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
        await page.locator(menu+' > summary').press('Escape');
        await page.getByLabel('Find lessons and resources').fill('PDF Studio');
        await page.locator('.education-home-search button').click();
        assert.equal(new URL(page.url()).pathname,'/resources/');
        assert.equal(new URL(page.url()).searchParams.get('q'),'PDF Studio');
        await page.locator('a[href="/Matt-s-Apps-/PDF_Studio.html"]').first().waitFor({state:'visible'});
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
      assert.deepEqual(pageErrors, [], 'No page errors across all viewport, theme and search journeys');
      await context.close();
      console.log('PASS shared navigation: ' + (javaScriptEnabled ? 'enhanced' : 'without JavaScript'));
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
