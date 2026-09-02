import path from 'node:path';
import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame } from './lib.mjs';
const file=process.argv[2];const dir=path.dirname(path.resolve(file)),name=path.basename(file);
const {server,base}=await serve(dir);const browser=await launch();
const ctx=await phoneContext(browser,{width:412,height:915,coarse:true});const page=await ctx.newPage();
await coarsePointer(page);const url=`${base}/${name}`;await lockNetwork(page,url);await page.goto(url);await waitForGame(page);await page.waitForTimeout(500);
const out=await page.evaluate(async()=>{
  const A=window.__MBM_TITAN_AAA__,ctl=A.getController(),V2=window.__MBM_TITAN_MOBILE_V2__;
  const raf=()=>new Promise(r=>requestAnimationFrame(r));
  // one quick lift via the real button path
  while(ctl.phase!=='concentric')await raf();let prev=ctl.position;while(!(Math.abs(ctl.position-.72)<=.05&&ctl.position>=prev)){prev=ctl.position;await raf();}ctl.action();
  let lastTap=0;while(ctl.phase==='isometric'){const t=performance.now();if(Math.abs(ctl.balance-.5)>.035&&t-lastTap>=112){ctl.action();lastTap=t;}await raf();}
  while(ctl.phase==='eccentric'&&ctl.position<.665)await raf();ctl.action();
  await new Promise(r=>setTimeout(r,2500));
  const stacks={};const orig=window.requestAnimationFrame;
  window.requestAnimationFrame=function(cb){const s=new Error().stack.split('\n').slice(2,6).map(x=>x.trim().replace(/\(.*?:(\d+):(\d+)\)/,'L$1:$2')).join(' <- ');if(/frame|request/.test(String(cb))||/request|frame/.test(s)){stacks[s]=(stacks[s]||0)+1;}return orig.call(window,cb);};
  const d0=V2.metrics.draws;await new Promise(r=>setTimeout(r,2500));const d1=V2.metrics.draws;
  window.requestAnimationFrame=orig;
  return {drawsDelta:d1-d0,stacks};
});
await browser.close();server.close();console.log(JSON.stringify(out,null,1));
