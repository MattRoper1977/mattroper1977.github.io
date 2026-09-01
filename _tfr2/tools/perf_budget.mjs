// Performance budget gate: 412x915, coarse pointer, 4x CPU throttle, 30 s scripted tri-phase play.
// Prints median fps over 30 s and the 2D FX draw counter across a 3 s idle window.
// Usage: node perf_budget.mjs <html> [--label x] [--seconds 30] [--reduced]
import path from 'node:path';
import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame } from './lib.mjs';
const file=process.argv[2];const arg=(k,d)=>process.argv.includes(k)?process.argv[process.argv.indexOf(k)+1]:d;
const label=arg('--label','perf'),seconds=Number(arg('--seconds',30)),reduced=process.argv.includes('--reduced');
const dir=path.dirname(path.resolve(file)),name=path.basename(file);
const {server,base}=await serve(dir);const browser=await launch();
const ctx=await phoneContext(browser,{width:412,height:915,coarse:true,reducedMotion:reduced});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
const cdp=await coarsePointer(page);const url=`${base}/${name}`;const failed=await lockNetwork(page,url);
await page.goto(url);await waitForGame(page);await page.waitForTimeout(500);await page.evaluate(()=>{const b=document.querySelector('.mbm-v5-coach-skip');if(b)b.click();});const css=arg('--css','');if(css)await page.addStyleTag({content:css});const js=arg('--js','');if(js)await page.evaluate(js);
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
const res=await page.evaluate(async (seconds)=>{
  const A=window.__MBM_TITAN_AAA__,ctl=A.getController(),V2=window.__MBM_TITAN_MOBILE_V2__;
  const raf=()=>new Promise(r=>requestAnimationFrame(r));
  // frame counter: frames per wall second
  const buckets=[];let frames=0,bucketStart=performance.now(),running=true;
  (function tick(){if(!running)return;frames++;const t=performance.now();if(t-bucketStart>=1000){buckets.push(frames);frames=0;bucketStart=t;}requestAnimationFrame(tick);})();
  if(ctl.phase!=='concentric')ctl.reset();
  const end=performance.now()+seconds*1000,start=performance.now(),CADENCE=3200;let reps=0,lifts=0;
  const onLift=()=>lifts++;window.addEventListener('mbm:titan-lift',onLift);
  while(performance.now()<end){
    // deterministic cadence: one rep attempt every CADENCE ms so every run has the same lift count
    const slot=start+reps*CADENCE;while(performance.now()<slot&&performance.now()<end)await raf();
    while((ctl.phase!=='concentric'||ctl.committing)&&performance.now()<end)await raf();
    let prev=ctl.position;while(!(Math.abs(ctl.position-.72)<=.05&&ctl.position>=prev)&&performance.now()<end){prev=ctl.position;await raf();}
    if(performance.now()>=end)break;ctl.action();
    let lastTap=0;while(ctl.phase==='isometric'){const t=performance.now();if(Math.abs(ctl.balance-.5)>.035&&t-lastTap>=112){ctl.action();lastTap=t;}await raf();}
    while(ctl.phase==='eccentric'&&ctl.position<.665)await raf();if(ctl.phase==='eccentric')ctl.action();
    reps++;
  }
  running=false;window.removeEventListener('mbm:titan-lift',onLift);
  // idle window: no lift for 3 s, then FX draw counter must stay flat for a further second
  while(ctl.phase!=='concentric'||ctl.committing)await raf();
  await new Promise(r=>setTimeout(r,3000));
  const d0=V2.metrics.draws,r0=V2.metrics.rafStarts;await new Promise(r=>setTimeout(r,1000));const d1=V2.metrics.draws,r1=V2.metrics.rafStarts;
  const sorted=buckets.slice().sort((a,b)=>a-b),median=sorted.length?sorted[Math.floor(sorted.length/2)]:0;
  return {buckets,median,min:sorted[0],reps,lifts,idleDrawsDelta:d1-d0,idleRafStartsDelta:r1-r0,totalDraws:d1,renderMode:V2.renderMode,tier:V2.qualityTier};
},seconds);
await browser.close();server.close();
console.log(`${label}: median fps ${res.median} (min ${res.min}) over ${res.buckets.length}s of ${res.reps} scripted reps (${res.lifts} lifts), renderMode ${res.renderMode} tier ${res.tier}; idle 3s→4s FX draws delta ${res.idleDrawsDelta} rafStarts delta ${res.idleRafStartsDelta} (total draws ${res.totalDraws}); failed requests ${failed.length}; page errors ${errors.length}`);
console.log('fps per second: '+res.buckets.join(' '));
const ok=res.median>=50&&res.idleDrawsDelta===0;console.log(`RESULT ${ok?'PASS':'FAIL'}`);process.exit(ok?0:1);
