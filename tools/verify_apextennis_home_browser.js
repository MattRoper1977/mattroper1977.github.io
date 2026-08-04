#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const BASE=(process.env.APEXTENNIS_HOME_BASE_URL||'http://127.0.0.1:4173').replace(/\/$/,'');
const OUT=process.env.APEXTENNIS_HOME_ARTIFACT_DIR||path.join('artifacts','apextennis-home');
fs.mkdirSync(OUT,{recursive:true});
let pass=0,fail=0;const results=[];
function rec(name,ok,detail=''){results.push({name,ok,detail});console.log((ok?'  PASS  ':'  FAIL  ')+name+(detail?'   '+detail:''));ok?pass++:fail++;}

/* --------------------------------------------------------------------------
   EXPECTATIONS ARE DERIVED, NOT PINNED.

   This file used to hardcode "14 doors", "8 game-zone cards", "there is an
   Apex Golf door" and 'data-release="Apex Pool"'. Every one of those was a
   copy of a truth that lives somewhere else and can move without it — the
   estate's recurring defect shape. Two rulings moved underneath them:

     C1      Apex Golf takes NO site.json door (the homepage Sports block
             keeps Apex Golf; that is the ruled part and IS asserted below)
     Part C  the New Release box's occupant changes

   So the door census now comes from site.json and the New Release occupant
   from index.html, both read at run time. Whatever those files say, this
   harness asserts the rendered page agrees with them — which is the only
   thing a browser gate can honestly claim to check.
   -------------------------------------------------------------------------- */
const ROOT=path.join(__dirname,'..');
const SITE=JSON.parse(fs.readFileSync(path.join(ROOT,'site.json'),'utf8'));
const HOME=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

const EXPECT=(SITE.doors||[]).map(d=>({title:d.title,href:d.href,zone:d.zone}));
const EXPECT_DOORS=EXPECT.length;
const EXPECT_GAMES=EXPECT.filter(d=>d.zone==='games').length;

const relTags=HOME.match(/data-release="[^"]+"/g)||[];
const relStart=HOME.indexOf('data-release="');
const relEnd=relStart<0?-1:HOME.indexOf('</div></section>',relStart);
const RELEASE=relTags.length===1?/data-release="([^"]+)"/.exec(relTags[0])[1]:null;
const RELEASE_HREF=relEnd>relStart?(/class="dx-chip dx-main" href="([^"]+)"/.exec(HOME.slice(relStart,relEnd))||[])[1]:undefined;

// A derived expectation that came out empty would make every gate below
// vacuously true, so the derivation is checked before anything is rendered.
const derivationProblems=[];
if(!EXPECT_DOORS)derivationProblems.push('site.json has no doors[]');
if(!EXPECT_GAMES)derivationProblems.push('site.json has no doors in the games zone');
if(relTags.length!==1)derivationProblems.push(`expected exactly one [data-release] occupant in index.html, found ${relTags.length}`);
if(!RELEASE_HREF)derivationProblems.push('could not derive the New Release main-chip href from index.html');
if(new Set(EXPECT.map(d=>d.href)).size!==EXPECT_DOORS)derivationProblems.push('site.json doors[] contains duplicate hrefs');
if(derivationProblems.length){
  console.error('DERIVATION FAILED — the expectations this harness checks against could not be read:');
  for(const p of derivationProblems)console.error('  '+p);
  process.exit(1);
}
console.log(`derived from the repo: ${EXPECT_DOORS} doors (${EXPECT_GAMES} in the games zone) · New Release occupant "${RELEASE}" -> ${RELEASE_HREF}`);
console.log(`  Apex Golf site.json door: ${EXPECT.some(d=>d.title==='Apex Golf')?'PRESENT':'ABSENT (C1)'}`);

async function isolate(page){
  await page.route('https://api.counterapi.dev/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"value":0,"count":0}'}));
  await page.route('**/Lessons/resources.json',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.route('**/Games/games.json',r=>r.fulfill({status:200,contentType:'application/json',body:'{"games":[]}'}));
  await page.route('**/data/resources.json',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
async function waitForDoors(page){
  await page.waitForFunction(n=>document.documentElement.getAttribute('data-doors')===n&&document.documentElement.getAttribute('data-doors-art')===n,String(EXPECT_DOORS),{timeout:10000});
  await page.locator('[data-zone="games"]').scrollIntoViewIfNeeded();
  // wait on every game-zone door site.json actually declares, whichever they are
  await page.waitForFunction(titles=>titles.every(t=>{
    const a=[...document.querySelectorAll('[data-zone="games"]>a.dx-prod')].find(x=>x.querySelector('b')?.textContent.trim()===t);
    const art=a?.querySelector('img,svg');
    return !!art&&(art.tagName.toLowerCase()==='svg'||(art.complete&&art.naturalWidth>0));
  }),EXPECT.filter(d=>d.zone==='games').map(d=>d.title),{timeout:10000});
}
(async()=>{let browser;try{
  browser=await chromium.launch({headless:true});

  const nojs=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled:false,reducedMotion:'reduce'});
  const nojsPage=await nojs.newPage();await isolate(nojsPage);
  const nojsResponse=await nojsPage.goto(BASE+'/',{waitUntil:'domcontentloaded'});
  // Layout is measured below (scrollWidth). At domcontentloaded the webfonts
  // and card art have not settled, and this gate was observed to read 419/390
  // once in ~4 runs before stabilising at 390/390 — a flaky gate is not a
  // gate, so wait for load and for fonts before taking any measurement.
  await nojsPage.waitForLoadState('load').catch(()=>{});
  await nojsPage.evaluate(()=>document.fonts?document.fonts.ready:null).catch(()=>{});
  const off=await nojsPage.evaluate(name=>{const cards=[...document.querySelectorAll('#homeSports [data-sport-game]')],boxes=[...document.querySelectorAll('#newrelease [data-release]')],release=document.querySelector(`#newrelease [data-release="${name}"]`);return{cards:cards.map(a=>({title:a.dataset.sportGame,href:a.getAttribute('href'),tag:a.tagName})),releaseBoxes:boxes.length,release:!!release,releaseTitle:release?.querySelector('h3')?.textContent.trim()||'',releaseLinks:release?[...release.querySelectorAll('a')].map(a=>a.getAttribute('href')):[],scrollW:document.documentElement.scrollWidth,innerW:innerWidth};},RELEASE);
  rec('js-off-page-200',nojsResponse?.status()===200,String(nojsResponse?.status()||0));
  rec('js-off-four-hardcoded-sports',JSON.stringify(off.cards.map(x=>x.title))===JSON.stringify(['Apex Kick','Apex Pool','Apex Golf','Apex Tennis']),JSON.stringify(off.cards));
  rec('js-off-sports-links',JSON.stringify(off.cards.map(x=>x.href))===JSON.stringify(['/apexkick/','/apexpool/','/apexgolf/','/apextennis/']));
  rec('js-off-anchor-components',off.cards.every(x=>x.tag==='A'));
  rec('js-off-new-release-occupant-renders',off.releaseBoxes===1&&off.release&&off.releaseTitle.includes(RELEASE)&&off.releaseLinks.includes(RELEASE_HREF),`derived "${RELEASE}" -> ${RELEASE_HREF}; ${JSON.stringify(off)}`);
  rec('js-off-no-horizontal-overflow',off.scrollW===off.innerW,`${off.scrollW}/${off.innerW}`);
  await nojsPage.screenshot({path:path.join(OUT,'homepage-js-off-390.png'),fullPage:true});await nojs.close();

  const allErrors=[];
  for(const vp of [{name:'360',width:360,height:900,cols:2,rows:4},{name:'768',width:768,height:1000,cols:3,rows:3},{name:'1200',width:1200,height:1000,cols:3,rows:3}]){
    const context=await browser.newContext({viewport:{width:vp.width,height:vp.height}}),page=await context.newPage(),errors=[];
    page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
    page.on('pageerror',e=>errors.push('page: '+e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url())});
    await isolate(page);const response=await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});await waitForDoors(page);
    const live=await page.evaluate(name=>{const title=a=>a.querySelector('b')?.textContent.trim()||'';const sport=[...document.querySelectorAll('#homeSports [data-sport-game]')].map(a=>({title:a.dataset.sportGame,href:a.getAttribute('href')}));const doors=[...document.querySelectorAll('[data-zone] a.dx-prod')].map(a=>{const img=a.querySelector('img'),art=a.querySelector('img,svg');return{title:title(a),zone:a.parentElement?.dataset.zone,href:a.getAttribute('href'),art:art?.tagName||'',loaded:!!art&&(!img||(img.complete&&img.naturalWidth>0))};});const games=[...document.querySelectorAll('[data-zone="games"]>a.dx-prod')];const positions=games.map(a=>{const r=a.getBoundingClientRect();return{title:title(a),x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2)};});const boxes=[...document.querySelectorAll('#newrelease [data-release]')];return{sport,doors,positions,cols:new Set(positions.map(x=>x.x)).size,rows:new Set(positions.map(x=>x.y)).size,doorCount:document.documentElement.getAttribute('data-doors'),artCount:document.documentElement.getAttribute('data-doors-art'),releaseBoxes:boxes.length,releaseOccupants:boxes.map(b=>b.getAttribute('data-release')),release:document.querySelectorAll(`#newrelease [data-release="${name}"]`).length,empty:[...document.querySelector('[data-zone="games"]').children].filter(x=>!x.textContent.trim()).length,scrollW:document.documentElement.scrollWidth,innerW:innerWidth};},RELEASE);
    const named=t=>live.doors.filter(x=>x.title===t);
    rec(vp.name+'-page-200',response?.status()===200,String(response?.status()||0));
    rec(vp.name+'-four-hardcoded-sports',JSON.stringify(live.sport.map(x=>x.title))===JSON.stringify(['Apex Kick','Apex Pool','Apex Golf','Apex Tennis']),JSON.stringify(live.sport));
    rec(vp.name+'-sports-links',JSON.stringify(live.sport.map(x=>x.href))===JSON.stringify(['/apexkick/','/apexpool/','/apexgolf/','/apextennis/']));
    // "N cards, 0 bare" — the count is published next to its population, per
    // the house rule in assets/mbm-doors.js, and N is read from site.json.
    rec(vp.name+'-every-site-json-door-rendered-with-art',live.doorCount===String(EXPECT_DOORS)&&live.artCount===String(EXPECT_DOORS)&&live.doors.length===EXPECT_DOORS&&live.doors.every(x=>x.art),`${live.doorCount}/${live.artCount}; ${live.doors.length} rendered, expected ${EXPECT_DOORS}`);
    // every declared door present exactly once, at its declared href and zone
    const missing=EXPECT.filter(e=>{const m=named(e.title);return !(m.length===1&&m[0].href===e.href&&m[0].zone===e.zone&&m[0].art&&m[0].loaded);});
    rec(vp.name+'-each-declared-door-once-at-its-href',missing.length===0,missing.length?JSON.stringify(missing):`${EXPECT_DOORS}/${EXPECT_DOORS} matched title+href+zone+loaded art`);
    // and nothing rendered that site.json never declared
    const undeclared=live.doors.filter(d=>!EXPECT.some(e=>e.title===d.title));
    rec(vp.name+'-no-undeclared-door-rendered',undeclared.length===0,undeclared.length?JSON.stringify(undeclared.map(d=>d.title)):'none');
    // grid shape follows the derived population, not a frozen 8
    rec(vp.name+'-game-grid-shape',live.positions.length===EXPECT_GAMES&&live.cols===vp.cols&&live.rows===Math.ceil(EXPECT_GAMES/vp.cols),`${live.positions.length} cards, ${live.cols} cols x ${live.rows} rows (expected ${EXPECT_GAMES}, ${vp.cols}, ${Math.ceil(EXPECT_GAMES/vp.cols)})`);
    // C1 is the ruled part and stays pinned where it is a ruling: whatever
    // happens to Golf's site.json door, the homepage Sports block keeps all
    // four games (asserted by -four-hardcoded-sports above). The door side is
    // derived, so this limb is correct both before and after the removal.
    rec(vp.name+'-golf-door-follows-site-json',named('Apex Golf').length===(EXPECT.some(e=>e.title==='Apex Golf')?1:0),`site.json says ${EXPECT.some(e=>e.title==='Apex Golf')?'present':'absent'}, page rendered ${named('Apex Golf').length}`);
    rec(vp.name+'-one-new-release-occupant',live.releaseBoxes===1&&live.release===1,`${live.releaseBoxes} box(es): ${JSON.stringify(live.releaseOccupants)}; derived "${RELEASE}"`);
    rec(vp.name+'-no-empty-or-overflow',live.empty===0&&live.scrollW===live.innerW,`${live.empty}; ${live.scrollW}/${live.innerW}`);
    rec(vp.name+'-zero-browser-network-errors',errors.length===0,errors.join(' | ')||'none');allErrors.push(...errors.map(x=>vp.name+': '+x));
    await page.screenshot({path:path.join(OUT,'homepage-'+vp.name+'.png'),fullPage:true});await context.close();
  }

  const themeContext=await browser.newContext({viewport:{width:1200,height:1000}}),themePage=await themeContext.newPage();await isolate(themePage);
  for(const theme of ['cream','pink','blue','light','dark']){await themePage.goto(BASE+'/',{waitUntil:'domcontentloaded'});await themePage.evaluate(t=>localStorage.setItem('mbm_reading_theme',t),theme);await themePage.reload({waitUntil:'domcontentloaded'});await waitForDoors(themePage);const t=await themePage.evaluate(([theme,name])=>({theme,body:document.body.getAttribute('data-theme')||'cream',sports:document.querySelectorAll('#homeSports [data-sport-game]').length,release:document.querySelectorAll(`#newrelease [data-release="${name}"]`).length,overflow:document.documentElement.scrollWidth===innerWidth}),[theme,RELEASE]);rec('theme-'+theme,t.body===theme&&t.sports===4&&t.release===1&&t.overflow,JSON.stringify(t));}
  await themeContext.close();

  /* KNOWN LIMIT, stated rather than papered over: the door DOM is GENERATED
     from site.json by assets/mbm-doors.js, so asserting the rendered title,
     href and zone match site.json is partly tautological — change an href in
     site.json and the card renders at the changed href, agreeing with itself.
     (Measured: mutating a door's href to a non-existent path left every
     agreement limb green.) What those limbs independently prove is placement
     count vs declared count, art presence and loading, zone containment, grid
     geometry, and that nothing undeclared rendered.

     The limb below is the non-circular one: a door's target must actually
     resolve. Only doors whose target exists in THIS repo can be checked in
     CI — the estate's cross-repo doors (Lessons/, and anything else served
     from a sibling repo) 404 here for legitimate reasons, so they are counted
     and NAMED rather than silently dropped. */
  const targetPath=h=>path.join(ROOT,decodeURIComponent(String(h).split(/[?#]/)[0]));
  const inRepo=EXPECT.filter(d=>fs.existsSync(targetPath(d.href)));
  const offRepo=EXPECT.filter(d=>!fs.existsSync(targetPath(d.href)));
  console.log(`  door targets: ${inRepo.length} in this repo (resolution asserted), ${offRepo.length} served from elsewhere (not assertable here): ${offRepo.map(d=>d.title+' -> '+d.href).join(', ')||'none'}`);
  rec('door-resolution-population-non-empty',inRepo.length>0,`${inRepo.length} in-repo door targets to check`);

  /* "Served from elsewhere" must not become a hiding place. A typo'd href is
     also absent from this repo, so absence alone cannot tell a sibling-repo
     door from a broken one — measured: pointing a door at a non-existent path
     simply moved it into the off-repo bucket and the run stayed green.
     The discriminator is the BASE BRANCH: a door that was already off-repo is
     a sibling-repo door; a door that BECOMES off-repo is a regression. */
  const BASE_SITE=process.env.APEXTENNIS_HOME_BASE_SITE||path.join(OUT,'site-before.json');
  if(fs.existsSync(BASE_SITE)){
    const baseDoors=(JSON.parse(fs.readFileSync(BASE_SITE,'utf8')).doors||[]);
    const baseOff=new Set(baseDoors.filter(d=>!fs.existsSync(targetPath(d.href))).map(d=>d.title));
    const newlyOff=offRepo.filter(d=>!baseOff.has(d.title));
    rec('no-door-newly-unresolvable-vs-base',newlyOff.length===0,newlyOff.length?JSON.stringify(newlyOff):`${offRepo.length} off-repo door(s), all of them already off-repo on the base branch`);
  }else{
    rec('no-door-newly-unresolvable-vs-base',false,`NOT RUN — no base site.json at ${BASE_SITE}; recorded as unverified, not as a pass`);
  }
  const unresolved=[];
  for(const d of inRepo){
    let status=0;
    try{const r=await fetch(BASE+'/'+d.href,{redirect:'follow'});status=r.status;}catch(e){status=-1;}
    if(status>=400||status<0)unresolved.push({title:d.title,href:d.href,status});
  }
  rec('every-in-repo-door-target-resolves',unresolved.length===0,unresolved.length?JSON.stringify(unresolved):`${inRepo.length}/${inRepo.length} resolved`);

  const calm=await browser.newContext({viewport:{width:1024,height:768},reducedMotion:'reduce'}),calmPage=await calm.newPage();await isolate(calmPage);await calmPage.goto(BASE+'/',{waitUntil:'domcontentloaded'});await waitForDoors(calmPage);const reduced=await calmPage.evaluate(()=>({sports:document.querySelectorAll('#homeSports [data-sport-game]').length,transition:getComputedStyle(document.querySelector('[data-sport-game="Apex Tennis"]')).transitionDuration,overflow:document.documentElement.scrollWidth===innerWidth}));rec('reduced-motion',reduced.sports===4&&(reduced.transition==='0s'||parseFloat(reduced.transition)<.01)&&reduced.overflow,JSON.stringify(reduced));await calm.close();
  rec('aggregate-zero-errors',allErrors.length===0,allErrors.join(' | ')||'none');
}catch(e){fail++;console.error(e.stack||e)}finally{if(browser)await browser.close();}
fs.writeFileSync(path.join(OUT,'browser-report.json'),JSON.stringify({pass,fail,results},null,2));console.log('\n'+(fail?`${pass} passed, ${fail} FAILED`:`ALL ${pass} APEX TENNIS HOMEPAGE BROWSER GATES PASSED`));process.exit(fail?1:0);
})();
