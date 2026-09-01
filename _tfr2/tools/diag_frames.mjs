import path from 'node:path';import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame } from './lib.mjs';
const file=process.argv[2];const dir=path.dirname(path.resolve(file)),name=path.basename(file);const {server,base}=await serve(dir);const browser=await launch();
const ctx=await phoneContext(browser,{width:412,height:915,coarse:true});const page=await ctx.newPage();const cdp=await coarsePointer(page);const url=`${base}/${name}`;await lockNetwork(page,url);await page.goto(url);await waitForGame(page);await page.waitForTimeout(500);const ci=process.argv.indexOf('--css');if(ci>0)await page.addStyleTag({content:process.argv[ci+1]});
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
const out=await page.evaluate(async()=>{
  const ctl=window.__MBM_TITAN_AAA__.getController();const raf=()=>new Promise(r=>requestAnimationFrame(r));
  const frames=[];let last=performance.now();(function tick(){const t=performance.now();frames.push(t-last);last=t;requestAnimationFrame(tick);})();
  const lifts=[];const od=window.dispatchEvent.bind(window);window.dispatchEvent=function(e){const t0=performance.now();const r=od(e);if(e&&e.type==='mbm:titan-lift'){lifts.push({at:t0,handlerMs:performance.now()-t0});}return r;};
  const start=performance.now();
  for(let i=0;i<6;i++){const slot=start+i*3200;while(performance.now()<slot)await raf();while(ctl.phase!=='concentric'||ctl.committing)await raf();let prev=ctl.position;while(!(Math.abs(ctl.position-.72)<=.05&&ctl.position>=prev)){prev=ctl.position;await raf();}ctl.action();let lastTap=0;while(ctl.phase==='isometric'){const t=performance.now();if(Math.abs(ctl.balance-.5)>.035&&t-lastTap>=112){ctl.action();lastTap=t;}await raf();}while(ctl.phase==='eccentric'&&ctl.position<.665)await raf();if(ctl.phase==='eccentric')ctl.action();}
  await new Promise(r=>setTimeout(r,2500));
  // long frames relative to the nearest preceding lift
  let t=start;const longs=[];let acc=start;const times=[];frames.forEach((d)=>{acc+=d;times.push(acc);});
  for(let i=0;i<frames.length;i++){if(frames[i]>40){const ft=times[i];let rel=null;for(const l of lifts){if(l.at<=ft)rel=ft-l.at;}longs.push({ms:Math.round(frames[i]),sinceLift:rel===null?null:Math.round(rel)});}}
  const sorted=frames.slice().sort((a,b)=>a-b);
  return {frames:frames.length,p50:sorted[Math.floor(sorted.length/2)].toFixed(1),p90:sorted[Math.floor(sorted.length*.9)].toFixed(1),max:Math.round(sorted[sorted.length-1]),lifts:lifts.map(l=>Math.round(l.handlerMs)),longs:longs.slice(0,40)};
});
await browser.close();server.close();
console.log(`frames ${out.frames} p50 ${out.p50}ms p90 ${out.p90}ms max ${out.max}ms; lift handler sync ms per lift: ${out.lifts.join(' ')}`);
const byBucket={};out.longs.forEach(l=>{const k=l.sinceLift===null?'pre':(l.sinceLift<100?'0-100':l.sinceLift<300?'100-300':l.sinceLift<700?'300-700':l.sinceLift<1500?'700-1500':'>1500');byBucket[k]=(byBucket[k]||[]);byBucket[k].push(l.ms);});
Object.keys(byBucket).forEach(k=>console.log(`  long frames ${k}ms after lift: ${byBucket[k].length} frames, ms=${byBucket[k].join(',')}`));
