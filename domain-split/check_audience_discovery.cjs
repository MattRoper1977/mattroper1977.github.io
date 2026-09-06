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
const keys = ['parents', 'schools', 'trusts', 'councils', 'partners'];
const widths = [320, 390, 1280];
const play = 'https://www.madebymatt-play.uk';
const eef = 'https://educationendowmentfoundation.org.uk/education-evidence/guidance-reports/supporting-parents';
const report = {schema:1, origin, startedAt:new Date().toISOString(), cases:[], pageErrors:[], localDestinations:[], fatal:null};
fs.mkdirSync(output, {recursive:true});

const urlFor = route => new URL(route, origin).href;
function sourceDestinations(audience) {
  const html = fs.readFileSync(path.join(source, audience.route, 'index.html'), 'utf8');
  return [...new Set([...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(x => x[1].replaceAll('&amp;', '&')))]
    .filter(x => x && !x.startsWith('#')).map(x => x === '/games/' ? play+'/' : x === '/apexkick/' ? play+'/apexkick/' : x);
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
          await page.locator('.ad-main').waitFor();
          const measure=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
          assert(measure.scroll<=measure.client+1,`Horizontal overflow ${JSON.stringify(measure)}`);
          for(const href of ['/Lessons/','/resources/','/Matt-s-Apps-/','/tools/']) {
            const link=page.locator(`.ad-nav a[href="${href}"]`);
            assert.equal(await link.count(),1,`Missing navigation ${href}`);
            assert(await link.isVisible());
            assert((await link.boundingBox()).height>=44);
          }
          const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
          const expected=sourceDestinations(audience);
          assert.deepEqual(expected.filter(href=>!links.includes(href)),[], 'Original audience destination lost');
          for(const href of links) {
            const u=new URL(href,page.url());
            if(u.origin===origin)destinations.add(u.pathname+u.search);
          }
          for(const forbidden of ['Any device with a web browser','only steering and throttle','one game that can link','Search one deterministic internal index'])
            assert(!(await page.locator('.ad-main').innerText()).includes(forbidden),`Stale claim: ${forbidden}`);
          assert.equal(await page.locator('#audience-play-showcase').count(),1);
          if(key==='parents') {
            assert(await page.locator('a[href="/Lessons/primary/"]').first().isVisible());
            assert.equal(await page.locator('.ad-faq').count(),7);
            for(const name of ['NSPCC','Childnet','CEOP+Safety+Centre'])
              assert.equal(await page.locator(`#trusted-resources a[href="/education-hub/?origin=external&source=${name}"]`).count(),1);
            assert.equal(await page.locator(`#parent-tips a[href="${eef}"]`).count(),1);
            assert((await page.locator('#parent-tips').innerText()).includes('7 December 2018'));
          } else {
            for(const name of ['BUILD','GROW','LAUNCH'])
              assert.equal(await page.locator(`#asdan-learning a[href="/Lessons/${name}_ASDAN/${name}_ASDAN_Hub.html"]`).count(),1);
            assert.equal(await page.locator('#asdan-learning a[href*="year=all"]').count(),1);
          }
          return {route:audience.route,preservedDestinations:expected.length,screenshot:await shot(page,`${width}-${key}-entry`),fullPage:await shot(page,`${width}-${key}-full`,true)};
        });
      }
      await check(`${width}-family-disclosures-and-search`,async()=>{
        await page.goto(urlFor('/for/parents-carers/'),{waitUntil:'networkidle'});
        for(const faq of await page.locator('.ad-faq').all()) {
          await faq.locator('summary').click();
          assert.equal(await faq.getAttribute('open'),'');
          assert(await faq.locator('p').isVisible());
        }
        await page.locator('#faq').scrollIntoViewIfNeeded();
        const faqShot=await shot(page,`${width}-family-faq`);
        await page.locator('#parent-tips').scrollIntoViewIfNeeded();
        const tipsShot=await shot(page,`${width}-family-activities`);
        await page.locator('#audience-search').fill('PDF generator');
        await Promise.all([page.waitForURL(url=>url.pathname==='/resources/'&&url.searchParams.get('q')==='PDF generator'),page.locator('.ad-search button').click()]);
        await page.locator('#rxOut .rx-cardx a[href="/Matt-s-Apps-/PDF_Studio.html"]').first().waitFor();
        await page.goto(urlFor('/for/parents-carers/#faq-device'),{waitUntil:'networkidle'});
        assert.equal(await page.locator('#faq-device').getAttribute('open'),'');
        return {questionsOpened:7,faqShot,tipsShot,resourceQuery:'PDF generator',deepLink:'faq-device'};
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
