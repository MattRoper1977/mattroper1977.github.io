#!/usr/bin/env node
/* HC4 §7.1 — /stats/on-this-device/ works on whichever origin the pupil is on.
 * For each served origin: the route answers 200 with every subresource 200,
 * one counter record is written the way the page's own helper writes it
 * (localStorage "mbm_c_visits_total" as JSON) and the page reads it back into
 * #sxVisits. Real → planted (the page's asset base pointed at a missing path,
 * so its counter script never loads) → restored, per origin. Exit 1 on any
 * failure; the planted run MUST fail or the measurement is invalid. */
'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const ROUTE='/stats/on-this-device/',KEY='mbm_c_visits_total',VALUE=4321,SHOWN='4,321';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
function serve(root){return new Promise(resolve=>{const server=http.createServer((req,res)=>{let p;try{p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://x').pathname));}catch{res.writeHead(400).end();return;}if(!p.startsWith(root)){res.writeHead(403).end();return;}if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');if(!fs.existsSync(p)){res.writeHead(404).end('nf');return;}res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(res);});server.listen(0,'127.0.0.1',()=>resolve(server));});}
async function measure(browser,origin,plant){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();const bad=[],errors=[];
  page.on('response',r=>{if(r.status()>=400)bad.push({url:r.url(),status:r.status()});});
  page.on('pageerror',e=>errors.push(e.message));
  if(plant)await page.route(origin+ROUTE,async route=>{const response=await route.fetch();const real=await response.text();const planted=real.replace('<base href="/stats/">','<base href="/stats/planted-missing/">');assert.notEqual(planted,real,'Plant exactly one asset-base defect');await route.fulfill({response,body:planted});});
  const first=await page.goto(origin+ROUTE,{waitUntil:'load'});
  const result={origin,planted:!!plant,status:first.status(),finalPath:new URL(page.url()).pathname};
  try{
    assert.equal(first.status(),200,'route 200');
    assert.equal(result.finalPath,ROUTE,'stays on the device route');
    // Write one record exactly as the page's helper writes it, then read it back through the page.
    await page.evaluate(({KEY,VALUE})=>localStorage.setItem(KEY,JSON.stringify(VALUE)),{KEY,VALUE});
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(text=>document.getElementById('sxVisits')?.textContent===text,SHOWN,{timeout:4000});
    result.readBack=await page.evaluate(()=>document.getElementById('sxVisits').textContent);
    assert.equal(result.readBack,SHOWN,'record read back');
    assert.deepEqual(bad,[],'every subresource answers');
    assert.deepEqual(errors,[],'no page errors');
    result.canonical=await page.locator('link[rel="canonical"]').getAttribute('href');
    assert.equal(new URL(result.canonical).pathname,ROUTE,'canonical names the device route');
    result.verdict='PASS';
  }catch(error){result.verdict='FAIL';result.reason=error.message;result.readBack=result.readBack||await page.evaluate(()=>document.getElementById('sxVisits')?.textContent||null);result.badResponses=bad;}
  await context.close();return result;
}
(async()=>{
  const roots={education:path.resolve(process.argv[2]||'domain-split/output/education-site'),play:path.resolve(process.argv[3]||'domain-split/output/games')};
  const out=process.env.MBM_DEVICE_STATS_OUTPUT||'audit-output/device-stats-record';fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true});const results=[];let ok=true;
  try{
    for(const [name,root] of Object.entries(roots)){
      const server=await serve(root);const origin='http://127.0.0.1:'+server.address().port;
      const runs=[];
      for(const plant of [false,true,false]){const r=await measure(browser,origin,plant);r.tree=name;runs.push(r);console.log(name,plant?'planted':'real',r.verdict,r.reason||('read back '+r.readBack));}
      const [real,planted,restored]=runs.map(r=>r.verdict);
      const valid=real==='PASS'&&planted==='FAIL'&&restored==='PASS';
      if(!valid)ok=false;
      results.push({tree:name,root,real,planted,restored,valid,runs});
      server.close();
    }
  }finally{await browser.close();}
  fs.writeFileSync(path.join(out,'device-stats-record.json'),JSON.stringify({status:ok?'PASS':'FAIL',route:ROUTE,record:{key:KEY,value:VALUE,shown:SHOWN},results},null,2)+'\n');
  console.log(ok?'DEVICE STATS RECORD: PASS on both origins (real/planted/restored)':'DEVICE STATS RECORD: FAIL');
  if(!ok)process.exitCode=1;
})();
