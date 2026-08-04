#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const BASE=process.env.APEXPOOL_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.APEXPOOL_ARTIFACT_DIR||path.join('artifacts','apexpool-part-c');
fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0;const results=[];
function rec(name,ok,detail=''){results.push({name,ok,detail});console.log((ok?'  PASS  ':'  FAIL  ')+name+(detail?'   '+detail:''));ok?pass++:fail++;}
async function isolateExternalDependencies(page){
  /* The homepage owns site.json, but its catalogue totals and decorative visit
     counters read cross-repository/public endpoints. Localhost cannot represent
     those origins. Stub only those measured dependencies so C10 reports errors
     introduced by Part C rather than known CORS/404 noise from the test estate. */
  await page.route('https://api.counterapi.dev/**',route=>route.fulfill({status:200,contentType:'application/json',body:'{"value":0,"count":0}'}));
  await page.route('**/Lessons/resources.json',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.route('**/Games/games.json',route=>route.fulfill({status:200,contentType:'application/json',body:'{"games":[]}'}));
  await page.route('**/data/resources.json',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 const consoleErrors=[],pageErrors=[];
 const nojs=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false});
 const nojsPage=await nojs.newPage();await isolateExternalDependencies(nojsPage);await nojsPage.goto(BASE+'/',{waitUntil:'domcontentloaded'});
 const off=await nojsPage.evaluate(()=>{const release=document.querySelector('#newrelease [data-release="Apex Pool"]'),cards=[...document.querySelectorAll('#homeSports [data-sport-game]')];return{release:!!release,heading:release?.querySelector('h3')?.textContent.trim()||'',ctas:release?[...release.querySelectorAll('a')].map(a=>a.getAttribute('href')):[],sports:cards.map(a=>a.getAttribute('data-sport-game')),releaseTag:release?.tagName||'',sportTags:cards.map(a=>a.tagName),scrollW:document.documentElement.scrollWidth,innerW:innerWidth}});
 rec('C2-js-off-new-release',off.release&&/Apex Pool/.test(off.heading)&&off.ctas.includes('/apexpool/'),JSON.stringify(off));
 rec('C3-js-off-sports',JSON.stringify(off.sports)===JSON.stringify(['Apex Kick','Apex Pool']),JSON.stringify(off.sports));
 rec('C6-components-structurally-distinct',off.releaseTag==='DIV'&&off.sportTags.every(x=>x==='A'));
 rec('js-off-no-horizontal-overflow',off.scrollW===off.innerW,`${off.scrollW}/${off.innerW}`);
 await nojsPage.screenshot({path:path.join(OUT,'homepage-js-off-phone.png'),fullPage:true});await nojs.close();

 for(const vp of [{name:'360',width:360,height:900,cols:2,rows:3},{name:'768',width:768,height:1000,cols:3,rows:2},{name:'1200',width:1200,height:1000,cols:3,rows:2}]){
  const context=await browser.newContext({viewport:{width:vp.width,height:vp.height}}),page=await context.newPage();
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(vp.name+': '+m.text())});page.on('pageerror',e=>pageErrors.push(vp.name+': '+e.message));
  await isolateExternalDependencies(page);await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.getAttribute('data-doors')==='12',{timeout:10000});
  const live=await page.evaluate(()=>{const doors=[...document.querySelectorAll('[data-zone] a.dx-prod')].map(a=>({title:a.querySelector('b')?.textContent.trim(),zone:a.parentElement?.getAttribute('data-zone'),href:a.getAttribute('href'),hasArt:!!a.querySelector('svg,img'),artTag:a.querySelector('svg,img')?.tagName||''}));const games=[...document.querySelectorAll('[data-zone="games"]>a.dx-prod')];const positions=games.map(a=>{const r=a.getBoundingClientRect();return{title:a.querySelector('b')?.textContent.trim(),x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2)}});const xs=[...new Set(positions.map(x=>x.x))],ys=[...new Set(positions.map(x=>x.y))];return{doors,positions,cols:xs.length,rows:ys.length,doorCount:document.documentElement.getAttribute('data-doors'),doorArt:document.documentElement.getAttribute('data-doors-art'),kickSports:document.querySelectorAll('[data-sport-game="Apex Kick"]').length,kickDoors:doors.filter(x=>x.title==='Apex Kick').length,poolCount:[document.querySelector('[data-release="Apex Pool"]'),document.querySelector('[data-sport-game="Apex Pool"]')].filter(Boolean).length,offBrand:doors.filter(x=>x.title==='Off-Brand'),empty:[...document.querySelector('[data-zone="games"]').children].filter(x=>!x.textContent.trim()).length,scrollW:document.documentElement.scrollWidth,innerW:innerWidth}});
  rec(vp.name+'-C4-off-brand-door12',live.offBrand.length===1&&live.offBrand[0].zone==='games'&&live.offBrand[0].hasArt&&live.offBrand[0].artTag==='IMG',JSON.stringify(live.offBrand));
  rec(vp.name+'-apex-kick-deliberate-two-surfaces',live.kickSports===1&&live.kickDoors===1,`${live.kickSports}+${live.kickDoors}`);
  rec(vp.name+'-C6-apex-pool-two-distinct',live.poolCount===2,'count '+live.poolCount);
  rec(vp.name+'-C7-twelve-doors-twelve-art',live.doorCount==='12'&&live.doorArt==='12',`${live.doorCount}/${live.doorArt}`);
  rec(vp.name+'-grid-reflow',live.positions.length===6&&live.cols===vp.cols&&live.rows===vp.rows,JSON.stringify(live.positions));
  rec(vp.name+'-C10-no-empty-elements',live.empty===0,'empty '+live.empty);
  rec(vp.name+'-no-horizontal-overflow',live.scrollW===live.innerW,`${live.scrollW}/${live.innerW}`);
  await page.screenshot({path:path.join(OUT,'homepage-live-'+vp.name+'.png'),fullPage:true});await context.close();
 }

 const context=await browser.newContext({viewport:{width:1200,height:1000}}),page=await context.newPage();
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push('theme: '+m.text())});page.on('pageerror',e=>pageErrors.push('theme: '+e.message));await isolateExternalDependencies(page);
 for(const theme of ['cream','pink','blue','light','dark']){await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});await page.evaluate(t=>localStorage.setItem('mbm_reading_theme',t),theme);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.getAttribute('data-doors')==='12',{timeout:10000});const t=await page.evaluate(theme=>{const r=document.querySelector('[data-release="Apex Pool"]'),s=document.querySelector('#homeSports');return{theme,body:document.body.getAttribute('data-theme')||'cream',release:r.getBoundingClientRect().height>0,sports:s.getBoundingClientRect().height>0,overflow:document.documentElement.scrollWidth===innerWidth}},theme);rec('C9-theme-'+theme,t.body===theme&&t.release&&t.sports&&t.overflow,JSON.stringify(t))}await context.close();
 const calm=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:'reduce'}),calmPage=await calm.newPage();calmPage.on('console',m=>{if(m.type()==='error')consoleErrors.push('reduced: '+m.text())});calmPage.on('pageerror',e=>pageErrors.push('reduced: '+e.message));await isolateExternalDependencies(calmPage);await calmPage.goto(BASE+'/',{waitUntil:'domcontentloaded'});await calmPage.waitForFunction(()=>document.documentElement.getAttribute('data-doors')==='12',{timeout:10000});const reduced=await calmPage.evaluate(()=>({release:!!document.querySelector('[data-release="Apex Pool"]'),sports:document.querySelectorAll('#homeSports [data-sport-game]').length,transition:getComputedStyle(document.querySelector('[data-sport-game="Apex Pool"]')).transitionDuration}));rec('C9-reduced-motion',reduced.release&&reduced.sports===2&&(reduced.transition==='0s'||parseFloat(reduced.transition)<.01),JSON.stringify(reduced));await calm.close();
 rec('C10-zero-console-errors',consoleErrors.length===0,consoleErrors.join(' | ')||'none');rec('C10-zero-page-errors',pageErrors.length===0,pageErrors.join(' | ')||'none');
 await browser.close();fs.writeFileSync(path.join(OUT,'browser-report.json'),JSON.stringify({pass,fail,results,consoleErrors,pageErrors},null,2));console.log('\n'+(fail?`${pass} passed, ${fail} FAILED`:`ALL ${pass} PART C BROWSER GATES PASSED`));process.exit(fail?1:0);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1)});
