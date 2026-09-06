#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const BASE=process.env.APEXPOOL_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.APEXPOOL_ARTIFACT_DIR||path.join(__dirname,'..','artifacts','apexpool');
fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0;const results=[];
function record(name,ok,detail=''){results.push({name,ok,detail});if(ok){pass++;console.log('  PASS  '+name+(detail?'   '+detail:''));}else{fail++;console.log('  FAIL  '+name+(detail?'   '+detail:''));}}
async function waitBoot(page){await page.goto(BASE+'/apexpool/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__AP_DEBUG&&window.AP,{timeout:10000});await page.waitForFunction(()=>!document.getElementById('mbmSplash'),{timeout:4000});}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const consoleErrors=[],pageErrors=[],requests=[];
 const viewports=[
  {name:'phone-portrait',width:390,height:844},
  {name:'tablet-portrait',width:768,height:1024},
  {name:'tablet-landscape',width:1024,height:768},
  {name:'laptop',width:1366,height:768},
  {name:'desktop',width:1536,height:864}
 ];
 for(const vp of viewports){
  const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(vp.name+': '+m.text())});
  page.on('pageerror',e=>pageErrors.push(vp.name+': '+e.message));
  page.on('request',r=>requests.push(r.url()));
  await waitBoot(page);
  const title=await page.locator('.wordmark').innerText();
  record(vp.name+'-title',/APEX\s*POOL/i.test(title),title.replace(/\s+/g,' '));
  const metrics=await page.evaluate(()=>({canvas:document.querySelectorAll('canvas').length,w:document.getElementById('table').width,h:document.getElementById('table').height,scrollW:document.documentElement.scrollWidth,innerW:innerWidth,scrollH:document.documentElement.scrollHeight,innerH:innerHeight,debug:window.__AP_DEBUG.sentinel}));
  const canvasContract=await page.evaluate(()=>{const a=document.getElementById('v6Advisory'),s=getComputedStyle(a);return{count:document.querySelectorAll('canvas').length,advisoryHidden:a.getAttribute('aria-hidden'),pointerEvents:s.pointerEvents}});
  record(vp.name+'-authoritative-plus-advisory-canvases',metrics.canvas===2&&metrics.w>0&&metrics.h>0&&canvasContract.advisoryHidden==='true'&&canvasContract.pointerEvents==='none',JSON.stringify(canvasContract));
  record(vp.name+'-no-page-overflow',metrics.scrollW===metrics.innerW&&metrics.scrollH===metrics.innerH,JSON.stringify(metrics));
  record(vp.name+'-sentinel',metrics.debug==='apexpool-build-2026-08-04');
  await page.screenshot({path:path.join(OUT,vp.name+'-title.png'),fullPage:true});
  const rotateVisible=await page.locator('#rotateHint').isVisible();
  if(vp.height>vp.width){
   record(vp.name+'-portrait-path-unblocked',!rotateVisible);
   if(rotateVisible)await page.locator('#dismissRotate').click();
  }else record(vp.name+'-no-rotation-blocker',!rotateVisible);
  await page.locator('[data-mode="classic"]').click();
  await page.waitForFunction(()=>window.__AP_DEBUG.state().running&&window.__AP_DEBUG.state().phase==='aim');
  const game=await page.evaluate(()=>{const g=window.__AP_DEBUG.state(),q=window.AP.cue(g.world);return{hud:!document.getElementById('hud').classList.contains('hidden'),balls:g.world.balls.length,q:{x:q.x,y:q.y},mode:g.mode,phase:g.phase,aria:document.getElementById('live').getAttribute('aria-live')}});
  record(vp.name+'-game-starts',game.hud&&game.balls===16&&game.mode==='classic'&&game.phase==='aim',JSON.stringify(game));
  record(vp.name+'-polite-live-region',game.aria==='polite');
  await page.screenshot({path:path.join(OUT,vp.name+'-game.png'),fullPage:true});
  await context.close();
 }

 /* Spin-aware prediction, keyboard leave marker and exact announcement. */
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push('interaction: '+m.text())});page.on('pageerror',e=>pageErrors.push('interaction: '+e.message));
 await waitBoot(page);await page.locator('[data-mode="classic"]').click();await page.waitForFunction(()=>window.__AP_DEBUG.state().phase==='aim');
 const predictions=await page.evaluate(()=>{const d=window.__AP_DEBUG,g=d.state(),out={};for(const s of [-1,0,1]){g.spinY=s;g.spinX=.2;g.power=.72;const p=d.computePrediction();out[s]=p.final;}return out;});
 const px=[predictions['-1'].x,predictions['0'].x,predictions['1'].x];
 record('browser-spin-predictions-differ',new Set(px.map(x=>x.toFixed(3))).size===3,JSON.stringify(predictions));
 await page.locator('#table').focus();await page.keyboard.press('c');await page.waitForFunction(()=>window.__AP_DEBUG.state().called!==null);
 const beforeCall=await page.evaluate(()=>({...window.__AP_DEBUG.state().called}));await page.keyboard.press('l');const afterCall=await page.evaluate(()=>({...window.__AP_DEBUG.state().called}));
 record('keyboard-leave-marker-moves',afterCall.x>beforeCall.x,`${beforeCall.x.toFixed(1)} → ${afterCall.x.toFixed(1)}`);
 const exact=await page.evaluate(()=>window.AP.ratingAnnouncement(96,false,12.4));
 record('browser-exact-rating-string',exact==='Leave Rating 96 out of 100. Dead-on. The pot was missed. Position is scored independently. Called leave distance 12 table units.',exact);

 /* Storage isolation: preserve sibling values byte-for-byte through a complete
    match lifecycle and Apex Pool progress write. */
 const sibling={
  'apexkick.v1':'{"coins":123,"squad":[1,2,3]}',
  'apexkick.muted':'true',
  'mbm_apexgolf_progress':'{"best":-0.25,"holes":9}',
  'mbm_voxel_save':'00ffAA==',
  'voxel.world.7':'{\"seed\":7,\"blocks\":[1,2]}'
 };
 await page.evaluate(values=>{for(const [k,v] of Object.entries(values))localStorage.setItem(k,v);},sibling);
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(sibling));
 await page.evaluate(()=>{const d=window.__AP_DEBUG;d.setCall(500,260,true);d.finishMatch(true,'Storage isolation browser fixture.');});
 await page.waitForSelector('#homeAfter');
 const after=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(sibling));
 record('browser-sibling-storage-byte-identical',JSON.stringify(before)===JSON.stringify(after),JSON.stringify({before,after}));
 const ownKeys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('mbm_apexpool_')).sort());
 record('browser-apexpool-storage-created',ownKeys.length>0&&ownKeys.every(k=>/^mbm_apexpool_/.test(k)),ownKeys.join(', '));
 const foreignWrites=await page.evaluate(keys=>Object.keys(localStorage).filter(k=>!keys.includes(k)&&!k.startsWith('mbm_apexpool_')&&k!=='madebymatt_v6_profile'),Object.keys(sibling));
 const profileScope=await page.evaluate(()=>{try{const p=JSON.parse(localStorage.getItem('madebymatt_v6_profile')||'null');return !!(p&&p.version===6&&p.games&&p.games['apex-pool']&&Object.keys(p.games).every(k=>k==='apex-pool'));}catch(e){return false;}});
 record('browser-no-unexpected-foreign-keys',foreignWrites.length===0&&profileScope,(foreignWrites.join(', ')||'schema-6 profile contains apex-pool only'));
 await page.screenshot({path:path.join(OUT,'interaction-result.png'),fullPage:true});await context.close();

 /* Reduced motion: splash still clears and game remains usable. */
 const calm=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:'reduce'}),calmPage=await calm.newPage();
 calmPage.on('pageerror',e=>pageErrors.push('reduced: '+e.message));await waitBoot(calmPage);await calmPage.locator('[data-mode="rough"]').click();await calmPage.waitForFunction(()=>window.__AP_DEBUG.state().mode==='rough');
 const calmState=await calmPage.evaluate(()=>({running:window.__AP_DEBUG.state().running,reason:window.__AP_DEBUG.hazards.rough.reason,roughText:document.body.textContent.includes('Rough Patch')}));
 record('reduced-motion-remains-playable',calmState.running,JSON.stringify(calmState));record('rough-mode-declares-visible-force',/patterned and labelled/i.test(calmState.reason));
 await calmPage.screenshot({path:path.join(OUT,'reduced-motion-rough.png'),fullPage:true});await calm.close();

 /* Hazard status is exhaustive in the live browser. */
 const hazardCheck=await browser.newPage();await waitBoot(hazardCheck);const hazards=await hazardCheck.evaluate(()=>Object.values(window.__AP_DEBUG.hazards).map(h=>({id:h.id,enabled:h.leaveEnabled,reason:h.reason,visible:h.visibleForces})));
 record('browser-all-modes-declare-leave-status',hazards.length>=7&&hazards.every(h=>typeof h.enabled==='boolean'&&h.reason&&Array.isArray(h.visible)),JSON.stringify(hazards));await hazardCheck.close();

 const remote=requests.filter(u=>!u.startsWith(BASE)&&!u.startsWith('data:')&&!u.startsWith('about:'));
 record('browser-no-remote-resource-requests',remote.length===0,[...new Set(remote)].join(', '));
 record('browser-no-console-errors',consoleErrors.length===0,consoleErrors.join(' | '));
 record('browser-no-page-errors',pageErrors.length===0,pageErrors.join(' | '));
 await browser.close();
 const report={sentinel:'apexpool-build-2026-08-04',base:BASE,pass,fail,results,consoleErrors,pageErrors,remoteRequests:[...new Set(remote)]};
 fs.writeFileSync(path.join(OUT,'browser-report.json'),JSON.stringify(report,null,2));
 console.log('\n'+'='.repeat(72));console.log(fail===0?`ALL ${pass} BROWSER CHECKS PASSED`:`${pass} passed, ${fail} FAILED`);console.log('='.repeat(72));
 process.exit(fail?1:0);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
