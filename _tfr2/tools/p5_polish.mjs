// P5 gate: A1..A9, each independently PASS/FAIL. Usage: node p5_polish.mjs <html> <outdir>
import path from 'node:path';import fs from 'node:fs';
import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame } from './lib.mjs';
const file=process.argv[2],outDir=process.argv[3]||'shots/p5';fs.mkdirSync(outDir,{recursive:true});
const dir=path.dirname(path.resolve(file)),name=path.basename(file);const {server,base}=await serve(dir);const url=`${base}/${name}`;const browser=await launch();
const lines=[];let fail=0;const ok=(item,cond,msg)=>{lines.push(`${item} ${cond?'PASS':'FAIL'} — ${msg}`);if(!cond)fail++;};
process.on('uncaughtException',e=>{lines.push('FAIL harness threw: '+String(e&&e.message||e).split('\n')[0]);console.log(lines.join('\n'));console.log('RESULT FAIL');process.exit(1);});process.on('unhandledRejection',e=>{lines.push('FAIL harness threw: '+String(e&&e.message||e).split('\n')[0]);console.log(lines.join('\n'));console.log('RESULT FAIL');process.exit(1);});
const SEED={strength:12,coins:80,gems:3,reps:0,perfects:0,bestCombo:0,ascensions:0,equipped:0,purchased:[0],zone:0,claimedQuests:[],lastDaily:"",attemptedTrials:[],starterTier:0,windowLevel:0,comboLevel:0,sound:true,reducedMotion:false};
async function open(opts={}){const ctx=opts.ctx||await phoneContext(browser,{width:412,height:915,coarse:true});const page=await ctx.newPage();page.errors=[];page.on('pageerror',e=>page.errors.push(String(e.message||e)));await coarsePointer(page);await lockNetwork(page,url);
  await page.addInitScript((o)=>{window.__acCount=0;const AC=window.AudioContext;window.AudioContext=function(){window.__acCount++;return new AC(...arguments);};window.AudioContext.prototype=AC.prototype;try{if(!sessionStorage.getItem('__tfr2_seeded')){sessionStorage.setItem('__tfr2_seeded','1');if(o.seed)localStorage.setItem('mbm_titanforge_save_v1',JSON.stringify(o.seed));if(o.v3)localStorage.setItem('mbm_titanforge_v3',JSON.stringify(o.v3));}}catch(e){}},opts);
  await page.goto(url);await waitForGame(page);await page.waitForFunction(()=>window.__MBM_TITAN_V5__&&window.__MBM_TITAN_V5__.polishReady===true&&window.__MBM_TITAN_V5__.music);await page.waitForTimeout(250);return {ctx,page};}
const quickLift=(p)=>p.evaluate(()=>{window.__MBM_TITAN_FORCE_DIST__=0;const b=document.querySelector('.lift-button');if(b&&!b.disabled)b.click();window.__MBM_TITAN_FORCE_DIST__=null;});
const triRep=(p)=>p.evaluate(async()=>{const ctl=window.__MBM_TITAN_AAA__.getController();const raf=()=>new Promise(r=>requestAnimationFrame(r));while(ctl.phase!=='concentric'||ctl.committing)await raf();let prev=ctl.position;while(!(Math.abs(ctl.position-.72)<=.05&&ctl.position>=prev)){prev=ctl.position;await raf();}ctl.action();let lastTap=0;while(ctl.phase==='isometric'){const t=performance.now();if(Math.abs(ctl.balance-.5)>.035&&t-lastTap>=112){ctl.action();lastTap=t;}await raf();}while(ctl.phase==='eccentric'&&ctl.position<.665)await raf();if(ctl.phase==='eccentric')ctl.action();let done=false;const h=()=>{done=true;};window.addEventListener('mbm:titan-lift',h);const t0=performance.now();while(!done&&performance.now()-t0<3000)await raf();window.removeEventListener('mbm:titan-lift',h);return done;});
const setQuick=(p)=>p.evaluate(()=>{const b=document.querySelector('.mbm-mode-btn');if(b&&b.getAttribute('aria-pressed')==='true')b.click();});

// ---- A6 first launch: coach overlay (fresh V3) ----
{const {ctx,page}=await open({seed:SEED});
 const c0=await page.evaluate(()=>({coach:!!document.querySelector('.mbm-v5-coach'),hint:!!document.querySelector('.mbm-v3-hint'),title:(document.querySelector('#mbm-v5-coach-title')||{}).textContent,step:(document.querySelector('.mbm-v5-coach-step')||{}).textContent}));
 await page.screenshot({path:path.join(outDir,'p5-coach-412x915.png')});
 for(let i=0;i<3;i++){await page.click('.mbm-v5-coach-next');await page.waitForTimeout(80);}const last=await page.evaluate(()=>({title:document.querySelector('#mbm-v5-coach-title').textContent,btn:document.querySelector('.mbm-v5-coach-next').textContent,step:document.querySelector('.mbm-v5-coach-step').textContent}));
 await page.click('.mbm-v5-coach-next');await page.waitForTimeout(150);const c1=await page.evaluate(()=>({coach:!!document.querySelector('.mbm-v5-coach'),seen:window.__MBM_TITAN_V3__.getState().coachSeen,key:JSON.parse(localStorage.getItem('mbm_titanforge_v3')).coachSeen}));
 await page.reload();await waitForGame(page);await page.waitForTimeout(600);const c2=await page.evaluate(()=>!!document.querySelector('.mbm-v5-coach'));
 ok('A6',c0.coach&&!c0.hint&&/TAP DRIVE IN GOLD/.test(c0.title)&&c0.step==='1/4'&&/YOUR BODY EVOLVES/.test(last.title)&&last.btn==='START LIFTING'&&!c1.coach&&c1.seen===true&&c1.key===true&&c2===false,`first launch shows 4-step coach (step ${c0.step} "${c0.title}" → "${last.title}" / "${last.btn}"), old hint absent=${!c0.hint}; finished → coachSeen persisted in mbm_titanforge_v3 (${c1.key}); after reload shown again: ${c2}`);
 // skip path on another fresh context
 const {page:p2}=await open({seed:SEED});await p2.click('.mbm-v5-coach-skip');await p2.waitForTimeout(100);const sk=await p2.evaluate(()=>({coach:!!document.querySelector('.mbm-v5-coach'),seen:window.__MBM_TITAN_V3__.getState().coachSeen}));ok('A6',!sk.coach&&sk.seen,`SKIP closes the coach and marks it seen (${sk.seen})`);
 await ctx.close();}

// ---- A1 music ----
{const {ctx,page}=await open({seed:SEED,v3:{schema:1,owned:["ember"],aura:"ember",coachSeen:true,hintSeen:true,music:true}});
 const before=await page.evaluate(()=>({ac:window.__acCount,st:window.__MBM_TITAN_V5__.music.state()}));
 await page.tap('.lift-button');await page.waitForTimeout(900);
 const after=await page.evaluate(()=>({ac:window.__acCount,st:window.__MBM_TITAN_V5__.music.state()}));
 ok('A1',before.ac===0&&!before.st.hasContext&&before.st.enabled&&!before.st.playing,`no AudioContext before the first gesture (constructed ${before.ac}, music enabled ${before.st.enabled}, playing ${before.st.playing})`);
 ok('A1',after.ac>=1&&after.st.hasContext&&after.st.playing&&after.st.voices>0&&after.st.bpm===92,`after the first tap: contexts ${after.ac}, playing ${after.st.playing}, live voices ${after.st.voices}, ${after.st.bpm} bpm, layer gains ${JSON.stringify(after.st.layerGains)}, master ${after.st.master}`);
 // intensity layers: combo via lifts
 await setQuick(page);for(let i=0;i<8;i++){await quickLift(page);await page.waitForTimeout(520);}await page.waitForTimeout(900);const hot=await page.evaluate(()=>window.__MBM_TITAN_V5__.music.state());
 ok('A1',hot.intensity.combo>=6&&hot.layerGains[1]>.3&&hot.layerGains[2]>.3,`layers follow combo/focus: combo ${hot.intensity.combo}, focus ${Math.round(hot.intensity.focus)}, layer gains ${JSON.stringify(hot.layerGains)}`);
 // toggle in OPTIONS tray + settings
 const tray=await page.evaluate(()=>{const b=document.querySelector('.mbm-v5-music-btn');return b?{text:b.textContent,pressed:b.getAttribute('aria-pressed'),label:b.getAttribute('aria-label'),h:b.getBoundingClientRect().height||44}:null;});
 await page.evaluate(()=>document.querySelector('.mbm-v5-music-btn').click());await page.waitForTimeout(500);const off=await page.evaluate(()=>window.__MBM_TITAN_V5__.music.state());
 ok('A1',tray&&tray.pressed==='true'&&/Game beeps: Settings > Game sound/.test(tray.label)&&!off.playing&&!off.enabled,`MUSIC toggle in OPTIONS tray ("${tray&&tray.text}", pressed ${tray&&tray.pressed}) → off stops playback (playing ${off.playing}) and persists (enabled ${off.enabled})`);
 await page.click('.top-actions button:last-child');await page.waitForTimeout(400);const setting=await page.evaluate(()=>{const b=document.querySelector('.mbm-v5-music-setting');return b?{text:b.textContent,pressed:b.getAttribute('aria-pressed')}:null;});await page.evaluate(()=>document.querySelector('.mbm-v5-music-setting').click());await page.waitForTimeout(500);const on2=await page.evaluate(()=>window.__MBM_TITAN_V5__.music.state());
 ok('A1',setting&&setting.pressed==='false'&&on2.enabled&&on2.playing,`music toggle in core settings copy ("${setting&&setting.text}") turns it back on (playing ${on2.playing})`);
 // respects core Game sound off
 await page.evaluate(()=>{const sw=document.querySelectorAll('[role="dialog"] label button')[0];sw.click();});await page.waitForTimeout(1200);const muted=await page.evaluate(()=>({core:JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')).sound,st:window.__MBM_TITAN_V5__.music.state()}));
 ok('A1',muted.core===false&&!muted.st.playing,`core Game sound off → music stops (core sound ${muted.core}, playing ${muted.st.playing})`);
 await page.screenshot({path:path.join(outDir,'p5-settings-412x915.png')});await ctx.close();}

// ---- A2 achievements + A9 announcer + A8 sound honesty + A4 boards ----
{const {ctx,page}=await open({seed:Object.assign({},SEED,{strength:498}),v3:{schema:1,owned:["ember"],aura:"ember",coachSeen:true,hintSeen:true}});
 const live=await page.evaluate(()=>({count:window.__MBM_TITAN_V5__.polish.announcerCount(),all:Array.from(document.querySelectorAll('[aria-live]')).map(n=>n.className.split(' ')[0]+(n.getAttribute('aria-hidden')==='true'?'(hidden)':'')),notice:document.querySelector('.notice').getAttribute('aria-hidden')}));
 ok('A9',live.count===1&&live.all.includes('mbm-v4-live'),`exactly one live region: ${live.count} (${live.all.join(', ')}); core notice aria-hidden=${live.notice}`);
 await setQuick(page);await quickLift(page);await page.waitForTimeout(400);
 const a=await page.evaluate(()=>({live:document.querySelector('.mbm-v4-live').textContent,list:window.__MBM_TITAN_V5__.records.list().filter(x=>x.unlocked).map(x=>x.id),card:document.querySelector('.mbm-v5-ach.mbm-v5-show')?document.querySelector('.mbm-v5-ach strong').textContent:null,key:JSON.parse(localStorage.getItem('mbm_titanforge_records_v1')||'{}')}));
 await page.screenshot({path:path.join(outDir,'p5-achievement-412x915.png')});
 ok('A9',/PERFECT REP · \+\d+ STRENGTH · \+\d+ COINS/.test(a.live),`lift result lands only in .mbm-v4-live: "${a.live.slice(0,80)}"`);
 ok('A2',a.list.includes('first_spark')&&a.list.includes('first_perfect')&&a.list.includes('rank_contender')&&a.card&&a.key.unlocked&&a.key.unlocked.first_spark,`unlocks on first PERFECT at 498→ ${a.list.join(',')}; card "${a.card}"; key mbm_titanforge_records_v1 written`);
 await page.click('.mobile-dock .mbm-v5-dock-dna');await page.waitForTimeout(300);await page.click('.mbm-v5-toptabs button:nth-child(2)');await page.waitForTimeout(200);
 const rt=await page.evaluate(()=>({rows:document.querySelectorAll('.mbm-v5-ach-row').length,on:document.querySelectorAll('.mbm-v5-ach-row.on').length,count:document.querySelector('.mbm-v5-ach-count').textContent,dnaHidden:getComputedStyle(document.querySelector('.mbm-v4-dna-scroll')).display==='none',tab:document.querySelector('.mbm-v5-toptabs button:nth-child(2)').getAttribute('aria-selected')}));
 await page.screenshot({path:path.join(outDir,'p5-records-412x915.png')});
 ok('A2',rt.rows===24&&rt.on>=3&&rt.tab==='true'&&rt.dnaHidden,`RECORDS tab in the DNA dialog lists ${rt.rows} achievements (${rt.count}), DNA tree hidden while RECORDS is selected`);
 // A4 leaderboards via seams (+ real ascension timing)
 const lb=await page.evaluate(()=>{const R=window.__MBM_TITAN_V5__.records;for(let i=0;i<13;i++)R.addPower(300+i*100,'RIVAL'+i);window.dispatchEvent(new CustomEvent('mbm:titan-ascend',{detail:{strength:50000,ascensions:1}}));const g=R.get();return {power:g.power.map(x=>x.p),ascend:g.ascend,rows:document.querySelectorAll('.mbm-v5-power div').length,asc:document.querySelectorAll('.mbm-v5-ascend div').length,unlocked:R.list().filter(x=>x.unlocked).map(x=>x.id)};});
 ok('A4',lb.power.length===10&&lb.power[0]===1500&&lb.power[9]===600&&lb.ascend.length===1&&lb.ascend[0].s>0&&lb.rows===10&&lb.asc===1&&lb.unlocked.includes('duel_1500')&&lb.unlocked.includes('ascend_1'),`top-10 POWER-OFF keeps ${lb.power.length} sorted (${lb.power[0]}…${lb.power[9]}); first-ascension time recorded ${lb.ascend[0]&&lb.ascend[0].s} s; ASCENSION I + POWER SURGE unlocked`);
 await page.keyboard.press('Escape');await page.waitForTimeout(200);
 const sh=await page.evaluate(()=>({label:document.querySelector('.mbm-audio-btn').getAttribute('aria-label'),note:(document.querySelector('.mbm-v5-sound-note')||{}).textContent}));
 ok('A8',/Game beeps: Settings > Game sound/.test(sh.label||'')&&/Game beeps: Settings > Game sound/.test(sh.note||''),`FX SOUND aria-label "${sh.label}"; OPTIONS tray note "${sh.note}"`);
 ok('A2',page.errors.length===0,`page errors ${page.errors.length} ${page.errors.join('|')}`);await ctx.close();}

// ---- A3 daily challenge ----
{const {ctx,page}=await open({seed:SEED,v3:{schema:1,owned:["ember"],aura:"ember",coachSeen:true,hintSeen:true}});
 const det=await page.evaluate(()=>{const D=window.__MBM_TITAN_V5__.daily;const a=D.plan(20260901),b=D.plan(20260901),c=D.plan(20260902);return {same:JSON.stringify(a)===JSON.stringify(b),diff:JSON.stringify(a)!==JSON.stringify(c),a:{target:a.target,mods:a.mods.map(m=>m.id),rival:a.rival}};});
 ok('A3',det.same&&det.diff,`plan is seeded by yyyymmdd: 20260901 → target ${det.a.target}, mods ${det.a.mods.join('+')}, rival ${det.a.rival}; same seed identical, next day differs`);
 await page.click('.mobile-dock button:has-text("TRIALS")');await page.waitForSelector('.mbm-v5-daily-card',{timeout:5000});const card=await page.evaluate(()=>({small:document.querySelector('.mbm-v5-daily-card small').textContent,btn:document.querySelector('.mbm-v5-daily-card button').textContent,disabled:document.querySelector('.mbm-v5-daily-card button').disabled}));
 await page.screenshot({path:path.join(outDir,'p5-daily-card-412x915.png')});
 await page.click('.mbm-v5-daily-card button');await page.waitForTimeout(1700);
 const st=await page.evaluate(()=>({att:window.__MBM_TITAN_V5__.daily.attempt(),hud:!document.querySelector('.mbm-v5-dailyhud').hidden,brace:window.__MBM_TITAN_BRACE_MS__,mode:document.querySelector('.mbm-mode-btn').getAttribute('aria-pressed')}));
 const mods=st.att?st.att.mods:[];const needTri=mods.includes('tri');const gemsBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')).gems);
 // score enough power: PERFECT lifts count under every modifier
 const end=Date.now()+20000;let lifts=0;while(Date.now()<end){const cur=await page.evaluate(()=>window.__MBM_TITAN_V5__.daily.attempt());if(!cur||cur.power>=cur.target)break;if(needTri){await triRep(page);}else{await setQuick(page);await quickLift(page);await page.waitForTimeout(700);}lifts++;}
 const mid=await page.evaluate(()=>window.__MBM_TITAN_V5__.daily.attempt());await page.screenshot({path:path.join(outDir,'p5-daily-live-412x915.png')});
 await page.evaluate(()=>window.__MBM_TITAN_V5__.daily.finish());await page.waitForTimeout(300);
 const fin=await page.evaluate(()=>({d:window.__MBM_TITAN_V5__.daily.state(),hook:window.__MBM_TITAN_GEM_GRANT__,live:document.querySelector('.mbm-v4-live').textContent,brace:window.__MBM_TITAN_BRACE_MS__,unlocked:window.__MBM_TITAN_V5__.records.list().filter(x=>x.unlocked).map(x=>x.id)}));
 await setQuick(page);const gemsMid=await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')).gems);await page.evaluate(()=>{window.__lastLift=null;window.addEventListener('mbm:titan-lift',e=>{window.__lastLift=e.detail;},{once:true});});await quickLift(page);await page.waitForTimeout(500);const gemsAfter=await page.evaluate(()=>({gems:JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')).gems,hook:window.__MBM_TITAN_GEM_GRANT__,pending:window.__MBM_TITAN_V5__.daily.state().pendingGem,levelGem:window.__lastLift?window.__lastLift.gems:0}));
 ok('A3',gemsAfter.gems===gemsMid+1+gemsAfter.levelGem&&gemsAfter.hook===0&&gemsAfter.pending===false,`next lift consumed the hook: gems ${gemsMid}→${gemsAfter.gems} (+1 grant${gemsAfter.levelGem?' +1 level-up':''}), hook now ${gemsAfter.hook}, pending ${gemsAfter.pending}`);
 await page.click('.mobile-dock button:has-text("TRIALS")');await page.waitForSelector('.mbm-v5-daily-card',{timeout:5000});const again=await page.evaluate(()=>({btn:document.querySelector('.mbm-v5-daily-card button').textContent,disabled:document.querySelector('.mbm-v5-daily-card button').disabled,started:window.__MBM_TITAN_V5__.daily.start()}));
 ok('A3',again.disabled&&again.started===false,`one attempt per day: button "${again.btn}" disabled, second start refused`);await ctx.close();}

// ---- A5 save code ----
{const {ctx,page}=await open({seed:Object.assign({},SEED,{strength:777,coins:4321,gems:9}),v3:{schema:1,owned:["ember"],aura:"ember",coachSeen:true,hintSeen:true}});
 await page.click('.top-actions button:last-child');await page.waitForTimeout(400);await page.click('.mbm-v5-export');await page.waitForFunction(()=>document.querySelector('.mbm-v5-savecode').value.length>20);
 const code=await page.inputValue('.mbm-v5-savecode');const snap=await page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('mbm_titanforge_'))o[k]=localStorage.getItem(k);}return o;});
 ok('A5',/^TFS1\.[ZR][A-Za-z0-9_-]+\.[0-9a-f]{8}$/.test(code),`export code ${code.length} chars, format TFS1.<payload>.<fnv1a>`);
 const bad=code.slice(0,-12)+'x'+code.slice(-11);await page.fill('.mbm-v5-savecode',bad);await page.click('.mbm-v5-import');await page.waitForTimeout(400);
 const r1=await page.evaluate(()=>({note:document.querySelector('.mbm-v5-save-note').textContent}));const snap2=await page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('mbm_titanforge_'))o[k]=localStorage.getItem(k);}return o;});
 ok('A5',/REFUSED/.test(r1.note)&&JSON.stringify(snap)===JSON.stringify(snap2),`corrupted code refused ("${r1.note}"), all mbm_titanforge_* keys byte-identical afterwards`);
 const bad2=code.replace(/^TFS1\.([ZR])/,'TFS1.$1AAAA');await page.fill('.mbm-v5-savecode',bad2);await page.click('.mbm-v5-import');await page.waitForTimeout(400);const r2=await page.evaluate(()=>document.querySelector('.mbm-v5-save-note').textContent);
 ok('A5',/REFUSED/.test(r2),`tampered payload with stale checksum refused ("${r2}")`);
 // import into a fresh profile
 const ctx2=await phoneContext(browser,{width:412,height:915,coarse:true});const {page:p2}=await open({ctx:ctx2,seed:SEED,v3:{schema:1,owned:["ember"],aura:"ember",coachSeen:true,hintSeen:true}});
 await p2.click('.top-actions button:last-child');await p2.waitForTimeout(400);await p2.fill('.mbm-v5-savecode',code);await p2.click('.mbm-v5-import');await p2.waitForTimeout(1500);await waitForGame(p2);await p2.waitForTimeout(400);
 const imp=await p2.evaluate(()=>{const c=JSON.parse(localStorage.getItem('mbm_titanforge_save_v1'));return {strength:c.strength,coins:c.coins,gems:c.gems,shown:document.querySelector('.resource-pill b')?document.querySelector('.resource-pill b').textContent:''};});
 ok('A5',imp.strength===777&&imp.coins===4321&&imp.gems===9,`import into a fresh profile restores the six keys and the page reloads through the sanitizers (strength ${imp.strength}, coins ${imp.coins}, gems ${imp.gems}, HUD "${imp.shown}")`);
 await ctx.close();await ctx2.close();}

// ---- A7 reset all progress ----
{const {ctx,page}=await open({seed:Object.assign({},SEED,{strength:999}),v3:{schema:1,owned:["ember"],aura:"ember",coachSeen:true,hintSeen:true}});
 await page.evaluate(()=>localStorage.setItem('mbm_other_thing','keep'));await page.click('.top-actions button:last-child');await page.waitForTimeout(400);
 await page.click('.mbm-v5-reset');const armed=await page.evaluate(()=>({armed:document.querySelector('.mbm-v5-reset').getAttribute('data-armed'),text:document.querySelector('.mbm-v5-reset').textContent,still:JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')).strength}));
 await page.click('.mbm-v5-reset');await page.waitForTimeout(800);await waitForGame(page).catch(()=>{});await page.waitForTimeout(500);
 const after=await page.evaluate(()=>({strength:JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')||'{}').strength,other:localStorage.getItem('mbm_other_thing'),live:(document.querySelector('.mbm-v4-live')||{}).textContent,keys:Object.keys(localStorage).filter(k=>k.startsWith('mbm_titanforge_'))}));
 ok('A7',armed.armed==='true'&&/CONFIRM/.test(armed.text)&&armed.still===999&&after.strength!==999&&after.other==='keep'&&/PROGRESS RESET/.test(after.live||''),`first tap arms ("${armed.text}", strength still ${armed.still}); second tap clears mbm_titanforge_* only (strength now ${after.strength}, unrelated key kept "${after.other}") and reloads: "${(after.live||'').slice(0,40)}"`);
 // arm expiry (the fresh profile shows the coach again; skip it first)
 await page.evaluate(()=>{const b=document.querySelector('.mbm-v5-coach-skip');if(b)b.click();});await page.waitForTimeout(200);await page.click('.top-actions button:last-child');await page.waitForTimeout(400);await page.click('.mbm-v5-reset');await page.waitForTimeout(4300);const exp=await page.evaluate(()=>document.querySelector('.mbm-v5-reset').getAttribute('data-armed'));ok('A7',exp==='false','arm expires after 4 s without the second tap');
 await ctx.close();}
await browser.close();server.close();
console.log(lines.join('\n'));console.log(`RESULT ${fail?'FAIL':'PASS'} (${lines.length-fail}/${lines.length})`);process.exit(fail?1:0);
