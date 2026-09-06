// P2/P6 gate: six scripted tri-phase reps with reactive brace taps.
// Usage: node rep_harness.mjs <html> [reps=6] [--reduced] [--json out]
import path from 'node:path';import fs from 'node:fs';
import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame } from './lib.mjs';
const file=process.argv[2],reps=Number(process.argv[3]||6),reduced=process.argv.includes('--reduced');
const jsonOut=process.argv.includes('--json')?process.argv[process.argv.indexOf('--json')+1]:null;
const dir=path.dirname(path.resolve(file)),name=path.basename(file);
const {server,base}=await serve(dir);const browser=await launch();
const ctx=await phoneContext(browser,{width:412,height:915,coarse:true,reducedMotion:reduced});
const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
await coarsePointer(page);const url=`${base}/${name}`;const failed=await lockNetwork(page,url);
await page.goto(url);await waitForGame(page);await page.waitForTimeout(400);
// one real tap first so audio/haptics gates see a user gesture and the layers are hot
await page.evaluate(()=>{const a=window.__MBM_TITAN_AAA__;const c=a.getController();if(c.phase!=='concentric')c.reset();});
const results=await page.evaluate(async (reps)=>{
  const A=window.__MBM_TITAN_AAA__,ctl=A.getController();
  const out=[];const raf=()=>new Promise(r=>requestAnimationFrame(r));
  for(let i=0;i<reps;i++){
    // wait for a ready concentric phase
    while(ctl.phase!=='concentric'||ctl.committing)await raf();
    await raf();
    let lift=null,form=null;
    const onLift=e=>{lift=e.detail;},onForm=e=>{form=e.detail;};
    window.addEventListener('mbm:titan-lift',onLift);window.addEventListener('mbm:titan-form-result',onForm);
    // DRIVE: tap when the needle sits in the PERFECT band (|pos-.72|<=.07) and is rising
    let prev=ctl.position;
    while(!(Math.abs(ctl.position-.72)<=.05&&ctl.position>=prev)){prev=ctl.position;await raf();}
    const t0=performance.now();ctl.action();
    // BRACE: reactive taps keep the balance centred until the controller moves on
    let braceStart=performance.now(),lastTap=0;
    while(ctl.phase==='isometric'){const t=performance.now();if(Math.abs(ctl.balance-.5)>.035&&t-lastTap>=112){ctl.action();lastTap=t;}await raf();}
    const braceMs=performance.now()-braceStart;
    // CONTROL: tap at ~.70 (PERFECT band .625-.775)
    while(ctl.phase==='eccentric'&&ctl.position<.665)await raf();
    if(ctl.phase==='eccentric')ctl.action();
    const t1=performance.now();
    while(!lift&&performance.now()-t1<3000)await raf();
    await raf();
    const res=document.querySelector('.mbm-cycle-result span');
    out.push({rep:i+1,braceMs:Math.round(braceMs),grades:form&&form.grades,total:form&&form.total,formMult:form&&form.formMult,beat:form&&form.beat,lift:lift&&{grade:lift.grade,combo:lift.combo,strength:lift.strength,rep:lift.rep},cycleText:res?res.textContent:'',nextRepMult:window.__MBM_TITAN_NEXT_REP_MULT__,bossRep:ctl.bossRep,driveMs:Math.round(t0-t0)});
    window.removeEventListener('mbm:titan-lift',onLift);window.removeEventListener('mbm:titan-form-result',onForm);
    await new Promise(r=>setTimeout(r,450));
  }
  const v3=window.__MBM_TITAN_V3__.getState();
  return {reps:out,v3:{flawlessSets:v3.flawlessSets,cleanSets:v3.cleanSets,nextMult:v3.nextMult},core:JSON.parse(localStorage.getItem('mbm_titanforge_save_v1')||'{}'),sessionTriReps:window.__MBM_TITAN_AAA_TEST__.sessionTriReps&&window.__MBM_TITAN_AAA_TEST__.sessionTriReps()};
},reps);
await browser.close();server.close();
const lines=[];let pass=true;
results.reps.forEach((r,i)=>{const boss=(r.rep%5===0);const braceOk=boss?r.braceMs>=1380&&r.braceMs<=1560:r.braceMs>=730&&r.braceMs<=900;const comboOk=r.lift&&r.lift.combo===r.rep;const gainsOk=r.total===6?/GAINS ×1\.9/.test(r.cycleText):true;if(!comboOk||!braceOk)pass=false;lines.push(`rep ${r.rep}: grades ${r.grades&&r.grades.join('/')} total ${r.total}/6 formMult ${r.formMult} combo x${r.lift&&r.lift.combo} (${comboOk?'ok':'FAIL'}) strength +${r.lift&&r.lift.strength} brace ${r.braceMs}ms${boss?' BOSS':''} (${braceOk?'ok':'FAIL'}) cycle "${r.cycleText}" nextMult ${r.nextRepMult}`);});
const six=results.reps.filter(r=>r.total===6);
lines.push(`6/6 reps: ${six.length}; GAINS ×1.9 shown on all 6/6: ${six.every(r=>/GAINS ×1\.9/.test(r.cycleText))?'YES':'NO'}`);
lines.push(`V3 flawlessSets ${results.v3.flawlessSets} cleanSets ${results.v3.cleanSets} nextMult ${results.v3.nextMult}; core reps ${results.core.reps} strength ${results.core.strength}; sessionTriReps ${results.sessionTriReps}`);
if(results.reps.length>=6&&results.reps[4].lift&&results.reps[5].lift){const r5=results.reps[4].lift.strength,r6=results.reps[5].lift.strength;lines.push(`strength rep5 +${r5} → rep6 +${r6} ratio ${(r6/r5).toFixed(2)} (flawless doubling ${r6/r5>=1.8?'YES':'NO'})`);}
lines.push(`failed requests ${failed.length}, page errors ${errors.length}${errors.length?': '+errors.join(' | '):''}`);
lines.push(`RESULT ${pass?'PASS':'FAIL'}`);
console.log(lines.join('\n'));if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify({results,failed,errors,lines},null,2));
process.exit(pass?0:1);
