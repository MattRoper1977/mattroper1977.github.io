#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const BASE=(process.env.ARCADE_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const MANIFEST=process.env.ARCADE_MANIFEST||path.join(__dirname,'..','artifacts','arcade-sports','games.json');
const OUT=process.env.ARCADE_ARTIFACT_DIR||path.join(__dirname,'..','artifacts','arcade-sports');fs.mkdirSync(OUT,{recursive:true});
const doc=JSON.parse(fs.readFileSync(MANIFEST,'utf8')),games=doc.games||[];
/* AGX-1 A-6: every expected count is DERIVED from the manifest under test.
   No literal totals — a hardcoded count plus a pinned manifest is how a gate
   goes green against a stale world. */
const N=games.length;
let pass=0,fail=0;const results=[];function ok(n,c,d=''){results.push({name:n,ok:c,detail:d});console.log((c?'  PASS  ':'  FAIL  ')+n+(d?'   '+d:''));c?pass++:fail++;}
(async()=>{let browser;try{browser=await chromium.launch({headless:true});
 const sportsManifest=games.filter(g=>g.collection==='Sports').map(g=>g.title);
 const sportsHrefs=games.filter(g=>g.collection==='Sports').map(g=>g.href);
 ok('manifest-count-derived',Number.isInteger(N)&&N>0,String(N)+' entries (derived, not asserted against a literal)');
 ok('manifest-art-complete',games.filter(g=>g.art&&String(g.art).trim()).length===N,games.filter(g=>g.art&&String(g.art).trim()).length+'/'+N);
 ok('manifest-no-duplicate-hrefs',new Set(games.map(g=>g.href)).size===N,String(N-new Set(games.map(g=>g.href)).size)+' duplicates');
 /* DERIVED: the rail's roster is whatever the manifest says it is. This used
    to compare against a four-name literal and went stale the moment Apex Rally
    joined - the exact failure this file's own header warns about. What is
    actually invariant is that the collection is non-empty and internally
    consistent; manifest-vs-rendered is asserted per viewport below. */
 ok('manifest-sports-membership-derived',sportsManifest.length>=2&&new Set(sportsManifest).size===sportsManifest.length,
    sportsManifest.length+' member(s), all distinct: '+JSON.stringify(sportsManifest));
 for(const vp of [{name:'phone',width:390,height:844},{name:'desktop',width:1280,height:900}]){
  const ctx=await browser.newContext({viewport:{width:vp.width,height:vp.height},reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[],bad=[];
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});page.on('pageerror',e=>errors.push('page: '+e.message));
  page.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url())});
  await page.route('**/Games/games.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(doc)}));
  const response=await page.goto(BASE+'/games/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(([sn,n])=>document.querySelectorAll('#sportsRail .gcard').length===sn&&document.querySelectorAll('#allGrid .gcard').length===n,[sportsManifest.length,N],{timeout:10000});
  await page.waitForFunction(()=>[...document.querySelectorAll('#sportsRail img')].some(x=>new URL(x.src).pathname==='/assets/cards/apex-tennis.svg'&&x.complete&&x.naturalWidth>0),{timeout:10000});
  const s=await page.evaluate(()=>{const title=a=>a.querySelector('h3,h4 span')?.textContent.trim()||'';const cards=q=>[...document.querySelectorAll(q)].map(a=>({title:title(a),href:new URL(a.getAttribute('href'),location.href).pathname}));return{sports:cards('#sportsRail .gcard'),top:cards('#topRail .pick'),shelf:cards('#allGrid .gcard'),chips:[...document.querySelectorAll('#chips .chip')].map(x=>x.textContent.trim()),count:document.getElementById('countline').textContent.trim(),copy:document.querySelector('#sports .sub').textContent.trim(),art:[...document.querySelectorAll('#sportsRail img')].map(x=>({src:new URL(x.src).pathname,complete:x.complete,w:x.naturalWidth})),scrollW:document.documentElement.scrollWidth,innerW:innerWidth,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};});
  const n=(arr,t)=>arr.filter(x=>x.title===t).length;
  ok(vp.name+'-page-200',response&&response.status()===200,response?String(response.status()):'none');
  ok(vp.name+'-sports-rail-matches-manifest',JSON.stringify(s.sports.map(x=>x.title))===JSON.stringify(sportsManifest),JSON.stringify(s.sports.map(x=>x.title))+' vs manifest '+JSON.stringify(sportsManifest));
  ok(vp.name+'-sports-links-match-manifest',JSON.stringify(s.sports.map(x=>x.href))===JSON.stringify(sportsHrefs),
     JSON.stringify(s.sports.map(x=>x.href))+' vs manifest '+JSON.stringify(sportsHrefs));
  ok(vp.name+'-apex-kick-remains-top',n(s.top,'Apex Kick')===1,s.top.map(x=>x.title).join(' | '));
  ok(vp.name+'-whole-shelf-complete',s.shelf.length===N&&sportsManifest.every(t=>n(s.shelf,t)===1),s.shelf.length+'/'+N);
  ok(vp.name+'-surface-counts-derived',sportsManifest.every(t=>n(s.sports,t)===1&&n(s.shelf,t)===1),
     sportsManifest.map(t=>t+':rail'+n(s.sports,t)+'/shelf'+n(s.shelf,t)).join(' '));
  ok(vp.name+'-rail-art-all-loaded',s.art.length===sportsManifest.length&&s.art.every(x=>x.complete&&x.w>0),
     s.art.filter(x=>x.complete&&x.w>0).length+'/'+sportsManifest.length+' rail images decoded');
  {const WORDS=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
    const want=WORDS[sportsManifest.length]||String(sportsManifest.length);
    ok(vp.name+'-copy-names-every-member',s.copy.includes(want+' Apex games')&&sportsManifest.every(t=>s.copy.includes(t)),
       'expected "'+want+' Apex games" + all '+sportsManifest.length+' names :: '+s.copy.slice(0,90));}
  ok(vp.name+'-tag-vocabulary',!s.chips.includes('SPORT')&&s.chips.includes('PHYSICS'),s.chips.join(' | '));
  {const m=/(\d+) top picks of (\d+) games/.exec(s.count);
   ok(vp.name+'-derived-total',!!m&&Number(m[2])===N,s.count+'  (manifest N='+N+')');}
  ok(vp.name+'-reduced-no-overflow',s.reduced&&s.scrollW===s.innerW,`${s.scrollW}/${s.innerW}`);
  ok(vp.name+'-zero-errors',errors.length===0&&bad.length===0,[...errors,...bad].join(' | ')||'none');
  await page.screenshot({path:path.join(OUT,vp.name+'-catalogue.png'),fullPage:true});await ctx.close();
 }
 }catch(e){fail++;console.error(e.stack||e)}finally{if(browser)await browser.close()}
 fs.writeFileSync(path.join(OUT,'browser-report.json'),JSON.stringify({pass,fail,results},null,2));console.log('\n'+(fail?`${pass} passed, ${fail} FAILED`:`ALL ${pass} ARCADE SPORTS BROWSER CHECKS PASSED`));process.exit(fail?1:0);
})();
