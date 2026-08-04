#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const BASE=(process.env.APEXTENNIS_HOME_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const OUT=process.env.APEXTENNIS_HOME_ARTIFACT_DIR||path.join('artifacts','apextennis-home');
fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0;const results=[];
function rec(name,ok,detail=''){results.push({name,ok,detail});console.log((ok?'  PASS  ':'  FAIL  ')+name+(detail?'   '+detail:''));ok?pass++:fail++;}
async function isolate(page){
 await page.route('https://api.counterapi.dev/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"value":0,"count":0}'}));
 await page.route('**/Lessons/resources.json',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await page.route('**/Games/games.json',r=>r.fulfill({status:200,contentType:'application/json',body:'{"games":[]}'}));
 await page.route('**/data/resources.json',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
(async()=>{let browser;try{browser=await chromium.launch({headless:true});
 const nojs=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false,reducedMotion:'reduce'}),nojsPage=await nojs.newPage();
 await isolate(nojsPage);const nojsResponse=await nojsPage.goto(BASE+'/',{waitUntil:'domcontentloaded'});
 const off=await nojsPage.evaluate(()=>{const cards=[...document.querySelectorAll('#homeSports [data-sport-game]')];const release=document.querySelector('#newrelease [data-release="Apex Pool"]');return{cards:cards.map(a=>({title:a.getAttribute('data-sport-game'),href:a.getAttribute('href'),tag:a.tagName})),release:!!release,releaseTitle:release?.querySelector('h3')?.textContent.trim()||'',releaseLinks:release?[...release.querySelectorAll('a')].map(a=>a.getAttribute('href')):[],scrollW:document.documentElement.scrollWidth,innerW:innerWidth}});
 rec('js-off-page-200',nojsResponse&&nojsResponse.status()===200,nojsResponse?String(nojsResponse.status()):'none');
 rec('js-off-four-hardcoded-sports',JSON.stringify(off.cards.map(x=>x.title))===JSON.stringify(['Apex Kick','Apex Pool','Apex Golf','Apex Tennis']),JSON.stringify(off.cards));
 rec('js-off-sports-links',JSON.stringify(off.cards.map(x=>x.href))===JSON.stringify(['/apexkick/','/apexpool/','/apexgolf/','/apextennis/']));
 rec('js-off-anchor-components',off.cards.every(x=>x.tag==='A'));
 rec('js-off-pool-keeps-new-release',off.release&&/Apex Pool/.test(off.releaseTitle)&&off.releaseLinks.includes('/apexpool/'),JSON.stringify(off));
 rec('js-off-no-horizontal-overflow',off.scrollW===off.innerW,`${off.scrollW}/${off.innerW}`);
 await nojsPage.screenshot({path:path.join(OUT,'homepage-js-off-390.png'),fullPage:true});await nojs.close();
 const globalConsole=[],globalPage=[],globalBad=[];
 for(const vp of [{name:'360',width:360,height:900,cols:2,rows:4},{name:'768',width:768,height:1000,cols:3,rows:3},{name:'1200',width:1200,height:1000,cols:3,rows:3}]){
  const context=await browser.newContext({viewport:{width:vp.width,height:vp.height}}),page=await context.newPage(),consoleErrors=[],pageErrors=[],bad=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('pageerror',e=>pageErrors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url())});
  await isolate(page);const response=await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.getAttribute('data-doors')==='14'&&document.documentElement.getAttribute('data-doors-art')==='14',{timeout:10000});
  await page.waitForFunction(()=>['Apex Golf','Apex Tennis'].every(t=>{const a=[...document.querySelectorAll('[data-zone="games"]>a.dx-prod')].find(x=>x.querySelector('b')?.textContent.trim()===t),img=a?.querySelector('img');return !!img&&img.complete&&img.naturalWidth>0}),{timeout:10000});
  const live=await page.evaluate(()=>{const title=a=>a.querySelector('b')?.textContent.trim()||'';const sport=[...document.querySelectorAll('#homeSports [data-sport-game]')].map(a=>({title:a.getAttribute('data-sport-game'),href:a.getAttribute('href')}));const doors=[...document.querySelectorAll('[data-zone] a.dx-prod')].map(a=>({title:title(a),zone:a.parentElement?.getAttribute('data-zone'),href:a.getAttribute('href'),art:a.querySelector('img,svg')?.tagName||'',loaded:!a.querySelector('img')||(a.querySelector('img').complete&&a.querySelector('img').naturalWidth>0)}));const games=[...document.querySelectorAll('[data-zone="games"]>a.dx-prod')];const positions=games.map(a=>{const r=a.getBoundingClientRect();return{title:title(a),x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2)}});return{sport,doors,positions,cols:new Set(positions.map(x=>x.x)).size,rows:new Set(positions.map(x=>x.y)).size,doorCount:document.documentElement.getAttribute('data-doors'),artCount:document.documentElement.getAttribute('data-doors-art'),release:document.querySelectorAll('#newrelease [data-release="Apex Pool"]').length,tennisRelease:document.querySelectorAll('#newrelease [data-release="Apex Tennis"]').length,empty:[...document.querySelector('[data-zone="games"]').children].filter(x=>!x.textContent.trim()).length,scrollW:document.documentElement.scrollWidth,innerW:innerWidth}});
  const named=t=>live.doors.filter(x=>x.title===t);
  rec(vp.name+'-page-200',response&&response.status()===200,response?String(response.status()):'none');
  rec(vp.name+'-four-hardcoded-sports',JSON.stringify(live.sport.map(x=>x.title))===JSON.stringify(['Apex Kick','Apex Pool','Apex Golf','Apex Tennis']),JSON.stringify(live.sport));
  rec(vp.name+'-sports-links',JSON.stringify(live.sport.map(x=>x.href))===JSON.stringify(['/apexkick/','/apexpool/','/apexgolf/','/apextennis/']));
  rec(vp.name+'-fourteen-doors-art',live.doorCount==='14'&&live.artCount==='14',`${live.doorCount}/${live.artCount}`);
  rec(vp.name+'-eight-game-grid',live.positions.length===8&&live.cols===vp.cols&&live.rows===vp.rows,JSON.stringify(live.positions));
  rec(vp.name+'-kick-door-preserved',named('Apex Kick').length===1&&named('Apex Kick')[0].href==='apexkick/');
  rec(vp.name+'-golf-relative-door',named('Apex Golf').length===1&&named('Apex Golf')[0].href==='apexgolf/'&&named('Apex Golf')[0].art==='IMG'&&named('Apex Golf')[0].loaded,JSON.stringify(named('Apex Golf')));
  rec(vp.name+'-tennis-relative-door',named('Apex Tennis').length===1&&named('Apex Tennis')[0].href==='apextennis/'&&named('Apex Tennis')[0].art==='IMG'&&named('Apex Tennis')[0].loaded,JSON.stringify(named('Apex Tennis')));
  rec(vp.name+'-pool-release-untouched',live.release===1&&live.tennisRelease===0,`${live.release}/${live.tennisRelease}`);
  rec(vp.name+'-no-empty-or-overflow',live.empty===0&&live.scrollW===live.innerW,`${live.empty}; ${live.scrollW}/${live.innerW}`);
  rec(vp.name+'-zero-browser-network-errors',consoleErrors.length===0&&pageErrors.length===0&&bad.length===0,[...consoleErrors,...pageErrors,...bad].join(' | ')||'none');
  globalConsole.push(...consoleErrors.map(x=>vp.name+': '+x));globalPage.push(...pageErrors.map(x=>vp.name+': '+x));globalBad.push(...bad.map(x=>vp.name+': '+x));
  await page.screenshot({path:path.join(OUT,'homepage-'+vp.name+'.png'),fullPage:true});await context.close();
 }
 const themeContext=await browser.newContext({viewport:{width:1200,height:1000}}),themePage=await themeContext.newPage();await isolate(themePage);
 for(const theme of ['cream','pink','blue','light','dark']){await themePage.goto(BASE+'/',{waitUntil:'domcontentloaded'});await themePage.evaluate(t=>localStorage.setItem('mbm_reading_theme',t),theme);await themePage.reload({waitUntil:'domcontentloaded'});await themePage.waitForFunction(()=>document.documentElement.getAttribute('data-doors')==='14',{timeout:10000});const t=await themePage.evaluate(theme=>({theme,body:document.body.getAttribute('data-theme')||'cream',sports:document.querySelectorAll('#homeSports [data-sport-game]').length,release:document.querySelectorAll('#newrelease [data-release="Apex Pool"]').length,overflow:document.documentElement.scrollWidth===innerWidth}),theme);rec('theme-'+theme,t.body===theme&&t.sports===4&&t.release===1&&t.overflow,JSON.stringify(t))}await themeContext.close();
 const calm=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:'reduce'}),calmPage=await calm.newPage();await isolate(calmPage);await calmPage.goto(BASE+'/',{waitUntil:'domcontentloaded'});await calmPage.waitForFunction(()=>document.documentElement.getAttribute('data-doors')==='14',{timeout:10000});const reduced=await calmPage.evaluate(()=>({sports:document.querySelectorAll('#homeSports [data-sport-game]').length,transition:getComputedStyle(document.querySelector('[data-sport-game="Apex Tennis"]')).transitionDuration,overflow:document.documentElement.scrollWidth===innerWidth}));rec('reduced-motion',reduced.sports===4&&(reduced.transition==='0s'||parseFloat(reduced.transition)<.01)&&reduced.overflow,JSON.stringify(reduced));await calm.close();
 rec('aggregate-zero-errors',globalConsole.length===0&&globalPage.length===0&&globalBad.length===0,[...globalConsole,...globalPage,...globalBad].join(' | ')||'none');
 }catch(e){fail++;console.error(e.stack||e)}finally{if(browser)await browser.close()}
 fs.writeFileSync(path.join(OUT,'browser-report.json'),JSON.stringify({pass,fail,results},null,2));console.log('\n'+(fail?`${pass} passed, ${fail} FAILED`:`ALL ${pass} APEX TENNIS HOMEPAGE BROWSER GATES PASSED`));process.exit(fail?1:0);
})();
