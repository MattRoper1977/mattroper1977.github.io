#!/usr/bin/env node
'use strict';

// Run against the assembled site. This verifier does not alter the interface.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const origin = new URL(process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173').origin;
const source = path.resolve(process.env.MBM_AUDIENCE_SITE || path.join(__dirname, '..'));
const output = path.resolve(process.env.MBM_AUDIENCE_OUTPUT || 'audit-output/audience-discovery');
const data = JSON.parse(fs.readFileSync(path.join(source, 'data/audience-homepages.json'), 'utf8')).audiences;
const pages = JSON.parse(fs.readFileSync(path.join(__dirname, 'audience-pages.json'), 'utf8')).pages;
const keys = ['parents', 'schools', 'trusts', 'councils', 'partners'];
const widths = [320, 390, 1280];
const play = 'https://www.madebymatt-play.uk';
const eef = 'https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/supporting-parents';
const report = {schema:1, origin, startedAt:new Date().toISOString(), cases:[], pageErrors:[], localDestinations:[], fatal:null};
fs.mkdirSync(output, {recursive:true});

const urlFor = route => new URL(route, origin).href;
// UX2 B1: the source page's chrome (header/footer) is replaced by the shared
// Appendix A menu, which carries no deep links. Body destinations must survive
// on the page; a chrome destination the menu no longer offers must be a recorded
// relocation (domain-split/ux2/menu-relocations.json) — never silently lost.
const relocations = JSON.parse(fs.readFileSync(path.join(__dirname, 'ux2/menu-relocations.json'), 'utf8')).relocated;
function hrefsIn(html) {
  return [...new Set([...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(x => x[1].replaceAll('&amp;', '&')))]
    .filter(x => x && !x.startsWith('#')).map(x => x === '/games/' ? play+'/' : x === '/apexkick/' ? play+'/' : x);
}
function sourceDestinations(audience) {
  const html = fs.readFileSync(path.join(source, audience.route, 'index.html'), 'utf8');
  const main = html.match(/<main\b[\s\S]*?<\/main>/);
  assert(main, 'Source audience page has one main region: ' + audience.route);
  return { body: hrefsIn(main[0]), chrome: hrefsIn(html.replace(main[0], '')) };
}
async function shot(page, name, fullPage=false) {
  const file = name+'.png';
  await page.screenshot({path:path.join(output,file), fullPage, animations:'disabled'});
  return file;
}
async function check(name, run) {
  const item={name,ok:false};report.cases.push(item);
  try {item.evidence=await run();item.ok=true;} catch(error) {item.error=error.stack||String(error);}
}

(async()=>{
  let browser;
  const destinations = new Set();
  try {
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({reducedMotion:'reduce'});
    const page=await context.newPage();
    page.on('pageerror',error=>report.pageErrors.push({url:page.url(),message:error.message}));
    for(const width of widths) {
      await page.setViewportSize({width,height:900});
      for(const key of keys) {
        const audience=data[key];
        await check(`${width}-${key}-entry`,async()=>{
          const response=await page.goto(urlFor(audience.route),{waitUntil:'networkidle'});
          assert.equal(response.status(),200);
          await page.locator('main#main').waitFor();
          const measure=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
          assert(measure.scroll<=measure.client+1,`Horizontal overflow ${JSON.stringify(measure)}`);
          // The page is filled the governors way: hero, prompts, publisher cards. Each one must be
          // painted, not merely present (the old pages were present and invisible on a phone).
          const spec=pages[key];
          assert.equal(await page.locator('main h1').innerText(),spec.title);
          const painted=await page.locator('main .gv-hero, main .gv-prompts, main .gv-card, main .gv-finder').evaluateAll(nodes=>nodes.map(n=>{const s=getComputedStyle(n),b=n.getBoundingClientRect();return {ok:s.opacity==='1'&&s.visibility==='visible'&&s.display!=='none'&&b.width>0&&b.height>0,cls:n.className};}));
          assert.deepEqual(painted.filter(x=>!x.ok),[],'Every hero, prompt, finder and card is painted');
          assert.equal(await page.locator('[data-governance-card]').count(),spec.resources.length);
          for(const row of spec.resources) {
            const open=page.locator(`[data-governance-card][data-id="${row.id}"] .gv-open`);
            assert.equal(await open.getAttribute('href'),row.url);
            if(row.origin!=='made-by-matt') assert(row.url.startsWith('https://'),row.url);
          }
          assert.equal(await page.locator('.gv-prompt-grid article').count(),4);
          // One navigation only: the shared header. No second row of area buttons, no old "Apps & tools" button.
          assert.equal(await page.locator('nav[aria-label="Learning areas"], .ad-nav, .gv-learning').count(),0,'Duplicate learning-area buttons');
          for(const href of ['/Lessons/','/resources/','/tools/']) assert.equal(await page.locator(`header [data-mbm-hub-links] a[href="${href}"]`).count(),1,`Header link ${href}`);
          assert.equal(await page.getByRole('link',{name:'Apps & tools',exact:true}).count(),0,'Old Apps & tools button');
          assert.equal(await page.locator('footer').count(),1,'One footer');
          const text=await page.locator('main').innerText();
          assert(!/ASDAN/.test(text),'Awarding-body name in visible text');
          const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
          const expected=sourceDestinations(audience);
          assert.deepEqual(expected.body.filter(href=>!links.includes(href)),[], 'Original audience destination lost');
          const droppedChrome=expected.chrome.filter(href=>!links.includes(href));
          assert.deepEqual(droppedChrome.filter(href=>!(href in relocations)),[], 'A chrome destination the menu no longer carries is not a recorded relocation');
          for(const href of links) {
            const u=new URL(href,page.url());
            if(u.origin===origin)destinations.add(u.pathname+u.search);
          }
          for(const forbidden of ['Any device with a web browser','only steering and throttle','one game that can link','Search one deterministic internal index'])
            assert(!text.includes(forbidden),`Stale claim: ${forbidden}`);
          assert.equal(await page.locator('#audience-play-showcase').count(),1);
          assert.equal(await page.locator('#audience-play-showcase video, #audience-play-showcase iframe, .mbm-play-card').count(),0);
          assert.equal(await page.locator('#audience-play-showcase a').getAttribute('href'),play+'/');
          if(key==='parents') {
            assert(await page.locator('main a[href="/Lessons/primary/"]').first().isVisible());
            assert.equal(await page.locator('.gv-faq').count(),7);
            for(const name of ['NSPCC','Childnet','CEOP+Safety+Centre'])
              assert.equal(await page.locator(`#trusted-resources a[href="/education-hub/?origin=external&source=${name}"]`).count(),1);
            assert.equal(await page.locator(`#parent-tips a[href="${eef}"]`).count(),1);
            assert((await page.locator('#parent-tips').innerText()).includes('7 December 2018'));
          } else {
            for(const name of ['BUILD','GROW','LAUNCH'])
              assert.equal(await page.locator(`[data-governance-card] a[href="/Lessons/${name}_ASDAN/${name}_ASDAN_Hub.html"]`).count(),1);
            assert.equal(await page.locator('#trusted-resources a[href*="year=all"]').count(),1);
          }
          const entryShot=await shot(page,`${width}-${key}-entry`);
          return {route:audience.route,cards:spec.resources.length,preservedDestinations:expected.body.length,relocatedChrome:droppedChrome,screenshot:entryShot,fullPage:await shot(page,`${width}-${key}-full`,true)};
        });
        await check(`${width}-${key}-search-filters`,async()=>{
          const visible='[data-governance-card]:not([hidden])', total=pages[key].resources.length;
          await page.locator('#gv-search').fill('this cannot match any resource 8675309');
          assert.equal(await page.locator(visible).count(),0);
          assert(await page.locator('#gv-empty').isVisible());
          await page.getByRole('button',{name:'Clear filters'}).click();
          await page.waitForFunction(n=>document.querySelectorAll('[data-governance-card]:not([hidden])').length===n,total);
          await page.locator('#gv-origin').selectOption('made-by-matt');
          assert.equal(await page.locator(visible).count(),pages[key].resources.filter(r=>r.origin==='made-by-matt').length);
          await page.getByRole('button',{name:'Clear filters'}).click();
          await page.waitForFunction(n=>document.querySelectorAll('[data-governance-card]:not([hidden])').length===n,total);
          return {total};
        });
      }
      await check(`${width}-family-disclosures`,async()=>{
        await page.goto(urlFor('/for/parents-carers/'),{waitUntil:'networkidle'});
        for(const faq of await page.locator('.gv-faq').all()) {
          await faq.locator('summary').click();
          assert.equal(await faq.getAttribute('open'),'');
          assert(await faq.locator('p').isVisible());
        }
        await page.locator('#faq').scrollIntoViewIfNeeded();
        const faqShot=await shot(page,`${width}-family-faq`);
        await page.locator('#parent-tips').scrollIntoViewIfNeeded();
        const tipsShot=await shot(page,`${width}-family-activities`);
        return {questionsOpened:7,faqShot,tipsShot};
      });
    }
    await check('all-audience-local-destinations-return-200',async()=>{
      const routes=[...destinations].sort();
      for(let i=0;i<routes.length;i+=8) {
        await Promise.all(routes.slice(i,i+8).map(async route=>{
          const response=await context.request.get(urlFor(route));
          report.localDestinations.push({route,status:response.status()});
          assert.equal(response.status(),200,route);
        }));
      }
      return {checked:routes.length};
    });
    await check('no-browser-errors',async()=>{assert.deepEqual(report.pageErrors,[]);return {errors:0};});
  }catch(error){report.fatal=error.stack||String(error);}
  finally {
    if(browser)await browser.close();
    report.passed=report.cases.filter(x=>x.ok).length;
    report.failed=report.cases.length-report.passed;
    report.result=report.failed||report.fatal?'FAIL':'PASS';
    report.finishedAt=new Date().toISOString();
    fs.writeFileSync(path.join(output,'audience-discovery.json'),JSON.stringify(report,null,2)+'\n');
    console.log(`${report.result}: ${report.passed}/${report.cases.length} audience checks; ${report.localDestinations.length} local destinations.`);
    if(report.result!=='PASS'){console.error(report.fatal||report.cases.filter(x=>!x.ok).map(x=>`${x.name}: ${x.error}`).join('\n'));process.exitCode=1;}
  }
})();
