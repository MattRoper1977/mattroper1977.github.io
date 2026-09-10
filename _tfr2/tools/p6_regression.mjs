// P6 regression lines that no other suite covers: Rook trial win/loss, ascension shards + DNA hook,
// no-WebGL boot, network-locked full session. Prints PASS/FAIL per line.
import path from 'node:path';
import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame } from './lib.mjs';
const file=process.argv[2];const dir=path.dirname(path.resolve(file)),name=path.basename(file);const {server,base}=await serve(dir);const url=`${base}/${name}`;
const lines=[];let fail=0;const ok=(cond,msg)=>{lines.push((cond?'PASS ':'FAIL ')+msg);if(!cond)fail++;};
process.on('uncaughtException',e=>{lines.push('FAIL harness threw: '+String(e&&e.message||e).split('\n')[0]);console.log(lines.join('\n'));console.log('RESULT FAIL');process.exit(1);});process.on('unhandledRejection',e=>{lines.push('FAIL harness threw: '+String(e&&e.message||e).split('\n')[0]);console.log(lines.join('\n'));console.log('RESULT FAIL');process.exit(1);});
const V3={schema:1,owned:["ember"],aura:"ember",coachSeen:true,hintSeen:true};
async function open(browser,opts={}){const ctx=await phoneContext(browser,{width:412,height:915,coarse:true});const page=await ctx.newPage();page.errors=[];page.on('pageerror',e=>page.errors.push(String(e.message||e)));await coarsePointer(page);const failed=await lockNetwork(page,url);await page.addInitScript((v3)=>{try{if(!sessionStorage.getItem('__s')){sessionStorage.setItem('__s','1');localStorage.setItem('mbm_titanforge_v3',JSON.stringify(v3));}}catch(e){}},V3);await page.goto(url);await waitForGame(page);await page.waitForFunction(()=>window.__MBM_TITAN_V5__&&window.__MBM_TITAN_V5__.polishReady===true);await page.waitForTimeout(300);return {ctx,page,failed};}
const quickLift=(p)=>p.evaluate(()=>{window.__MBM_TITAN_FORCE_DIST__=0;const b=document.querySelector('.lift-button');if(b&&!b.disabled)b.click();window.__MBM_TITAN_FORCE_DIST__=null;});
const browser=await launch();
// ---- Rook trial: win ----
{const {ctx,page}=await open(browser);await page.click('.mobile-dock button:has-text("TRIALS")');await page.waitForTimeout(400);
 const btnText=await page.evaluate(()=>document.querySelector('.rival-list article button').textContent.trim());await page.click('.rival-list article button');
 const live=await page.waitForSelector('.lift-console.mbm-trial-live',{timeout:5000}).then(()=>true).catch(()=>false);
 let landed=0;const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')).reps);
 for(let i=0;i<8;i++){await quickLift(page);await page.waitForTimeout(600);}
 const afterReps=await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')).reps);landed=afterReps-before;
 const res=await page.waitForFunction(()=>document.querySelector('.trial-result'),{timeout:15000}).then(()=>page.evaluate(()=>({text:document.querySelector('.trial-result').textContent,won:document.querySelector('.trial-result').classList.contains('won')}))).catch(()=>null);
 await page.waitForFunction(()=>!document.querySelector('.lift-console.mbm-trial-live'),{timeout:5000}).catch(()=>{});
 const after=await page.evaluate(()=>({live:!!document.querySelector('.lift-console.mbm-trial-live'),attempted:JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')).attemptedTrials,unlocked:window.__MBM_TITAN_V5__.records.list().filter(x=>x.unlocked).map(x=>x.id)}));
 ok(live&&landed===8&&res&&res.won&&/Rook defeated/.test(res.text)&&!after.live&&after.attempted.includes(0),`Rook trial: button "${btnText}", .mbm-trial-live set ${live}, ${landed}/8 quick lifts landed, result "${res&&res.text}", class removed ${!after.live}, attemptedTrials ${JSON.stringify(after.attempted)}, ROOK DEFEATED achievement ${after.unlocked.includes('rook')}`);
 ok(page.errors.length===0,`Rook trial page errors ${page.errors.length}`);await ctx.close();}
// ---- Rook trial: loss leaves attemptedTrials [] and CHALLENGE ----
{const {ctx,page}=await open(browser);await page.click('.mobile-dock button:has-text("TRIALS")');await page.waitForTimeout(400);await page.click('.rival-list article button');await page.waitForSelector('.lift-console.mbm-trial-live',{timeout:5000});
 const res=await page.waitForFunction(()=>document.querySelector('.trial-result'),{timeout:20000}).then(()=>page.evaluate(()=>({text:document.querySelector('.trial-result').textContent,lost:document.querySelector('.trial-result').classList.contains('lost')}))).catch(()=>null);
 await page.waitForTimeout(500);const st=await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')).attemptedTrials);
 await page.evaluate(()=>{const b=document.querySelector('.trial-result');if(b)b.remove();});await page.click('.mobile-dock button:has-text("TRIALS")');await page.waitForTimeout(400);const btn=await page.evaluate(()=>document.querySelector('.rival-list article button').textContent.trim());
 ok(res&&res.lost&&st.length===0&&/CHALLENGE/.test(btn),`lost trial: result "${res&&res.text}", attemptedTrials ${JSON.stringify(st)}, button "${btn}"`);await ctx.close();}
// ---- ascension shards + beh_1 hook ----
{const {ctx,page}=await open(browser);
 const r=await page.evaluate(async()=>{window.dispatchEvent(new CustomEvent('mbm:titan-ascend',{detail:{strength:50000,ascensions:1}}));await new Promise(r=>setTimeout(r,200));const dna=window.__MBM_TITAN_V4__.getDNA();return {shards:dna.lifetimeShards,claimed:dna.claimedThrough,live:document.querySelector('.mbm-v4-live').textContent};});
 await page.click('.mobile-dock .mbm-v5-dock-dna');await page.waitForTimeout(300);const before=await page.evaluate(()=>window.__MBM_TITAN_ASCENSION_GAIN__);
 await page.click('.mbm-v4-node-list article:first-child button');await page.waitForTimeout(200);const after=await page.evaluate(()=>({gain:window.__MBM_TITAN_ASCENSION_GAIN__,lv:window.__MBM_TITAN_V4__.getDNA().levels.beh_1,title:document.querySelector('.mbm-v4-node-list article:first-child strong').textContent}));
 ok(r.shards===7&&r.claimed===1&&before===1&&after.gain===1.03&&after.lv===1,`mbm:titan-ascend {strength:50000, ascensions:1} → ${r.shards} shards ("${r.live}"); beh_1 unlock → "${after.title}", __MBM_TITAN_ASCENSION_GAIN__ ${before} → ${after.gain}`);await ctx.close();}
await browser.close();
// ---- no-WebGL boot ----
{const b2=await launch({noWebGL:true});const {ctx,page}=await open(b2);
 const gl=await page.evaluate(()=>{const c=document.createElement('canvas');return !!(c.getContext('webgl')||c.getContext('webgl2'));});
 const t0=await page.evaluate(()=>document.querySelector('.mbm-graphics-btn').textContent);await page.evaluate(()=>document.querySelector('.mbm-graphics-btn').click());await page.waitForTimeout(500);
 const t1=await page.evaluate(()=>({text:document.querySelector('.mbm-graphics-btn').textContent,mode:window.__MBM_TITAN_MOBILE_V2__.renderMode,off:document.querySelector('.fighter-stage').classList.contains('mbm-webgl-off'),dead:document.querySelector('.mbm-graphics-btn').classList.contains('mbm-v2-dead-control')}));
 await quickLift(page);await page.waitForTimeout(400);
 ok(!gl&&t0==='3D RIG'&&t1.text==='2D SAFE'&&t1.off&&page.errors.length===0,`no-WebGL boot: webgl available ${gl}; "${t0}" → click → "${t1.text}", renderMode ${t1.mode}, webgl-off ${t1.off}, uncaught errors ${page.errors.length}`);
 await ctx.close();await b2.close();}
// ---- network-locked full session ----
{const b3=await launch();const {ctx,page,failed}=await open(b3);
 await quickLift(page);await page.waitForTimeout(300);for(const t of ['GEAR','TRIALS','ZONES']){await page.click(`.mobile-dock button:has-text("${t}")`);await page.waitForTimeout(300);await page.keyboard.press('Escape');await page.waitForTimeout(200);}
 await page.click('.mobile-dock .mbm-v5-dock-dna');await page.waitForTimeout(300);await page.keyboard.press('Escape');await page.click('.top-actions button:last-child');await page.waitForTimeout(300);await page.keyboard.press('Escape');
 await page.click('.mobile-dock button:has-text("TRIALS")');await page.waitForSelector('.mbm-v5-rival-btn');await page.click('.mbm-v5-rival-btn');await page.waitForTimeout(300);await page.click('.mbm-v5-host');await page.waitForFunction(()=>document.querySelector('.mbm-v5-offer').value.length>20,{timeout:8000});
 await page.waitForTimeout(1500);const reqs=await page.evaluate(()=>performance.getEntriesByType('resource').length);
 ok(failed.length===0&&reqs===0&&page.errors.length===0,`network-locked session (lift, every dialog, host a duel): off-page requests attempted ${failed.length}, resource entries ${reqs}, page errors ${page.errors.length}`);
 await ctx.close();await b3.close();}
server.close();console.log(lines.join('\n'));console.log(`RESULT ${fail?'FAIL':'PASS'} (${lines.length-fail}/${lines.length})`);process.exit(fail?1:0);
