#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const BASE=(process.env.ARCADE_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const MANIFEST=process.env.ARCADE_MANIFEST||path.join(__dirname,'..','artifacts','arcade-sports','games.json');
const OUT=process.env.ARCADE_ARTIFACT_DIR||path.join(__dirname,'..','artifacts','arcade-sports');fs.mkdirSync(OUT,{recursive:true});
const doc=JSON.parse(fs.readFileSync(MANIFEST,'utf8')),games=doc.games||[];
let pass=0,fail=0;const results=[];function ok(n,c,d=''){results.push({name:n,ok:c,detail:d});console.log((c?'  PASS  ':'  FAIL  ')+n+(d?'   '+d:''));c?pass++:fail++;}
(async()=>{let browser;try{browser=await chromium.launch({headless:true});
 const sportsManifest=games.filter(g=>g.collection==='Sports').map(g=>g.title);
 ok('manifest-count-34',games.length===34,String(games.length));
 ok('manifest-sports-membership',JSON.stringify(sportsManifest)===JSON.stringify(['Apex Kick','Apex Pool','Apex Golf','Apex Tennis']),JSON.stringify(sportsManifest));
 for(const vp of [{name:'phone',width:390,height:844},{name:'desktop',width:1280,height:900}]){
  const ctx=await browser.newContext({viewport:{width:vp.width,height:vp.height},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],bad=[];
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});page.on('pageerror',e=>errors.push('page: '+e.message));
  page.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url())});
  await page.route('**/Games/games.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(doc)}));
  const response=await page.goto(BASE+'/games/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#sportsRail .gcard').length===4&&document.querySelectorAll('#allGrid .gcard').length===34,{timeout:10000});
  await page.waitForFunction(()=>[...document.querySelectorAll('#sportsRail img')].some(x=>new URL(x.src).pathname==='/assets/cards/apex-tennis.svg'&&x.complete&&x.naturalWidth>0),{timeout:10000});
  const s=await page.evaluate(()=>{const title=a=>a.querySelector('h3,h4 span')?.textContent.trim()||'';const cards=q=>[...document.querySelectorAll(q)].map(a=>({title:title(a),href:new URL(a.getAttribute('href'),location.href).pathname}));return{sports:cards('#sportsRail .gcard'),top:cards('#topRail .pick'),shelf:cards('#allGrid .gcard'),chips:[...document.querySelectorAll('#chips .chip')].map(x=>x.textContent.trim()),count:document.getElementById('countline').textContent.trim(),copy:document.querySelector('#sports .sub').textContent.trim(),art:[...document.querySelectorAll('#sportsRail img')].map(x=>({src:new URL(x.src).pathname,complete:x.complete,w:x.naturalWidth})),scrollW:document.documentElement.scrollWidth,innerW:innerWidth,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};});
  const n=(arr,t)=>arr.filter(x=>x.title===t).length;
  ok(vp.name+'-page-200',response&&response.status()===200,response?String(response.status()):'none');
  ok(vp.name+'-sports-four-adjacent',JSON.stringify(s.sports.map(x=>x.title))===JSON.stringify(['Apex Kick','Apex Pool','Apex Golf','Apex Tennis']),JSON.stringify(s.sports));
  ok(vp.name+'-sports-links',JSON.stringify(s.sports.map(x=>x.href))===JSON.stringify(['/apexkick/','/apexpool/','/apexgolf/','/apextennis/']));
  ok(vp.name+'-apex-kick-remains-top',n(s.top,'Apex Kick')===1,s.top.map(x=>x.title).join(' | '));
  ok(vp.name+'-whole-shelf-complete',s.shelf.length===34&&['Apex Kick','Apex Pool','Apex Golf','Apex Tennis'].every(t=>n(s.shelf,t)===1),String(s.shelf.length));
  ok(vp.name+'-surface-counts',n(s.top,'Apex Kick')===1&&n(s.sports,'Apex Kick')===1&&n(s.shelf,'Apex Kick')===1&&n(s.sports,'Apex Pool')===1&&n(s.shelf,'Apex Pool')===1&&n(s.sports,'Apex Golf')===1&&n(s.shelf,'Apex Golf')===1&&n(s.sports,'Apex Tennis')===1&&n(s.shelf,'Apex Tennis')===1);
  ok(vp.name+'-tennis-art-loaded',s.art.some(x=>x.src==='/assets/cards/apex-tennis.svg'&&x.complete&&x.w>0),JSON.stringify(s.art));
  ok(vp.name+'-copy-names-four',s.copy.includes('Four Apex games')&&s.copy.includes('Apex Tennis'),s.copy);
  ok(vp.name+'-tag-vocabulary',!s.chips.includes('SPORT')&&s.chips.includes('PHYSICS'),s.chips.join(' | '));
  ok(vp.name+'-derived-total',/13 curated favourites of 34 games/.test(s.count),s.count);
  ok(vp.name+'-reduced-no-overflow',s.reduced&&s.scrollW===s.innerW,`${s.scrollW}/${s.innerW}`);
  ok(vp.name+'-zero-errors',errors.length===0&&bad.length===0,[...errors,...bad].join(' | ')||'none');
  await page.screenshot({path:path.join(OUT,vp.name+'-catalogue.png'),fullPage:true});await ctx.close();
 }
 }catch(e){fail++;console.error(e.stack||e)}finally{if(browser)await browser.close()}
 fs.writeFileSync(path.join(OUT,'browser-report.json'),JSON.stringify({pass,fail,results},null,2));console.log('\n'+(fail?`${pass} passed, ${fail} FAILED`:`ALL ${pass} ARCADE SPORTS BROWSER CHECKS PASSED`));process.exit(fail?1:0);
})();
