'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
async function run(){
 const origin=new URL(process.env.MBM_EDUCATION_ORIGIN||'http://127.0.0.1:4173').origin;
 const browser=await chromium.launch();
 try{
  for(const route of ['/Lessons/','/Lessons/subject.html?subject=science']){
   for(const planted of [false,true,false]){
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    let release;const held=new Promise(resolve=>{release=resolve});let waiting=false;
    const page=await context.newPage();
    await page.route(origin+'/Lessons/resources.json',async r=>{waiting=true;await held;await r.continue()});
    if(planted)await page.route(origin+route,async r=>{
     const response=await r.fetch();let text=await response.text();const original=text;
     text=text.replace('if(first&&(!document.activeElement||document.activeElement===document.body))first.focus({preventScroll:true});','if(first)first.focus({preventScroll:true});')
      .replace("if(!document.activeElement||document.activeElement===document.body){if(first&&!$('#seg').hidden)first.focus();else $('#search').focus();}","if(first&&!$('#seg').hidden)first.focus();else $('#search').focus();");
     assert.notEqual(text,original,'Plant the original focus-stealing code');await r.fulfill({response,body:text});
    });
    try{
     await page.goto(origin+route);assert(waiting,'Catalogue request held');
     const summary=page.locator('.mbm-unified-menu>summary'),close=page.locator('.mbm-menu-close');
     await summary.press('Enter');await page.keyboard.press('Tab');
     assert(await close.evaluate(el=>el===document.activeElement),'Keyboard reaches close before catalogue resolves');
     release();await page.waitForLoadState('networkidle');await page.waitForTimeout(100);
     const kept=await close.evaluate(el=>el===document.activeElement&&!!el.closest('details[open]'));
     assert.equal(kept,!planted,(planted?'Planted focus theft must fail':'Existing menu focus must survive')+' '+route);
    }finally{release();await context.close()}
   }
  }
  console.log('PASS initial catalogue focus: Menu retained / original focus theft detected / restored, hub and subject.');
 }finally{await browser.close()}
}
module.exports={run};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
