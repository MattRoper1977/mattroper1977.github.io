// P4 gate: two contexts in one Chromium. A hosts, B answers via paste, channel opens, 20 s POWER-OFF with
// scripted lifts both sides, identical totals + correct winner, B closes -> A shows RIVAL LEFT.
// Then FORM DUEL (first to 3) and the hash-open QR path with the BroadcastChannel handoff.
import path from 'node:path';import fs from 'node:fs';
import { serve, launch, phoneContext, lockNetwork, coarsePointer, waitForGame } from './lib.mjs';
const file=process.argv[2],outDir=process.argv[3]||'shots/p4';fs.mkdirSync(outDir,{recursive:true});
const dir=path.dirname(path.resolve(file)),name=path.basename(file);const {server,base}=await serve(dir);const url=`${base}/${name}`;
const browser=await launch({webrtc:true});const lines=[];let fail=0;const ok=(cond,msg)=>{lines.push((cond?'PASS ':'FAIL ')+msg);if(!cond)fail++;};
process.on('uncaughtException',(e)=>{lines.push('FAIL harness threw: '+String(e.message||e).split('\n')[0]);fail++;console.log(lines.join('\n'));console.log(`RESULT FAIL (${lines.length-fail}/${lines.length})`);process.exit(1);});process.on('unhandledRejection',(e)=>{lines.push('FAIL harness threw: '+String(e&&e.message||e).split('\n')[0]);fail++;console.log(lines.join('\n'));console.log(`RESULT FAIL (${lines.length-fail}/${lines.length})`);process.exit(1);});
async function open(ctx,hash){const page=await ctx.newPage();page.errors=[];page.on('pageerror',e=>page.errors.push(String(e.message||e)));await coarsePointer(page);await lockNetwork(page,url);await page.goto(url+(hash||''));await waitForGame(page);await page.waitForFunction(()=>window.__MBM_TITAN_V5__&&window.__MBM_TITAN_V5__.duel&&window.__MBM_TITAN_V5__.duel.built());await page.waitForTimeout(200);return page;}
async function openRival(page){await page.click('.mobile-dock button:has-text("TRIALS")');await page.waitForSelector('.mbm-v5-rival-btn',{timeout:5000});await page.click('.mbm-v5-rival-btn');await page.waitForSelector('.mbm-v5-duel-dialog:not([hidden])',{timeout:5000});}
const st=(p)=>p.evaluate(()=>window.__MBM_TITAN_V5__.duel.state());
const quickLift=(p)=>p.evaluate(()=>{window.__MBM_TITAN_FORCE_DIST__=0;const b=document.querySelector('.lift-button');if(b&&!b.disabled)b.click();window.__MBM_TITAN_FORCE_DIST__=null;});
const triRep=(p,perfect)=>p.evaluate(async(perfect)=>{const ctl=window.__MBM_TITAN_AAA__.getController();const raf=()=>new Promise(r=>requestAnimationFrame(r));while(ctl.phase!=='concentric'||ctl.committing)await raf();let prev=ctl.position;if(perfect){while(!(Math.abs(ctl.position-.72)<=.05&&ctl.position>=prev)){prev=ctl.position;await raf();}}else{while(!(ctl.position<.25)){await raf();}}ctl.action();let lastTap=0;while(ctl.phase==='isometric'){const t=performance.now();if(perfect&&Math.abs(ctl.balance-.5)>.035&&t-lastTap>=112){ctl.action();lastTap=t;}await raf();}if(perfect){while(ctl.phase==='eccentric'&&ctl.position<.665)await raf();if(ctl.phase==='eccentric')ctl.action();}else{while(ctl.phase==='eccentric')await raf();}let done=false;const h=()=>{done=true;};window.addEventListener('mbm:titan-lift',h);const t0=performance.now();while(!done&&performance.now()-t0<3000)await raf();window.removeEventListener('mbm:titan-lift',h);return done;},perfect);

// ---------- 1. POWER-OFF via paste ----------
const ctxA=await phoneContext(browser,{width:412,height:915,coarse:true}),ctxB=await phoneContext(browser,{width:412,height:915,coarse:true});
const A=await open(ctxA),B=await open(ctxB);
await openRival(A);await A.fill('.mbm-v5-name','ALPHA');await A.click('.mbm-v5-host');
await A.waitForFunction(()=>document.querySelector('.mbm-v5-offer').value.length>20,{timeout:8000});
const offer=await A.inputValue('.mbm-v5-offer');const qrShown=await A.evaluate(()=>!document.querySelector('.mbm-v5-host-qr').hidden&&document.querySelector('.mbm-v5-host-qr').width>50);
const qrPng=await A.evaluate(()=>document.querySelector('.mbm-v5-host-qr').toDataURL('image/png'));fs.writeFileSync(path.join(outDir,'host-qr.png'),Buffer.from(qrPng.split(',')[1],'base64'));fs.writeFileSync(path.join(outDir,'host-qr.expected.txt'),'https://madebymatt.uk/titanforge/#duel='+offer);
await A.screenshot({path:path.join(outDir,'p4-host-code-412x915.png')});
ok(offer.length<400,`offer code ${offer.length} chars (< 400) · ${offer.slice(0,24)}…`);ok(qrShown,'host QR canvas rendered');
await openRival(B);await B.fill('.mbm-v5-name','BRAVO');await B.click('.mbm-v5-join');await B.fill('.mbm-v5-offer-in',offer);await B.click('.mbm-v5-generate');
await B.waitForFunction(()=>document.querySelector('.mbm-v5-answer').value.length>20,{timeout:8000});const answer=await B.inputValue('.mbm-v5-answer');
ok(answer.length<400,`answer code ${answer.length} chars (< 400)`);
await A.fill('.mbm-v5-answer-in',answer);const tConnect=Date.now();await A.click('.mbm-v5-connect');
let connected=false;for(let i=0;i<100;i++){const a=await st(A),b=await st(B);if(a&&b&&a.connected&&b.connected){connected=true;break;}await A.waitForTimeout(100);}
const sA=await st(A),sB=await st(B);ok(connected,`datachannel open on both sides in ${Date.now()-tConnect} ms (host openMs ${sA&&sA.openMs}, guest openMs ${sB&&sB.openMs}); A sees rival "${sA&&sA.rival}", B sees "${sB&&sB.rival}", guest clock offset ${sB&&sB.offset} ms`);
await A.screenshot({path:path.join(outDir,'p4-connected-412x915.png')});
if(connected){
  await A.click('.mbm-v5-start');await A.waitForTimeout(1700);
  const end=Date.now()+20500;let la=0,lb=0,ta=Date.now(),tb=Date.now();
  while(Date.now()<end){const now=Date.now();if(now>=ta){await quickLift(A);la++;ta=now+1400;}if(now>=tb){await quickLift(B);lb++;tb=now+2300;}await A.waitForTimeout(50);}
  await A.waitForTimeout(600);await A.screenshot({path:path.join(outDir,'p4-poweroff-live-412x915.png')});
  await A.waitForFunction(()=>{const s=window.__MBM_TITAN_V5__.duel.state();return s&&s.ended;},{timeout:8000});await B.waitForFunction(()=>{const s=window.__MBM_TITAN_V5__.duel.state();return s&&s.ended;},{timeout:8000});
  await A.waitForTimeout(300);
  const rA=await A.evaluate(()=>({me:+document.querySelector('.mbm-v5-r-me').textContent,them:+document.querySelector('.mbm-v5-r-them').textContent,title:document.querySelector('.mbm-v5-result strong').textContent,rec:window.__MBM_TITAN_V5__.duel.record(),crests:window.__MBM_TITAN_MOBILE_V2__.getCrests(),live:document.querySelector('.mbm-v4-live').textContent}));
  const rB=await B.evaluate(()=>({me:+document.querySelector('.mbm-v5-r-me').textContent,them:+document.querySelector('.mbm-v5-r-them').textContent,title:document.querySelector('.mbm-v5-result strong').textContent,rec:window.__MBM_TITAN_V5__.duel.record(),crests:window.__MBM_TITAN_MOBILE_V2__.getCrests()}));
  await A.screenshot({path:path.join(outDir,'p4-result-A-412x915.png')});await B.screenshot({path:path.join(outDir,'p4-result-B-412x915.png')});
  ok(rA.me===rB.them&&rA.them===rB.me,`POWER-OFF totals identical both sides: A shows ALPHA ${rA.me} / BRAVO ${rA.them}; B shows BRAVO ${rB.me} / ALPHA ${rB.them} (A tapped ${la}, B tapped ${lb})`);
  ok(rA.me>rA.them&&/VICTORY/.test(rA.title)&&/DEFEAT/.test(rB.title),`winner correct: A "${rA.title}", B "${rB.title}"`);
  ok(rA.rec.wins===1&&rA.rec.bestPower===rA.me&&rA.rec.lastOpponent==='BRAVO'&&rB.rec.losses===1&&rB.rec.lastOpponent==='ALPHA',`records: A ${JSON.stringify(rA.rec)} · B ${JSON.stringify(rB.rec)}`);
  ok(rA.crests===1&&rB.crests===0,`crests: A ${rA.crests} (+1), B ${rB.crests}`);
  ok(/DUEL WON/.test(rA.live),`V4 announcer got the result: "${rA.live}"`);
  // B closes -> A shows RIVAL LEFT
  await ctxB.close();await A.waitForFunction(()=>{const el=document.querySelector('.mbm-v5-result strong');return el&&/RIVAL LEFT/.test(el.textContent);},{timeout:8000}).then(()=>ok(true,'A shows RIVAL LEFT after B closed')).catch(()=>ok(false,'A did not show RIVAL LEFT within 8 s'));
  await A.screenshot({path:path.join(outDir,'p4-rival-left-412x915.png')});
  ok(A.errors.length===0&&B.errors.length===0,`page errors A ${A.errors.length} B ${B.errors.length} ${A.errors.concat(B.errors).join(' | ')}`);
}
await ctxA.close();

// ---------- 2. FORM DUEL (first to 3) via test seams ----------
{const cA=await phoneContext(browser,{width:412,height:915,coarse:true}),cB=await phoneContext(browser,{width:412,height:915,coarse:true});const A2=await open(cA),B2=await open(cB);
 await openRival(A2);await A2.fill('.mbm-v5-name','ALPHA');await A2.click('.mbm-v5-modes button:nth-child(2)');await A2.click('.mbm-v5-host');await A2.waitForFunction(()=>document.querySelector('.mbm-v5-offer').value.length>20,{timeout:8000});const off2=await A2.inputValue('.mbm-v5-offer');
 await openRival(B2);await B2.fill('.mbm-v5-name','BRAVO');await B2.click('.mbm-v5-join');await B2.fill('.mbm-v5-offer-in',off2);await B2.click('.mbm-v5-generate');await B2.waitForFunction(()=>document.querySelector('.mbm-v5-answer').value.length>20,{timeout:8000});const ans2=await B2.inputValue('.mbm-v5-answer');
 await A2.fill('.mbm-v5-answer-in',ans2);await A2.click('.mbm-v5-connect');let c2=false;for(let i=0;i<100;i++){const a=await st(A2),b=await st(B2);if(a&&b&&a.connected&&b.connected){c2=true;break;}await A2.waitForTimeout(100);}
 ok(c2,'FORM DUEL: channel open');
 if(c2){await A2.click('.mbm-v5-start');await A2.waitForTimeout(1800);const adv=await A2.evaluate(()=>document.querySelector('.mbm-mode-btn').getAttribute('aria-pressed'));ok(adv==='true','FORM DUEL forces 3-PHASE mode on');
  let rounds=0;while(rounds<6){const s=await st(A2);if(!s||s.ended)break;await Promise.all([triRep(A2,true),triRep(B2,false)]);rounds++;await A2.waitForTimeout(500);}
  await A2.waitForFunction(()=>{const s=window.__MBM_TITAN_V5__.duel.state();return s&&s.ended;},{timeout:15000}).catch(()=>{});
  const fA=await A2.evaluate(()=>({title:(document.querySelector('.mbm-v5-result strong')||{}).textContent,me:(document.querySelector('.mbm-v5-r-me')||{}).textContent,them:(document.querySelector('.mbm-v5-r-them')||{}).textContent,st:window.__MBM_TITAN_V5__.duel.state()}));
  const fB=await B2.evaluate(()=>({title:(document.querySelector('.mbm-v5-result strong')||{}).textContent,me:(document.querySelector('.mbm-v5-r-me')||{}).textContent,them:(document.querySelector('.mbm-v5-r-them')||{}).textContent}));
  await A2.screenshot({path:path.join(outDir,'p4-form-result-A-412x915.png')});
  ok(/VICTORY/.test(fA.title||'')&&fA.me==='3'&&fB.them==='3'&&/DEFEAT/.test(fB.title||''),`FORM DUEL: A "${fA.title}" ${fA.me}-${fA.them}, B "${fB.title}" ${fB.me}-${fB.them} after ${rounds} scripted rounds`);}
 await cA.close();await cB.close();}

// ---------- 3. QR / hash path with BroadcastChannel handoff ----------
{const cX=await phoneContext(browser,{width:412,height:915,coarse:true}),cY=await phoneContext(browser,{width:412,height:915,coarse:true});
 const D=await open(cX);await openRival(D);await D.fill('.mbm-v5-name','HOSTIE');await D.click('.mbm-v5-host');await D.waitForFunction(()=>document.querySelector('.mbm-v5-offer').value.length>20,{timeout:8000});const off3=await D.inputValue('.mbm-v5-offer');
 const Y=await open(cY,'#duel='+off3);
 const yHash=await Y.evaluate(()=>location.hash);
 await Y.waitForFunction(()=>document.querySelector('.mbm-v5-answer')&&document.querySelector('.mbm-v5-answer').value.length>20,{timeout:8000}).catch(()=>{});const yHandled=await Y.evaluate(()=>window.__MBM_TITAN_V5__.duel.hashHandled);
 const ans3=await Y.inputValue('.mbm-v5-answer');const yQr=await Y.evaluate(()=>!document.querySelector('.mbm-v5-join-qr').hidden);
 await Y.screenshot({path:path.join(outDir,'p4-hash-guest-412x915.png')});
 ok(yHash===''&&yHandled==='o',`guest opened with #duel=<offer>: hash stripped from history (location.hash "${yHash}"), offer handled, answer auto-generated (${ans3.length} chars), answer QR shown ${yQr}`);
 // "camera app" opens the answer link in a new tab of the host's browser
 const E=await open(cX,'#duel='+ans3);const eHash=await E.evaluate(()=>location.hash);const sent=await E.evaluate(()=>(document.querySelector('.mbm-v5-sent')||{}).textContent||'');
 await E.screenshot({path:path.join(outDir,'p4-hash-sent-412x915.png')});
 ok(eHash===''&&/SENT — return to the game/.test(sent),`answer tab: hash stripped ("${eHash}"), shows "${sent.slice(0,26)}"`);
 let c3=false;for(let i=0;i<100;i++){const a=await st(D),b=await st(Y);if(a&&b&&a.connected&&b.connected){c3=true;break;}await D.waitForTimeout(100);}
 const dIn=await D.inputValue('.mbm-v5-answer-in');ok(c3&&dIn===ans3,`host tab received the answer over BroadcastChannel and the channel opened (host sees "${(await st(D)||{}).rival}")`);
 const sig=await D.evaluate(()=>localStorage.getItem('mbm_titanforge_duel_signal'));ok(sig===null,`transient signal key cleared (${sig===null?'absent':'present'})`);
 await cX.close();await cY.close();}
await browser.close();server.close();
console.log(lines.join('\n'));console.log(`RESULT ${fail?'FAIL':'PASS'} (${lines.length-fail}/${lines.length})`);process.exit(fail?1:0);
