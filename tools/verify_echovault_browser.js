#!/usr/bin/env node
/* Rendered contracts for /echovault/ — drives the telemetry object, not the DOM. */
'use strict';
const path=require('path'); const { chromium }=require('playwright');
const ROOT=path.resolve(__dirname,'..');
const FILE=process.env.EV_GAME_FILE||process.argv[2]||path.join(ROOT,'echovault','index.html');
const URL='file://'+FILE;
const VPS=[{name:'phone',width:390,height:844},{name:'desktop',width:1366,height:768}];
const out=[]; const assert=(x,m)=>{ if(!x) throw new Error(m); };
async function gate(id,name,fn){ try{ const d=await fn()||''; out.push({id,status:'PASS'}); console.log(`PASS ${id} ${name}${d?' — '+d:''}`);}catch(e){ out.push({id,status:'FAIL'}); console.error(`FAIL ${id} ${name} — ${e.message}`);} }
(async()=>{
  const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
  await gate('B1','zero network requests',async()=>{
    const ctx=await browser.newContext({viewport:VPS[0]}); const p=await ctx.newPage();
    const remote=[]; p.on('request',r=>{ if(!r.url().startsWith('file://')&&!r.url().startsWith('data:')) remote.push(r.url()); });
    await p.goto(URL,{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__echoVault,null,{timeout:25000});
    await p.evaluate(()=>window.__echoVault.start()); await p.waitForTimeout(2500);
    assert(remote.length===0,`fetched ${remote.length}`); await ctx.close(); return 'nothing fetched during boot and play';
  });
  await gate('B2','no page errors',async()=>{
    const ctx=await browser.newContext({viewport:VPS[0]}); const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
    await p.goto(URL,{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__echoVault,null,{timeout:25000});
    await p.evaluate(()=>window.__echoVault.start()); await p.waitForTimeout(2500);
    assert(errs.length===0,errs.slice(0,2).join(' | ')); await ctx.close(); return '0 page errors';
  });
  await gate('B3','every control renders >=44px',async()=>{
    const bad=[];
    for(const vp of VPS){
      const ctx=await browser.newContext({viewport:vp,hasTouch:vp.name==='phone'}); const p=await ctx.newPage();
      await p.goto(URL,{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__echoVault,null,{timeout:25000});
      const off=await p.evaluate((n)=>{
        document.querySelectorAll('.modal,.overlay,[id$="-screen"]').forEach(m=>m.classList.remove('hidden'));
        const r=[];
        for(const el of document.querySelectorAll('button,[role="button"],input,select,a[href]')){
          const b=el.getBoundingClientRect(), s=getComputedStyle(el);
          if(s.display==='none'||s.visibility==='hidden'||b.width===0||b.height===0) continue;
          if(b.width<44||b.height<44) r.push(`${n}:${el.id||el.className} ${Math.round(b.width)}x${Math.round(b.height)}`);
        } return r;
      },vp.name);
      bad.push(...off); await ctx.close();
    }
    assert(bad.length===0,bad.slice(0,6).join('; ')); return `0 undersized controls across ${VPS.length} viewports, measured by rendered box`;
  });
  await gate('B4','U1 wavefront, U9 breath and U10 loud ping all behave',async()=>{
    const ctx=await browser.newContext({viewport:VPS[0]}); const p=await ctx.newPage();
    await p.goto(URL,{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__echoVault,null,{timeout:25000});
    await p.evaluate(()=>window.__echoVault.start());
    // Wait for the sim to actually be running: updateBreath only ticks in 'playing',
    // so starting the drive before that silently measures nothing.
    await p.waitForFunction(()=>window.__echoVault.getState().state==='playing',null,{timeout:15000});
    const r=await p.evaluate(async()=>{
      const ev=window.__echoVault, wait=ms=>new Promise(r=>setTimeout(r,ms));
      const b0=ev.breath(); ev.loudPing(); await wait(200); const b1=ev.breath();
      // Poll for the CONDITION, never for a wall-clock duration. The breath timer
      // advances on SIMULATED time, and on a software rasteriser simulated time lags
      // wall time by several times — a fixed sleep here measures the renderer, not the
      // mechanic. (That is exactly how this gate failed on its first run.)
      const deadline = performance.now() + 45000;
      while (performance.now() < deadline && !ev.breath().held) await wait(150);
      const b2=ev.breath();
      return { noiseBefore:b0.noise, noiseAfterLoud:b1.noise, lure:b1.trailTimer,
               held:b2.held, stillTimer:+b2.stillTimer.toFixed(2), noiseAfterHold:b2.noise,
               maxPulses:ev.maxShaderPulses() };
    });
    assert(r.noiseAfterLoud>r.noiseBefore,'loud ping did not raise noise');
    assert(r.lure>8,`loud ping lure too short (${r.lure})`);
    assert(r.held===true,'held held breath did not engage after 5.6s still and silent');
    assert(r.noiseAfterHold<r.noiseAfterLoud,'noise did not drain while holding breath');
    await ctx.close();
    return `loud ping ${r.noiseBefore.toFixed(0)}->${r.noiseAfterLoud.toFixed(0)} noise with a ${r.lure.toFixed(1)}s lure; breath engaged and drained it to ${r.noiseAfterHold.toFixed(0)}; shader pulse slots ${r.maxPulses}`;
  });
  await gate('B5','a sector completes headlessly with no NaN',async()=>{
    const ctx=await browser.newContext({viewport:VPS[0]}); const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
    await p.goto(URL,{waitUntil:'load'}); await p.waitForFunction(()=>!!window.__echoVault,null,{timeout:25000});
    await p.evaluate(()=>window.__echoVault.start());
    const r=await p.evaluate(async()=>{
      const ev=window.__echoVault, wait=ms=>new Promise(r=>setTimeout(r,ms));
      const nan=[]; for(let i=0;i<3;i++){ ev.ping(); await wait(200); }
      ev.completeSector(); await wait(1500);
      const s=ev.getState();
      for(const [k,v] of Object.entries(s)) if(typeof v==='number'&&!Number.isFinite(v)) nan.push(k);
      return { cores:s.cores, state:s.state, nan };
    });
    assert(r.nan.length===0,`non-finite telemetry: ${r.nan.join(', ')}`);
    assert(r.cores>=3,`sector did not complete (cores ${r.cores})`);
    assert(errs.length===0,errs.slice(0,2).join(' | '));
    await ctx.close(); return `sector completed, cores ${r.cores}, state ${r.state}, no NaN, 0 page errors`;
  });
  await browser.close();
  const f=out.filter(r=>r.status==='FAIL');
  console.log(`\nEcho Vault rendered contract: ${out.length-f.length}/${out.length} gates passed.`);
  if(f.length) process.exit(1);
})().catch(e=>{ console.error('HARNESS ERROR',e); process.exit(1); });
