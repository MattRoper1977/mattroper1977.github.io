/* Read-only live pinch checks. Local firing controls never replace served bytes. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const http = require('node:http');
const {chromium} = require('playwright');
const input = process.argv[2];
assert(input, 'Pass zoom-publications.json');
const evidence = JSON.parse(fs.readFileSync(input, 'utf8'));
const output = path.dirname(input);
const results = [];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let blocked = false;
const server = http.createServer((req, res) => {
  res.writeHead(200, {'content-type': 'text/html'});
  res.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1'+(blocked?',maximum-scale=1,user-scalable=no':'')+'"><style>html,body{min-height:100%;'+(blocked?'touch-action:none':'touch-action:manipulation')+'}button{padding:20px}</style><body><h1>Pinch control</h1><button>Control</button></body></html>');
});
async function pinch(page) {
  const session = await page.context().newCDPSession(page);
  const attempts = [];
  for (const [x,y] of [[195,90],[195,170],[60,60],[195,300]]) {
    const target = await page.evaluate(({x,y}) => {
      const e=document.elementFromPoint(x,y);
      return e ? {tag:e.tagName,id:e.id,classes:String(e.className),touchAction:getComputedStyle(e).touchAction} : null;
    }, {x,y});
    const before = await page.evaluate(() => visualViewport.scale);
    await session.send('Input.synthesizePinchGesture', {x,y,scaleFactor:2.5,relativeSpeed:800,gestureSourceType:'touch'});
    await delay(200);
    const after = await page.evaluate(() => visualViewport.scale);
    attempts.push({x,y,target,before,after});
    if (after > before * 1.5) break;
  }
  await session.detach();
  return {passed:attempts.some(row => row.after > row.before * 1.5), attempts};
}
async function control(browser) {
  const records=[];
  for(const state of [false,true,false]) {
    blocked=state;
    const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const page=await ctx.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    const result=await pinch(page);
    assert.equal(result.passed,!state,'Pinch firing control failed');
    records.push({plantedBlock:state,...result});
    await ctx.close();
  }
  return records;
}
async function route(browser,row,width) {
  const errors=[],failed=[],thirdParty=[],consoleErrors=[],httpErrors=[];
  const ctx=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390,deviceScaleFactor:1});
  const page=await ctx.newPage();
  page.on('pageerror', error=>errors.push(error.message));
  page.on('console', message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('response', response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
  page.on('requestfailed', request=>failed.push({url:request.url(),error:request.failure()?.errorText}));
  page.on('request', request=>{
    const u=new URL(request.url());
    if(!['http:','https:'].includes(u.protocol))return;
    const allowed=new Set([new URL(row.origin).hostname,'www.'+new URL(row.origin).hostname]);
    if(!allowed.has(u.hostname))thirdParty.push(request.url());
  });
  const result={route:row.route,width,expectedSHA256:row.sha256};
  try {
    const response=await page.goto(row.origin+row.route,{waitUntil:'load',timeout:60000});
    assert(response && response.status()===200,'Live document did not return 200');
    const body=await response.body();
    result.servedSHA256=sha(body);result.finalURL=page.url();
    assert.equal(result.servedSHA256,row.sha256,'Served bytes differ from successful publication artifact');
    await delay(500);
    if(width===390){
      result.pinch=await pinch(page);
      assert(result.pinch.passed,'Actual touch pinch remained blocked at all recorded interface points');
      await page.screenshot({path:path.join(output,'phone-'+row.kind+'-'+row.relative.replace(/[^a-z0-9]/gi,'_')+'.png')});
    }else{
      result.firstTabTarget=null;
      for(let i=0;i<40;i++){
        await page.keyboard.press('Tab');
        const focused=await page.evaluate(()=>{const e=document.activeElement,r=e?.getBoundingClientRect();return e&&e!==document.body&&r.width&&r.height?{tag:e.tagName,id:e.id,label:(e.innerText||e.getAttribute('aria-label')||'').slice(0,100),href:e.getAttribute('href')}:null;});
        if(focused){result.firstTabTarget={tabs:i+1,...focused};break;}
      }
      assert(result.firstTabTarget,'No visible interactive target reached by real Tab');
    }
    assert.equal(errors.length,0,'Unhandled page errors');
    assert.equal(consoleErrors.length,0,'Browser console errors');
    assert.equal(httpErrors.length,0,'HTTP asset errors');
    assert.equal(failed.length,0,'Failed resource requests');
    assert.equal(thirdParty.length,0,'Off-origin resource request');
    result.status='PASS';
  }catch(error){result.status='FAIL';result.reason=error.message;}
  finally{
    result.pageErrors=errors;result.consoleErrors=consoleErrors;result.httpErrors=httpErrors;result.failedRequests=failed;result.offOriginRequests=thirdParty;
    results.push(result);await ctx.close();
    fs.writeFileSync(path.join(output,'zoom-browser.json'),JSON.stringify({scope:evidence.scope,instrumentSHA:evidence.instrument_sha,publications:evidence.publications,results},null,2)+'\n');
    console.log(result.status,row.route,width,result.reason||'');
  }
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch();
  try{
    const controls=await control(browser);
    fs.writeFileSync(path.join(output,'zoom-controls.json'),JSON.stringify(controls,null,2)+'\n');
    for(const row of evidence.rows)for(const width of [390,1280])await route(browser,row,width);
    assert(results.every(row=>row.status==='PASS'),'One or more served routes failed');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
