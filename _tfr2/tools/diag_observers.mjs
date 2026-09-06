import path from 'node:path';import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame } from './lib.mjs';
const file=process.argv[2];const dir=path.dirname(path.resolve(file)),name=path.basename(file);const {server,base}=await serve(dir);const browser=await launch();
const ctx=await phoneContext(browser,{width:412,height:915,coarse:true});const page=await ctx.newPage();await coarsePointer(page);const url=`${base}/${name}`;await lockNetwork(page,url);
await page.addInitScript(()=>{
  window.__obs={};const O=window.MutationObserver;
  window.MutationObserver=function(cb){const site=(new Error().stack.split('\n')[2]||'').trim().replace(/.*:(\d+):(\d+)\)?$/,'L$1:$2');const rec={site,calls:0,records:0,ms:0};window.__obs[site+'#'+Math.random().toString(36).slice(2,6)]=rec;return new O(function(list,obs){const t=performance.now();rec.calls++;rec.records+=list.length;cb(list,obs);rec.ms+=performance.now()-t;});};
  window.MutationObserver.prototype=O.prototype;
  window.__iv={};const SI=window.setInterval;window.setInterval=function(fn,ms){const site=(new Error().stack.split('\n')[2]||'').trim().replace(/.*:(\d+):(\d+)\)?$/,'L$1:$2');const rec={site,ms:ms,calls:0,cost:0};window.__iv[site+'@'+ms]=rec;return SI(function(){const t=performance.now();rec.calls++;try{fn.apply(this,arguments);}finally{rec.cost+=performance.now()-t;}},ms);};
});
await page.goto(url);await waitForGame(page);await page.waitForTimeout(500);
const out=await page.evaluate(async()=>{
  for(const k in window.__obs){window.__obs[k].calls=0;window.__obs[k].records=0;window.__obs[k].ms=0;}for(const k in window.__iv){window.__iv[k].calls=0;window.__iv[k].cost=0;}
  const ctl=window.__MBM_TITAN_AAA__.getController();const raf=()=>new Promise(r=>requestAnimationFrame(r));const end=performance.now()+10000;
  while(performance.now()<end){while((ctl.phase!=='concentric'||ctl.committing)&&performance.now()<end)await raf();let prev=ctl.position;while(!(Math.abs(ctl.position-.72)<=.05&&ctl.position>=prev)&&performance.now()<end){prev=ctl.position;await raf();}if(performance.now()>=end)break;ctl.action();let lastTap=0;while(ctl.phase==='isometric'){const t=performance.now();if(Math.abs(ctl.balance-.5)>.035&&t-lastTap>=112){ctl.action();lastTap=t;}await raf();}while(ctl.phase==='eccentric'&&ctl.position<.665)await raf();if(ctl.phase==='eccentric')ctl.action();await new Promise(r=>setTimeout(r,350));}
  return {obs:Object.values(window.__obs).filter(o=>o.calls>0).sort((a,b)=>b.ms-a.ms),iv:Object.values(window.__iv).filter(o=>o.calls>0).sort((a,b)=>b.cost-a.cost)};
});
await browser.close();server.close();
console.log('MutationObservers (10 s of play):');out.obs.forEach(o=>console.log(`  ${o.site} calls ${o.calls} records ${o.records} cost ${o.ms.toFixed(1)} ms`));
console.log('setIntervals:');out.iv.forEach(o=>console.log(`  ${o.site} every ${o.ms} ms calls ${o.calls} cost ${o.cost.toFixed(1)} ms`));
