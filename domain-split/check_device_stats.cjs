#!/usr/bin/env node
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
async function deviceStatsSkip(page, origin) {
  const route='/stats/on-this-device/';
  // A hash-only goto may retain the old document and keyboard position.
  await page.goto('about:blank');
  await page.goto(origin+route);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://madebymatt.uk'+route);
  assert.equal(await page.locator('meta[property="og:url"]').getAttribute('content'),'https://madebymatt.uk'+route);
  await page.keyboard.press('Tab');
  assert(await page.locator('body > a.skip').evaluate(el=>document.activeElement===el),'First real Tab reaches the device statistics skip link');
  await page.keyboard.press('Enter');
  await page.waitForURL(url=>url.hash==='#main');
  assert.equal(new URL(page.url()).pathname,route,'Skip stays on device statistics');
  assert.equal(new URL(page.url()).hash,'#main');
  assert.equal(await page.locator('main#main').count(),1);
}
module.exports={deviceStatsSkip};
if(require.main===module)(async()=>{
 const origin=new URL(process.env.MBM_EDUCATION_ORIGIN||'http://127.0.0.1:4173').origin;
 const out=process.env.MBM_COMPLETION_OUTPUT||'audit-output/completion/device-stats';
 fs.mkdirSync(out,{recursive:true});const results=[];const browser=await chromium.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await deviceStatsSkip(page,origin);
   await page.screenshot({path:path.join(out,'device-stats-'+width+'.png')});
   let plantedResponses=0;
   const wrongSkip=async route=>{
    const response=await route.fetch(),real=await response.text();
    const planted=real.replace('class="skip" href="/stats/on-this-device/#main"','class="skip" href="#main"');
    assert.notEqual(planted,real,'Plant exactly one original wrong-destination defect');
    plantedResponses++;
    await route.fulfill({response,body:planted});
   };
   await page.route(origin+'/stats/on-this-device/',wrongSkip);
   let rejected=false;
   try{await deviceStatsSkip(page,origin);}catch(error){if(error.code!=='ERR_ASSERTION'||!error.message.startsWith('Skip stays on device statistics'))throw error;rejected=true;}
   finally{await page.unroute(origin+'/stats/on-this-device/',wrongSkip);}
   assert.equal(plantedResponses,1,'Exactly one planted document was served');
   assert(rejected,'Wrong-destination control must be red');
   await deviceStatsSkip(page,origin);assert.deepEqual(errors,[]);
   results.push({width,real:'PASS',planted:'FAIL',restored:'PASS',errors});
   await context.close();
  }
  fs.writeFileSync(path.join(out,'device-stats.json'),JSON.stringify({status:'PASS',origin,results},null,2)+'\n');
  console.log('Device statistics: phone/desktop real Tab and canonical identity; planted controls PASS');
 }catch(error){fs.writeFileSync(path.join(out,'device-stats.json'),JSON.stringify({status:'FAIL',origin,results,error:String(error.stack)},null,2)+'\n');throw error;}
 finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
