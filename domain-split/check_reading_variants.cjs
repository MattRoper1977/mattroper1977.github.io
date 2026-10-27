'use strict';
// Preserve the actual reading controls and enumerate subjects from the served chooser.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin=new URL(process.env.MBM_EDUCATION_ORIGIN||'http://127.0.0.1:4173').origin;
async function run(){
 const browser=await chromium.launch();const rows=[];
 try{
  const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();
  const native=['/Lessons/','/Matt-s-Apps-/','/Lessons/Science_Teesside/','/Lessons/Humanities_Teesside/','/Lessons/subject.html'];
  const themes={pink:['rgb(249, 232, 236)','rgb(255, 249, 250)'],blue:['rgb(231, 238, 247)','rgb(248, 251, 255)'],light:['rgb(247, 247, 244)','rgb(255, 255, 255)'],highlumen:['rgb(255, 255, 255)','rgb(255, 255, 255)']};
  for(const width of [390,900,1280]){
   await page.setViewportSize({width,height:900});
   for(const route of native)for(const [theme,[bg,card]] of Object.entries(themes)){
    assert.equal((await page.goto(origin+route)).status(),200);await page.waitForLoadState('networkidle');
    await page.locator('.mbm-unified-menu>summary').click();
    await page.locator('.mbm-menu-display>summary').click();
    await page.locator('[data-mbm-theme-slot] button[data-t="'+theme+'"]').click();
    await page.locator('.mbm-menu-close').click();await page.reload();await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('html').getAttribute('data-theme'),theme,'Preference survives reload');
    const target=route==='/Lessons/'?'.scard':route==='/Lessons/subject.html'?'#chooser>a':'.card';
    await page.locator(target+':visible').first().waitFor();
    const sample=await page.evaluate(selector=>{const b=getComputedStyle(document.body),c=getComputedStyle(document.querySelector(selector));return{bg:b.backgroundColor,card:c.backgroundColor,width:innerWidth,scroll:document.documentElement.scrollWidth}},target);
    assert.equal(sample.bg,bg,route+' '+theme+' reading background');assert.equal(sample.card,card,route+' '+theme+' card');assert(sample.scroll<=width+1,route+' reading overflow');
    if(theme==='highlumen'&&route==='/Matt-s-Apps-/')assert.equal(await page.locator('.hero h1').evaluate(e=>getComputedStyle(e).color),'rgb(0, 0, 0)','High lumen Apps hero retains black on white');
    rows.push({route,width,theme,...sample});
   }
  }
  await page.goto(origin+'/Lessons/subject.html');await page.locator('#chooser>a').first().waitFor();
  const variants=await page.locator('#chooser>a').evaluateAll(es=>es.map(e=>new URL(e.href).pathname+new URL(e.href).search));assert(variants.length>1,'Real subject population');
  for(const width of [390,900,1280])for(const theme of ['cream','dark'])for(const route of variants){
   await page.setViewportSize({width,height:900});
   await page.evaluate(t=>localStorage.setItem('mbm_reading_theme',t),theme);
   assert.equal((await page.goto(origin+route)).status(),200);await page.waitForLoadState('networkidle');
   assert(await page.locator('#sub-name').textContent(),'Named subject');
   assert.equal(await page.locator('.mbm-unified-header').getAttribute('data-mbm-variant'),'pupil');
   assert.equal(await page.locator('.mbm-unified-saved').count(),0);
   const sample=await page.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor,width:innerWidth,scroll:document.documentElement.scrollWidth,rows:document.querySelectorAll('.lrow').length}));
   assert.equal(sample.bg,theme==='dark'?'rgb(8, 20, 34)':'rgb(246, 241, 231)');assert(sample.scroll<=width+1,'Subject overflow '+route);
   rows.push({route,width,theme,...sample});
  }
  fs.mkdirSync('audit-output/education-navigation',{recursive:true});fs.writeFileSync('audit-output/education-navigation/part-t-reading-variants.json',JSON.stringify({status:'PASS',variants,rows},null,2));
  console.log('PASS Part T reading themes and '+variants.length+' record-derived subject variants: '+rows.length+' cases.');
  await context.close();
 }finally{await browser.close()}
}
module.exports={run};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
