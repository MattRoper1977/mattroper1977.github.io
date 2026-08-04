#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const BASE=process.env.BIOPUNKHIVE_BASE_URL||'http://127.0.0.1:4173';
const LOCAL=process.env.BIOPUNKHIVE_LOCAL_HTML?fs.readFileSync(process.env.BIOPUNKHIVE_LOCAL_HTML,'utf8'):null;
const OUT=process.env.BIOPUNKHIVE_ARTIFACT_DIR||path.join(__dirname,'..','artifacts','biopunkhive');
fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0;const results=[];
function record(name,ok,detail=''){results.push({name,ok:!!ok,detail:String(detail||'')});if(ok){pass++;console.log('  PASS  '+name+(detail?'   '+detail:''));}else{fail++;console.log('  FAIL  '+name+(detail?'   '+detail:''));}}
async function prepare(page){if(!LOCAL)return;await page.evaluate(()=>{if(window.__bhStoreMap)return;const map=window.__bhStoreMap=new Map();const proxy=new Proxy({}, {get(_t,p){if(p==='getItem')return k=>map.has(String(k))?map.get(String(k)):null;if(p==='setItem')return(k,v)=>map.set(String(k),String(v));if(p==='removeItem')return k=>map.delete(String(k));if(p==='clear')return()=>map.clear();if(p==='key')return i=>[...map.keys()][i]||null;if(p==='length')return map.size;return map.has(String(p))?map.get(String(p)):undefined},ownKeys(){return[...map.keys()]},getOwnPropertyDescriptor(){return{enumerable:true,configurable:true}}});Object.defineProperty(window,'localStorage',{configurable:true,value:proxy})})}
async function boot(page){if(LOCAL){await prepare(page);await page.setContent(LOCAL,{waitUntil:'domcontentloaded'})}else await page.goto(BASE+'/biopunkhive/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__BH_DEBUG&&window.BHCore,{timeout:10000});}
(async()=>{
 const launch={headless:true,args:['--no-sandbox']};if(process.env.BIOPUNKHIVE_CHROMIUM)launch.executablePath=process.env.BIOPUNKHIVE_CHROMIUM;const browser=await chromium.launch(launch);
 const consoleErrors=[],pageErrors=[],requests=[];
 const viewports=[{name:'phone-360',width:360,height:640},{name:'phone-390',width:390,height:844},{name:'tablet',width:768,height:1024},{name:'desktop',width:1366,height:768}];
 for(const vp of viewports){
  const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(vp.name+': '+m.text())});
  page.on('pageerror',e=>pageErrors.push(vp.name+': '+e.message));
  page.on('request',r=>requests.push(r.url()));
  await boot(page);
  const metrics=await page.evaluate(()=>({
    title:document.title,sentinel:window.__BH_DEBUG.sentinel,scrollW:document.documentElement.scrollWidth,innerW:innerWidth,
    live:{role:document.getElementById('liveRegion').getAttribute('role'),aria:document.getElementById('liveRegion').getAttribute('aria-live')},
    canvases:[...document.querySelectorAll('canvas')].map(c=>({w:c.width,h:c.height})),
    targets:[...document.querySelectorAll('button,input[type=range],textarea,a.control')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,w:r.width,h:r.height}})
  }));
  record(vp.name+'-title',metrics.title==='Biopunk Hive — Made by Matt',metrics.title);
  record(vp.name+'-sentinel',metrics.sentinel==='biopunkhive-build-2026-08-04');
  record(vp.name+'-no-horizontal-overflow',metrics.scrollW<=metrics.innerW,`${metrics.scrollW}/${metrics.innerW}`);
  const undersized=metrics.targets.filter(t=>t.w<43.5||t.h<43.5);
  record(vp.name+'-all-visible-targets-44px',undersized.length===0,JSON.stringify(undersized));
  record(vp.name+'-canvas-guard-not-triggered',metrics.canvases.length===2&&metrics.canvases.every(c=>c.w>0&&c.h>0),JSON.stringify(metrics.canvases));
  record(vp.name+'-polite-live-region',metrics.live.role==='status'&&metrics.live.aria==='polite',JSON.stringify(metrics.live));
  await page.screenshot({path:path.join(OUT,vp.name+'.png'),fullPage:true});
  await context.close();
 }

 const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage();
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push('session: '+m.text())});
 page.on('pageerror',e=>pageErrors.push('session: '+e.message));
 page.on('request',r=>requests.push(r.url()));
 await boot(page);

 // G2 sibling storage isolation through a real save/reload cycle.
 const siblings={'apexkick.v1':'{"coins":123}','mbm_apexpool_progress':'{"wins":7}','mbm_apexgolf_progress':'{"best":-2}','voxel.world.7':'{"seed":7}'};
 await page.evaluate(values=>{for(const [k,v] of Object.entries(values))localStorage.setItem(k,v)},siblings);
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(siblings));
 await page.evaluate(()=>{__BH_DEBUG.setCredits(100000);__BH_DEBUG.buy('spec_proto');__BH_DEBUG.save('browser storage fixture')});
 if(LOCAL)await boot(page);else{await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__BH_DEBUG)};
 const after=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(siblings));
 record('browser-sibling-storage-byte-identical',JSON.stringify(before)===JSON.stringify(after),JSON.stringify({before,after}));
 const ownKeys=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('mbm_biopunkhive_')).sort());
 record('browser-own-key-census',JSON.stringify(ownKeys)===JSON.stringify(['mbm_biopunkhive_save']),ownKeys.join(', '));
 const unexpected=await page.evaluate(keys=>Object.keys(localStorage).filter(k=>!keys.includes(k)&&!k.startsWith('mbm_biopunkhive_')),Object.keys(siblings));
 record('browser-no-unexpected-foreign-keys',unexpected.length===0,unexpected.join(', '));

 // Purchase every catalog class and verify live UI refresh.
 await page.evaluate(()=>__BH_DEBUG.setCredits(100000));
 for(const id of ['spec_spore','spec_apex','spec_dome','cryo_cap','cryo_eff'])record('browser-buy-'+id,await page.evaluate(id=>__BH_DEBUG.buy(id),id));
 const cat=await page.evaluate(()=>__BH_DEBUG.catalog().map(x=>({id:x.id,count:x.count,cost:x.cost,label:document.querySelector('[data-buy="'+x.id+'"]').textContent})));
 record('browser-purchase-labels-refresh',cat.every(x=>x.count>=1&&x.label.includes(String(x.cost.toFixed(2)))),JSON.stringify(cat));

 // Click economy and pressure systems.
 const clickBefore=await page.evaluate(()=>__BH_DEBUG.state().credits);await page.locator('#harvestVat').click();const clickAfter=await page.evaluate(()=>__BH_DEBUG.state().credits);
 record('browser-harvest-increases-credits',clickAfter>clickBefore,`${clickBefore} → ${clickAfter}`);
 await page.evaluate(()=>{const s=__BH_DEBUG.state();s.toxUsed=s.toxMax+1;__BH_DEBUG.update()});
 record('browser-overload-copy-visible',(await page.locator('#statusPill').innerText()).includes('OVERLOADED'),await page.locator('#statusPill').innerText());
 const tranqState=await page.evaluate(()=>{const s=__BH_DEBUG.state();__BH_DEBUG.runtime().boostEnd=0;s.credits=100;s.toxUsed=80;__BH_DEBUG.update();document.getElementById('tranqBtn').click();return{tox:s.toxUsed,credits:s.credits}});record('browser-tranq-floors-and-charges',Math.abs(tranqState.tox-55)<.01&&Math.abs(tranqState.credits-60)<.01,JSON.stringify(tranqState));
 await page.evaluate(()=>{const s=__BH_DEBUG.state();s.credits=100;s.breachRisk=70;__BH_DEBUG.update()});await page.locator('#deconBtn').click();
 record('browser-decon-reduces-risk',await page.evaluate(()=>__BH_DEBUG.state().breachRisk<46));

 // Spore is clamped and boost uses timestamps.
 await page.evaluate(()=>__BH_DEBUG.spawnSpore({width:86,height:86}));
 const spore=await page.evaluate(()=>{const e=document.querySelector('.spore-popup'),r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight}});
 record('browser-spore-inside-viewport',spore.x>=0&&spore.y>=0&&spore.right<=spore.w&&spore.bottom<=spore.h,JSON.stringify(spore));
 await page.evaluate(()=>document.querySelector('.spore-popup').click());const boost1=await page.evaluate(()=>__BH_DEBUG.boostRemaining());await page.waitForTimeout(2050);const boost2=await page.evaluate(()=>__BH_DEBUG.boostRemaining());
 record('browser-boost-two-second-stall',Math.abs((boost1-boost2)-2.05)<.35,`${boost1} → ${boost2}`);

 // All three QTE workspaces, minimum targets and timestamp countdown.
 for(const type of ['nodes','sequence','frequency']){
  await page.evaluate(type=>{__BH_DEBUG.setRisk(100);__BH_DEBUG.openQte(type)},type);
  const q=await page.evaluate(()=>({q:__BH_DEBUG.qte(),title:document.getElementById('qteTitle').textContent,targets:[...document.querySelectorAll('.qte-node,.seq-valve,#freqSlider,#freqLock')].map(e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height}})}));
  record('browser-qte-'+type+'-opens',q.q&&q.title.includes('MUTAGEN TIER'),JSON.stringify(q.q));
  record('browser-qte-'+type+'-targets-44px',q.targets.every(t=>t.w>=43.5&&t.h>=43.5),JSON.stringify(q.targets));
  const r1=await page.evaluate(()=>BHCore.remainingSeconds(__BH_DEBUG.qte().deadline,performance.now()));await page.waitForTimeout(1050);const r2=await page.evaluate(()=>BHCore.remainingSeconds(__BH_DEBUG.qte().deadline,performance.now()));
  record('browser-qte-'+type+'-timestamp-countdown',Math.abs((r1-r2)-1.05)<.3,`${r1} → ${r2}`);
  await page.evaluate(()=>__BH_DEBUG.resolveQte(true));
 }
 record('browser-qte-success-risk-reset',await page.evaluate(()=>__BH_DEBUG.state().breachRisk>=20&&__BH_DEBUG.state().breachRisk<21));

 // G12: repeat sirens/mutes; idle census must be empty.
 await page.locator('#harvestVat').click();
 for(let i=0;i<5;i++){
   await page.evaluate(()=>{__BH_DEBUG.setRisk(100);__BH_DEBUG.openQte('nodes')});
   await page.waitForTimeout(40);
   await page.evaluate(success=>__BH_DEBUG.resolveQte(success),i%2===0);
   await page.evaluate(()=>__BH_DEBUG.setMuted(true));
   await page.evaluate(()=>__BH_DEBUG.setMuted(false));
 }
 await page.evaluate(()=>__BH_DEBUG.setMuted(true));await page.waitForTimeout(100);
 const census=await page.evaluate(()=>__BH_DEBUG.audioCensus());
 record('browser-audio-census-zero-idle',census.liveOscillators===0&&!census.siren,JSON.stringify(census));

 // G3 real save calls do not touch the anchor and bank keeps increasing.
 await page.evaluate(()=>{__BH_DEBUG.state().stasisAnchor=Date.now()-120000});
 const anchor0=await page.evaluate(()=>__BH_DEBUG.state().stasisAnchor),bank0=await page.evaluate(()=>__BH_DEBUG.banked());
 for(let i=0;i<3;i++){await page.evaluate(()=>__BH_DEBUG.save('autosave fixture'));await page.waitForTimeout(90)}
 const anchor1=await page.evaluate(()=>__BH_DEBUG.state().stasisAnchor),bank1=await page.evaluate(()=>__BH_DEBUG.banked());
 record('browser-three-saves-anchor-stable',anchor0===anchor1,`${anchor0} → ${anchor1}`);
 record('browser-bank-rises-across-saves',bank1>bank0,`${bank0} → ${bank1}`);
 const creditsBeforeSiphon=await page.evaluate(()=>__BH_DEBUG.state().credits);record('browser-manual-siphon-pays',await page.evaluate(()=>__BH_DEBUG.siphon()));const creditsAfterSiphon=await page.evaluate(()=>__BH_DEBUG.state().credits);
 record('browser-manual-siphon-credit-increase',creditsAfterSiphon>creditsBeforeSiphon,`${creditsBeforeSiphon} → ${creditsAfterSiphon}`);

 // G4 exact browser prestige idempotence.
 await page.evaluate(()=>{const s=__BH_DEBUG.state();s.lifetime=9000;s.totalMutagensClaimed=0;s.mutagens=0;__BH_DEBUG.update()});
 const purged1=await page.evaluate(()=>__BH_DEBUG.purge()),mut1=await page.evaluate(()=>__BH_DEBUG.state().mutagens),purged2=await page.evaluate(()=>__BH_DEBUG.purge()),mut2=await page.evaluate(()=>__BH_DEBUG.state().mutagens);
 record('browser-purge-1-awards-three',purged1&&mut1===3,`${purged1}/${mut1}`);
 record('browser-purge-2-awards-zero',!purged2&&mut2===mut1,`${purged2}/${mut2}`);

 // Import/reset are in-UI and malformed input does not throw or overwrite.
 await page.locator('#exportBtn').click();await page.locator('#saveText').fill('not valid base64');await page.getByRole('button',{name:'Validate Import'}).click();
 record('browser-invalid-import-rejected',(await page.locator('#importNote').innerText()).includes('Import rejected'),await page.locator('#importNote').innerText());
 await page.locator('.closebtn').click();await page.locator('#resetBtn').click();
 record('browser-reset-uses-modal',await page.locator('.modal').isVisible());await page.getByRole('button',{name:'Cancel'}).click();

 // Timestamp-clamped simulated three-minute session across passive/risk loop.
 await page.evaluate(()=>{__BH_DEBUG.setCredits(1000);__BH_DEBUG.buy('spec_proto');__BH_DEBUG.setRisk(0);__BH_DEBUG.advance(180,.25)});
 record('browser-3-minute-scripted-session-finite',await page.evaluate(()=>{const s=__BH_DEBUG.state();return Number.isFinite(s.credits)&&Number.isFinite(s.lifetime)&&s.breachRisk>=0&&s.breachRisk<=100}),JSON.stringify(await page.evaluate(()=>__BH_DEBUG.state())));
 await page.screenshot({path:path.join(OUT,'systems-session.png'),fullPage:true});
 await context.close();

 // Reduced motion preserves meaning and interaction.
 const calm=await browser.newContext({viewport:{width:360,height:640},reducedMotion:'reduce'}),calmPage=await calm.newPage();
 calmPage.on('console',m=>{if(m.type()==='error')consoleErrors.push('reduced: '+m.text())});calmPage.on('pageerror',e=>pageErrors.push('reduced: '+e.message));
 await boot(calmPage);await calmPage.evaluate(()=>{__BH_DEBUG.setCredits(1000);__BH_DEBUG.buy('spec_proto');__BH_DEBUG.setRisk(100)});
 const rm=await calmPage.evaluate(()=>({filter:getComputedStyle(document.querySelector('.goo-filter')).filter,status:document.getElementById('statusPill').textContent,overflow:document.documentElement.scrollWidth<=innerWidth}));
 record('browser-reduced-motion-goo-filter-off',rm.filter==='none',JSON.stringify(rm));
 record('browser-reduced-motion-status-readable',rm.status.includes('LOCKDOWN')&&rm.overflow,JSON.stringify(rm));
 await calmPage.screenshot({path:path.join(OUT,'reduced-motion.png'),fullPage:true});await calm.close();

 const remote=[...new Set(requests.filter(u=>!u.startsWith(BASE)&&!u.startsWith('data:')&&!u.startsWith('about:')))];
 record('browser-zero-remote-requests',remote.length===0,remote.join(', '));
 record('browser-zero-console-errors',consoleErrors.length===0,consoleErrors.join(' | '));
 record('browser-zero-page-errors',pageErrors.length===0,pageErrors.join(' | '));
 await browser.close();
 const report={sentinel:'biopunkhive-build-2026-08-04',base:BASE,pass,fail,results,consoleErrors,pageErrors,remoteRequests:remote};
 fs.writeFileSync(path.join(OUT,'browser-report.json'),JSON.stringify(report,null,2));
 console.log('\n'+'='.repeat(72));console.log(fail===0?`ALL ${pass} BROWSER CHECKS PASSED`:`${pass} passed, ${fail} FAILED`);console.log('='.repeat(72));
 process.exit(fail?1:0);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
