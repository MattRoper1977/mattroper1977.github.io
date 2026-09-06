/* Real publication regression: navigation must not break embedded print HTML. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const origin = process.env.MBM_EDUCATION_ORIGIN || 'http://127.0.0.1:4173';
const output = 'audit-output/print-navigation';
const routes = [
  'Tutor_Time/Wk3_KCSIE_TRAP_Sextortion.html',
  'Tutor_Time/Week2_Fri_Values_MutualRespect_Respectful.html',
  'Assembly/KCSIE/emergency_kcsie_assembly (1).html',
  'Assembly/Behaviour Focus/resilience_assembly.html',
  'Assembly/British Value/rule_of_law_assembly.html',
  'Science_Teesside/Build/v4_fieldops/01_Newport_Bridge_Lift_Permit_Lab.html',
  'Science_Teesside/Build/v4_fieldops/02_Tees_Estuary_Field_Investigation_Lab.html',
  'Science_Teesside/Build/v4_fieldops/03_Wilton_Carbon_Process_Control_Lab.html',
  'Science_Teesside/Build/v4_fieldops/04_Tees_Bay_Wind_Operations_Lab.html'
];
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({headless:true});
  const rows=[], printRows=[];
  try {
    for (const width of [390,1280]) for (const [index,route] of routes.entries()) {
      const context=await browser.newContext({viewport:{width,height:900}});
      const page=await context.newPage(), errors=[];
      page.on('pageerror', error=>errors.push(error.message));
      try {
        const response=await page.goto(new URL('/Lessons/'+route,origin).href,{waitUntil:'networkidle'});
        assert.equal(response.status(),200);
        assert.equal(await page.locator('script[src$="/assets/catalogue/lesson-navigation.js"]').count(),1);
        if (route.startsWith('Science_Teesside/Build/v4_fieldops/')) {
          // These lessons deliberately retain their native toolbar; the adapter updates its return link.
          const home = page.locator('a.mbmhome');
          await home.waitFor({state:'visible'});
          assert.equal(await home.count(),1);
          assert.equal(new URL(await home.getAttribute('href'),page.url()).pathname,'/Lessons/');
          await page.locator('#themeToggle').click();
          assert(await page.locator('body').evaluate(node=>node.classList.contains('light')));
          await page.locator('#themeToggle').click();
          assert.equal(await page.locator('#mbm-lesson-tools').count(),0);
        } else {
          await page.locator('#mbm-lesson-tools').waitFor({state:'visible'});
          assert.equal(await page.locator('#mbm-lesson-tools').count(),1);
        }
        if (index < 2) {
          const layout = await page.evaluate(() => {
            const bar=document.querySelector('#mbm-lesson-tools').getBoundingClientRect();
            const wrap=document.querySelector('body>.wrap').getBoundingClientRect();
            const rail=document.querySelector('.toprail').getBoundingClientRect();
            const active=document.querySelector('.slide.active').getBoundingClientRect();
            return {width:innerWidth,bar:{x:bar.x,y:bar.y,width:bar.width,height:bar.height,bottom:bar.bottom},
              wrap:{x:wrap.x,width:wrap.width,top:wrap.top},railBottom:rail.bottom,contentTop:active.top};
          });
          assert(layout.bar.width >= width-2 && layout.bar.height < 140,'Navigation must be a compact full-width row');
          assert(layout.wrap.width >= Math.min(width,1000)-4 && layout.wrap.top >= layout.bar.bottom-1,'Lesson must retain its reading width below navigation');
          assert(layout.contentTop >= layout.railBottom-1,'Native controls must not overlap teaching content');
          await page.locator('#nextBtn').click();
          assert.match(await page.locator('#slideLbl').textContent(),/^02/);
          await page.locator('#prevBtn').click();
        }
        assert.deepEqual(errors,[],route+' must keep its actual scripts intact');
        const screenshot=`${width}-${String(index+1).padStart(2,'0')}.png`;
        await page.screenshot({path:path.join(output,screenshot)});
        rows.push({route,width,status:'PASS',pageErrors:errors,screenshot});
      } catch(error) {rows.push({route,width,status:'FAIL',error:error.message,pageErrors:errors});}
      finally {await context.close();}
    }
    // Exercise the browser's real print media and PDF renderer as well as
    // the screen navigation controls above. PDFs are retained for visual QA.
    for (const [index,route] of ['/', '/for/governors-trustees/',
      '/Lessons/Science_Teesside/Build/v4_fieldops/01_Newport_Bridge_Lift_Permit_Lab.html'].entries()) {
      const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
      await context.route('**/*', req=>new URL(req.request().url()).origin===new URL(origin).origin ? req.continue() : req.abort());
      const page=await context.newPage();
      try {
        assert.equal((await page.goto(origin+route)).status(),200);
        await page.emulateMedia({media:'print'});
        assert.equal(await page.locator('header.mbm-unified-header:visible,#mbm-lesson-tools:visible').count(),0,'Navigation is omitted from print');
        if (route === '/') assert.equal(await page.locator('.education-home-search:visible').count(),0,'Search controls are omitted from the printed homepage');
        if (route.includes('/v4_fieldops/')) {
          assert(await page.locator('.top .title').isVisible(),'Native printed lab title remains visible');
          assert.match(await page.locator('.top .title').innerText(),/Newport Bridge/);
          assert(await page.locator('h2:visible').count()>0,'Printed lab retains its evidence-section headings');
        } else assert(await page.locator('h1:visible').count()>0,'Printed page retains its heading: '+route);
        const filename='print-template-'+index+'.pdf';
        const pdf=await page.pdf({path:path.join(output,filename),format:'A4',printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'}});
        assert(pdf.length>5000,'Print contains substantive content');
        printRows.push({route,status:'PASS',filename,bytes:pdf.length,media:'print'});
      } finally {await context.close();}
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({cases:rows,printCases:printRows},null,2));
  }
  console.log(JSON.stringify({cases:rows.length,passed:rows.filter(r=>r.status==='PASS').length,failures:rows.filter(r=>r.status==='FAIL')},null,2));
  assert(rows.length===18 && rows.every(r=>r.status==='PASS'));
})().catch(error=>{console.error(error);process.exitCode=1;});
