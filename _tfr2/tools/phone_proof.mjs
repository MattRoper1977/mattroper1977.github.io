// P1 / P2 gate: phone proof. Usage: node phone_proof.mjs <html> <outdir> [label]
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame, box, overlaps } from './lib.mjs';

const [,, file, outDir, label='proof'] = process.argv;
const SIZES=[[360,740],[390,844],[412,915],[1366,768]];
const SELS=['.fighter-stage','.lift-console','.lift-button','.mobile-dock','.mbm-phase-track','.mbm-v4-vitals','.mbm-v4-goal','.mbm-v4-vitalstrip','.avatar-placeholder img','.arena'];
const POPS=['.mbm-reward-pop','.mbm-cycle-result','.mbm-v2-reward','.mbm-v3-toast','.mbm-v4-impact','.mbm-v2-burst','.mbm-forge-flash','.mbm-level-burst','.mbm-v5-rank','.mbm-v5-form-cine','.mbm-v5-ach'];
fs.mkdirSync(outDir,{recursive:true});
const dir=path.dirname(path.resolve(file)),name=path.basename(file);
const {server,base}=await serve(dir);
const browser=await launch();
const report={label,file:name,sizes:{}};
const lines=[];
for(const [w,h] of SIZES){
  const phone=w<=780;
  const ctx=await phoneContext(browser,{width:w,height:h,coarse:phone});
  const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
  if(phone)await coarsePointer(page);
  const url=`${base}/${name}`;
  const failed=await lockNetwork(page,url);
  await page.goto(url);
  await waitForGame(page);
  await page.waitForTimeout(600);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(150);
  const coarse=await page.evaluate(()=>matchMedia('(pointer:coarse)').matches);
  const boxes={};for(const s of SELS)boxes[s]=await box(page,s);
  const pops={};for(const s of POPS)pops[s]=await box(page,s);
  const lb=boxes['.lift-button'];
  const inView=!!(lb&&lb.y>=0&&lb.bottom<=h&&lb.x>=0&&lb.x+lb.w<=w&&lb.display!=='none');
  const trackVisible=(()=>{const t=boxes['.mbm-phase-track'];return !!(t&&t.display!=='none'&&t.y>=0&&t.bottom<=h);})();
  const img=boxes['.avatar-placeholder img'],arena=boxes['.arena'];
  const headOk=!!(img&&arena&&img.y>=arena.y-1&&img.y>=0);
  const overlap=Object.entries(pops).filter(([k,b])=>b&&b.display!=='none'&&overlaps(b,lb)).map(([k])=>k);
  const tag=`${w}x${h}`;
  await page.screenshot({path:path.join(outDir,`${label}-${tag}-viewport.png`),fullPage:false});
  await page.screenshot({path:path.join(outDir,`${label}-${tag}-full.png`),fullPage:true});
  report.sizes[tag]={coarse,boxes,pops,liftButtonInViewportAtScroll0:inView,consoleHeightPx:boxes['.lift-console']?boxes['.lift-console'].h:null,phaseTrackVisible:trackVisible,athleteHeadNotClipped:headOk,popupOverlapsLift:overlap,failedRequests:failed,pageErrors:errors};
  lines.push(`${tag} pointer:coarse=${coarse} lift-button fully inside viewport at scroll 0: ${inView?'YES':'NO'} · console height ${boxes['.lift-console']?boxes['.lift-console'].h:'n/a'}px · lift box ${lb?`y${lb.y}-${lb.bottom} h${lb.h}`:'n/a'} · phase-track visible ${trackVisible?'YES':'NO'} · head not clipped ${headOk?'YES':'NO'} · popup overlapping lift: ${overlap.length?'YES ('+overlap.join(',')+')':'NO'} · failed requests ${failed.length} · page errors ${errors.length}`);
  await ctx.close();
}
await browser.close();server.close();
fs.writeFileSync(path.join(outDir,`${label}.json`),JSON.stringify(report,null,2));
console.log(lines.join('\n'));
