// Reduced-motion gate: OS prefers-reduced-motion + in-game toggle. Lifts happen; G1-G7 must not animate.
import path from 'node:path';
import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame } from './lib.mjs';
const file=process.argv[2];const dir=path.dirname(path.resolve(file)),name=path.basename(file);
const {server,base}=await serve(dir);const browser=await launch();
const ctx=await phoneContext(browser,{width:412,height:915,coarse:true,reducedMotion:true});const page=await ctx.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
await coarsePointer(page);const url=`${base}/${name}`;await lockNetwork(page,url);
await page.addInitScript(()=>{try{localStorage.setItem('mbm_titanforge_save_v1',JSON.stringify({strength:495,coins:80,gems:3,reps:11,perfects:0,bestCombo:0,ascensions:0,equipped:0,purchased:[0],zone:0,claimedQuests:[],lastDaily:"",attemptedTrials:[],starterTier:0,windowLevel:0,comboLevel:0,sound:true,reducedMotion:true}));}catch(e){}});
await page.goto(url);await waitForGame(page);await page.waitForTimeout(500);
const out=await page.evaluate(async()=>{
  const A=window.__MBM_TITAN_AAA__,ctl=A.getController(),V2=window.__MBM_TITAN_MOBILE_V2__,G=window.__MBM_TITAN_V5__;
  const raf=()=>new Promise(r=>requestAnimationFrame(r));
  const shellReduced=!!document.querySelector('.game-shell.reduced-motion'),mq=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const d0=V2.metrics.draws,sp0=V2.metrics.spawned||0,gl0=V2.metrics.glowPasses||0;
  // one PERFECT rep (rep 12 -> form unlock; strength 495+ -> CONTENDER)
  while(ctl.phase!=='concentric')await raf();let prev=ctl.position;while(!(Math.abs(ctl.position-.72)<=.05&&ctl.position>=prev)){prev=ctl.position;await raf();}ctl.action();
  let lastTap=0;while(ctl.phase==='isometric'){const t=performance.now();if(Math.abs(ctl.balance-.5)>.035&&t-lastTap>=112){ctl.action();lastTap=t;}await raf();}
  while(ctl.phase==='eccentric'&&ctl.position<.665)await raf();ctl.action();
  await new Promise(r=>setTimeout(r,700));
  // any running animations on V5-owned nodes?
  const v5Nodes=Array.from(document.querySelectorAll('[class*="mbm-v5-"],.arena.mbm-v5-parallax,.avatar-placeholder,.avatar-placeholder img'));
  const running=document.getAnimations().filter(a=>{const t=a.effect&&a.effect.target;return t&&v5Nodes.includes(t)&&a.playState==='running';}).map(a=>(a.animationName||a.transitionProperty||'?')+'@'+(a.effect.target.className||a.effect.target.tagName));
  const cam=getComputedStyle(document.querySelector('.arena')).getPropertyValue('--mbm-cam').trim();
  return {shellReduced,mq,fx:G.fxCounters,draws:V2.metrics.draws-d0,spawned:(V2.metrics.spawned||0)-sp0,glowPasses:(V2.metrics.glowPasses||0)-gl0,running,cam,formPlate:!!document.querySelector('.mbm-v5-plate'),cineImgs:document.querySelectorAll('.mbm-v5-cine img').length,rankShown:!!document.querySelector('.mbm-v5-rank.mbm-v5-show'),rankText:(document.querySelector('.mbm-v5-rank strong')||{}).textContent};
});
await page.screenshot({path:path.join(path.dirname(file),'shots','p3','reduced-412x915.png')});
await browser.close();server.close();
const zero=Object.entries(out.fx).filter(([k,v])=>['parallaxKicks','camPushes','squashes','idleDrifts'].includes(k)&&v>0).map(([k,v])=>k+'='+v);
console.log(`reduced-motion: shell.reduced-motion=${out.shellReduced} prefers-reduced-motion=${out.mq}`);
console.log(`V5 counters ${JSON.stringify(out.fx)} — motion counters non-zero: ${zero.length?zero.join(','):'none'}`);
console.log(`G3 particles spawned ${out.spawned}, glow passes ${out.glowPasses}, FX canvas draws during the rep ${out.draws} (pre-existing V2 muscle overlay redraw; no particles)`);
console.log(`V5 running animations/transitions after the lift: ${out.running.length?out.running.join(', '):'none'}; --mbm-cam=${out.cam||'1'}`);
console.log(`G5 instant swap + name plate: plate=${out.formPlate} wipe images=${out.cineImgs}; G7 rank card static: shown=${out.rankShown} ${out.rankText}`);
console.log(`page errors ${errors.length}`);
const ok=zero.length===0&&out.spawned===0&&out.glowPasses===0&&out.running.length===0&&out.cineImgs===0&&errors.length===0;
console.log(`RESULT ${ok?'PASS':'FAIL'}`);process.exit(ok?0:1);
