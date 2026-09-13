#!/usr/bin/env node
'use strict';
// Run against the assembled publication using the established CI browser.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const siteRoot = path.resolve(process.env.MBM_DISCOVERY_SITE || path.join(__dirname, '..'));
const origin = new URL(process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173').origin;
const header = '[data-mbm-navigation="education"]';
const menu = header + ' .mbm-unified-menu';
const panel = header + ' .mbm-unified-panel';
const routes = ['/', '/main/', '/account/', '/members/', '/mailing-list/', '/privacy/',
  '/stats/', '/owner/stats/', '/resources/', '/tools/', '/teach/', '/education-hub/',
  '/for/teachers/', '/for/pupils/', '/for/parents-carers/', '/for/schools-semh/',
  '/for/trusts/', '/for/councils-organisations/', '/for/partners/',
  '/for/governors-trustees/', '/Lessons/', '/Lessons/primary/', '/Matt-s-Apps-/',
  '/stats/on-this-device/', '/asdan/', '/uas/', '/commission/', '/Lessons/Science_Teesside/',
  '/Lessons/Humanities_Teesside/', '/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/',
  '/Lessons/Science_Teesside/Teaching_Packs/', '/Lessons/subject.html'];
const restricted = ['/for/pupils/', '/resources/', '/Lessons/primary/', '/Lessons/subject.html'];
const ux2Routes = ['/', '/commission/', '/for/pupils/', '/for/teachers/', '/resources/'];
const themeRoutes = ['/Lessons/', '/Matt-s-Apps-/', '/Lessons/Science_Teesside/', '/Lessons/Humanities_Teesside/', '/Lessons/subject.html'];
const {deviceStatsSkip}=require('./check_device_stats.cjs');
const {assertChrome, tokenReference, proveChromeControls}=require('./check_chrome_tokens.cjs');
function colourContrast(a,b) {
  const luminance=colour=>{const [r,g,b]=colour.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{
    v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
  });return .2126*r+.7152*g+.0722*b;};
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
async function chromeFocus(control,surface,label,redProof=false) {
  const background=await surface.evaluate(el=>getComputedStyle(el).backgroundColor);
  const check=async()=>{
    const style=await control.evaluate(el=>{const s=getComputedStyle(el);return {active:document.activeElement===el,visible:el.matches(':focus-visible'),width:parseFloat(s.outlineWidth),style:s.outlineStyle,colour:s.outlineColor};});
    assert(style.active&&style.visible&&style.width>=3&&style.style!=='none','Visible keyboard ring: '+label);
    assert(colourContrast(style.colour,background)>=3,'Keyboard ring contrast: '+label+' '+JSON.stringify(style));
  };
  await check();
  if(redProof){
    const original=await control.getAttribute('style');
    try{
      await control.evaluate((el,bg)=>el.style.setProperty('outline-color',bg,'important'),background);
      await assert.rejects(check,/Keyboard ring contrast/,'Invisible planted ring escaped');
    }finally{await control.evaluate((el,style)=>style===null?el.removeAttribute('style'):el.setAttribute('style',style),original);}
    await check();
  }
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const expectedTokens = await tokenReference(browser);
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
        await assertChrome(page, route, expectedTokens);
        const skip = page.locator('body > a.skip, body > a[href^="#"]').first();
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
        await summary.focus();
        await page.keyboard.press('ArrowRight');
        await chromeFocus(summary,page.locator(header),route+' closed header',route==='/');
        await summary.press('Enter');
        assert(await page.locator(panel).isVisible(), 'Native keyboard menu: ' + route);
        await page.keyboard.press('Tab');
        await chromeFocus(page.locator(panel+' .mbm-menu-close'),page.locator(panel),route+' open menu',route==='/');
        const lessonLink=page.locator(panel).getByRole('link',{name:'Lessons',exact:true});
        assert(await lessonLink.isVisible(),'Learning destination: '+route);
        assert.equal(new URL(await lessonLink.getAttribute('href'),page.url()).pathname,'/Lessons/','Keep catalogue return selection: '+route);
        // UX2 B1 — Appendix A §MENU exactly: title + 44px close, three groups in
        // order, audience rows from the record, no deep links, rows ≥48px, Play last.
        {
          const record = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/audience-homepages.json'), 'utf8')).audiences;
          const pupil = route === record.pupils.route;
          assert.equal(await page.locator(panel + ' .mbm-menu-title').innerText(), 'Menu', 'Menu title: ' + route);
          const closeBox = await page.locator(panel + ' .mbm-menu-close').boundingBox();
          assert(closeBox && closeBox.width >= 44 && closeBox.height >= 44, 'Close control is 44px: ' + route + ' ' + JSON.stringify(closeBox));
          const titles = await page.locator(panel + ' .mbm-menu-group h2').evaluateAll(nodes => nodes.map(n => n.textContent.trim()));
          assert.deepEqual(titles, ['Learning', 'Who are you here for?', 'Your account'], 'Three groups in order: ' + route);
          // The Lessons adapter rewrites a[href="/Lessons/"] at runtime to carry the
          // catalogue return selection (asserted above); compare that row by path.
          const groups = await page.locator(panel + ' .mbm-menu-group').evaluateAll(nodes => nodes.map(n => [...n.querySelectorAll('a')].map(a => { const h = a.getAttribute('href'); return [new URL(h, location.href).pathname === '/Lessons/' ? '/Lessons/' : h, a.textContent.trim()]; })));
          const learning = pupil ? [['/Lessons/', 'Lessons'], ['/resources/', 'Resources'], ['/Lessons/primary/', 'Primary lessons']]
            : [['/Lessons/', 'Lessons'], ['/resources/', 'Resources'], ['/Matt-s-Apps-/', 'Apps & tools'], ['/Lessons/primary/', 'Primary lessons']];
          assert.deepEqual(groups[0], learning, 'Learning group: ' + route);
          const who = Object.values(record).map(a => [a.route, a.label]);
          if (!who.some(r => r[0] === '/for/governors-trustees/')) who.push(['/for/governors-trustees/', 'Governors & trustees']);
          assert.deepEqual(groups[1], pupil ? who.filter(r => r[0] === record.pupils.route) : who, 'Audience rows come from the record: ' + route);
          const account = groups[2].map(r => r[0]);
          assert(account.includes('/privacy/') && groups[2].find(r => r[0] === '/privacy/')[1] === 'Privacy and statistics', 'Privacy row: ' + route);
          const full = [['/account/', 'Account and members'], ['/mailing-list/', 'Teacher updates'], ['/privacy/', 'Privacy and statistics']];
          const adultPages = new Set(JSON.parse(fs.readFileSync(path.join(siteRoot, 'data/adult-surfaces.json'), 'utf8')).adultSurfaces.map(x => '/' + x.page.replace(/index\.html$/, '')));
          if (restricted.includes(route)) assert.deepEqual(account, ['/privacy/'], 'Pupil/shared subset of the account group: ' + route);
          else if (adultPages.has(route) || ['/', '/for/governors-trustees/', '/owner/stats/', '/commission/', '/Lessons/', '/Matt-s-Apps-/'].includes(route)) assert.deepEqual(groups[2], full, 'Account group on a declared adult page: ' + route);
          else assert(JSON.stringify(groups[2]) === JSON.stringify(full) || JSON.stringify(account) === JSON.stringify(['/privacy/']), 'Account group is the full set or the shared subset: ' + route);
          const hrefs = await page.locator(panel + ' a').evaluateAll(nodes => nodes.map(a => new URL(a.getAttribute('href'), location.href).pathname === '/Lessons/' ? '/Lessons/' : a.getAttribute('href')));
          assert.deepEqual(hrefs.filter(h => /[?]|\.html$|#/.test(h)), [], 'No deep links in the menu: ' + route);
          const last = page.locator(panel + ' a').last();
          assert.equal(await last.innerText(), 'Made by Matt Play ↗', 'Play is last: ' + route);
          assert.equal(await last.getAttribute('href'), 'https://www.madebymatt-play.uk/', 'Play is a link: ' + route);
          const short = await page.locator(panel + ' a').evaluateAll(nodes => nodes.map(a => a.getBoundingClientRect().height).filter(h => h > 0 && h < 48));
          assert.deepEqual(short, [], 'Every menu row is at least 48px: ' + route);
          assert.equal(await page.locator(header + ' .mbm-unified-brand small').count(), 0, 'No tagline in the header: ' + route);
          const searchLink = page.locator(header + ' .mbm-unified-search');
          const searchBox = await searchLink.boundingBox();
          assert(searchBox && searchBox.width >= 44 && searchBox.height >= 44, 'Header search control is 44px: ' + route);
          const target = await searchLink.getAttribute('href');
          if (target.startsWith('#')) assert.equal(await page.locator('[id="' + target.slice(1) + '"]').count(), 1, 'Header search jumps to a real control: ' + route);
          else assert.equal(target, '/resources/#rxSearch', 'Header search falls back to Resources: ' + route);
          if (javaScriptEnabled) {
            await page.locator(panel + ' .mbm-menu-close').click();
            assert(!await page.locator(panel).isVisible(), 'Close control closes the menu: ' + route);
            assert(await summary.evaluate(el => el === document.activeElement), 'Closing returns focus to the opener: ' + route);
            await summary.press('Enter');
            assert(await page.locator(panel).isVisible());
          }
        }
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
      // Each run uses actual Tab/Enter. Plant exactly the original base/fragment
      // regression, then remove it and prove the same check green again.
      await deviceStatsSkip(page,origin);
      let plantedResponses=0;
      const wrongSkip = async route => {
        const response=await route.fetch();const real=await response.text();
        const planted=real.replace('class="skip" href="/stats/on-this-device/#main"','class="skip" href="#main"');
        assert.notEqual(planted,real,'The wrong-destination control must be planted');
        plantedResponses++;
        await route.fulfill({response,body:planted});
      };
      await page.route(origin+'/stats/on-this-device/',wrongSkip);
      let controlFailed=false;
      try { await deviceStatsSkip(page,origin); } catch(error) { if(error.code!=='ERR_ASSERTION'||!error.message.startsWith('Skip stays on device statistics')) throw error; controlFailed=true; }
      finally { await page.unroute(origin+'/stats/on-this-device/',wrongSkip); }
      assert.equal(plantedResponses,1,'Exactly one planted statistics document was served');
      assert(controlFailed,'Planted wrong statistics skip destination must fail');
      await deviceStatsSkip(page,origin);
      console.log('Device statistics real Tab control: real PASS / planted destination FAIL / restored PASS');
      if (javaScriptEnabled) await proveChromeControls(page,origin,expectedTokens);
      if (javaScriptEnabled) {
        // Follow a real chooser link, then prove the new header reaches the
        // existing subject search without changing catalogue return state.
        await page.goto(origin+'/Lessons/subject.html');
        const science=page.locator('#chooser').getByRole('link',{name:'Science',exact:true});
        await science.waitFor({state:'visible'});
        await science.click();
        await page.getByRole('heading',{name:'Science',exact:true}).waitFor({state:'visible'});
        assert.equal(new URL(page.url()).searchParams.get('subject'),'science');
        assert.equal(await page.locator(header).count(),1,'Subject query keeps the shared header');
        const subjectBack=await page.locator('#back').getAttribute('href');
        assert.equal(new URL(subjectBack,page.url()).pathname,'/Lessons/index.html');
        await page.locator(header+' .mbm-unified-search').click();
        assert(await page.locator('#search').evaluate(el=>el===document.activeElement),'Subject header focuses its existing search');
        await page.locator('#search').fill('sw2-subject-preservation-no-match');
        await page.getByText('No matches — try fewer words or clear a filter.',{exact:true}).waitFor({state:'visible'});
        await page.getByRole('button',{name:'Clear filters',exact:true}).click();
        assert.equal(await page.locator('#search').inputValue(),'');
        assert.equal(await page.locator('#back').getAttribute('href'),subjectBack,'Search keeps the existing Lessons return link');
        // Each distinct front-door template is exercised at narrow phone,
        // tablet and desktop widths, in addition to the 390px contract above.
        for (const width of [320,768,1280]) for (const route of routes) {
          await page.setViewportSize({width,height:900});
          await page.goto(origin+route);
          if(route==='/stats/on-this-device/')await deviceStatsSkip(page,origin);
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
        // UX2 B5 — 44px at 390px on the surfaces this order rebuilt, menu closed
        // and open: every visible interactive target (links, buttons, summaries,
        // fields) is at least 44×44. Each part appends the routes it rebuilt.
        for (const route of ux2Routes) {
          await page.setViewportSize({width:390,height:844});
          await page.goto(origin+route); await page.waitForLoadState('networkidle').catch(()=>{}); await page.waitForTimeout(300);
          const sweep = () => page.evaluate(() => [...document.querySelectorAll('a[href],button,summary,input,select,textarea,[role="button"],[tabindex="0"]')]
            .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; })
            .map(e => { const r = e.getBoundingClientRect(); return { tag: e.tagName, text: (e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; })
            .filter(t => t.w < 44 || t.h < 44));
          assert.deepEqual(await sweep(), [], 'UX2 44px targets, menu closed: '+route);
          await page.locator(menu+' > summary').press('Enter');
          await page.waitForTimeout(150);
          assert(await page.locator(panel).isVisible(), 'UX2 sweep: menu opens with Enter on '+route);
          assert.deepEqual(await sweep(), [], 'UX2 44px targets, menu open: '+route);
          await page.locator(menu+' > summary').press('Escape');
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
        await page.getByLabel('Search lessons, packs and tools').fill('PDF Studio');
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
