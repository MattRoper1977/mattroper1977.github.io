/* Count invoked browser callbacks as well as paints: skipping draws alone is not idle. */
'use strict';
const assert=require('node:assert/strict');

const sample=(page,ms=600)=>page.evaluate(ms=>new Promise(resolve=>{
  const before={callbacks:window.__AS1_RAF_COUNT,...window.MBMArcadeHooks.state()};
  setTimeout(()=>{const after=window.MBMArcadeHooks.state();resolve({
    callbacks:window.__AS1_RAF_COUNT-before.callbacks,
    renders:after.renderCount-before.renderCount,
    physics:after.physicsCount-before.physicsCount,
    paused:after.paused,mode:after.mode
  });},ms);
}),ms);
const idle=value=>value.callbacks===0&&value.renders===0&&value.physics===0;

async function verifyScheduling(browser,url){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const rows=[],errors=[];
  const record=(name,value,predicate)=>{
    assert.ok(predicate(value),name+': '+JSON.stringify(value));
    rows.push({name,status:'PASS',value});
  };
  try{
    await context.addInitScript(()=>{
      window.__AS1_RAF_COUNT=0;window.__AS1_LAST_CLEAR=0;
      const raf=requestAnimationFrame.bind(window);
      window.requestAnimationFrame=callback=>raf(now=>{window.__AS1_RAF_COUNT++;return callback(now);});
      for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){
        const proto=window[name]?.prototype;if(!proto)continue;
        const clear=proto.clear;proto.clear=function(...args){window.__AS1_LAST_CLEAR=performance.now();return clear.apply(this,args);};
      }
    });
    const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url,{waitUntil:'load',timeout:90000});
    await page.waitForFunction(()=>window.MBMArcadeHooks&&document.body.dataset.boot==='ready');
    await page.waitForTimeout(2500);
    record('idle menu invokes no animation callbacks',await sample(page),idle);

    // A real continuously scheduled fault must be rejected by the same idle predicate.
    await page.evaluate(()=>{function fault(){window.__AS1_FAULT=requestAnimationFrame(fault);}fault();});
    const fault=await sample(page);
    record('planted continuous loop is RED',fault,value=>!idle(value)&&value.callbacks>0);
    await page.evaluate(()=>cancelAnimationFrame(window.__AS1_FAULT));
    record('removing loop restores idle GREEN',await sample(page),idle);

    // The preview applies after 90 ms, including the non-rebuild weather/livery path.
    const preview=await page.evaluate(async()=>{
      const select=document.querySelector('#weatherSelect');
      const at=performance.now();select.selectedIndex=(select.selectedIndex+1)%select.options.length;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,350));
      return{paintAfterMs:window.__AS1_LAST_CLEAR-at};
    });
    record('delayed menu preview wakes renderer',preview,value=>value.paintAfterMs>=85);
    record('preview returns to sleep',await sample(page),idle);

    await page.locator('#startBtn').click();
    await page.waitForFunction(()=>window.MBMArcadeHooks.state().physicsCount>0,null,{timeout:15000});
    record('real Start stage wakes physics',await sample(page),value=>value.mode==='running'&&!value.paused&&value.physics>0&&value.renders>0);
    await page.locator('#as1-pause').click();await page.waitForTimeout(350);
    record('user pause sleeps with physics held',await sample(page),value=>value.paused&&idle(value));
    const burst=await page.evaluate(async()=>{
      const before=window.MBMArcadeHooks.state().renderCount;
      for(let i=0;i<50;i++)document.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,350));
      return{renders:window.MBMArcadeHooks.state().renderCount-before};
    });
    record('50 invalidations share one paint',burst,value=>value.renders===1);
    record('invalidation does not leave a second loop',await sample(page),idle);
    await page.locator('#as1-pause').click();
    record('Resume wakes held stage',await sample(page),value=>!value.paused&&value.physics>0&&value.renders>0);
    await page.locator('#as1-more').click();await page.waitForTimeout(350);
    record('More panel sleeps with physics held',await sample(page),value=>value.paused&&idle(value));
    await page.getByRole('button',{name:'Done',exact:true}).click();
    record('Done wakes held stage',await sample(page),value=>!value.paused&&value.physics>0&&value.renders>0);

    // Exercise the existing visibility listener without claiming an OS background test.
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForTimeout(350);
    record('hidden event cancels pending frame and holds physics',await sample(page),value=>value.paused&&idle(value));
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForTimeout(350);
    record('visible event preserves user pause and returns to sleep',await sample(page),value=>value.paused&&idle(value));
    await page.locator('#as1-pause').click();
    record('explicit Resume after visibility wakes physics',await sample(page),value=>!value.paused&&value.physics>0);
    record('scheduling journey has no browser errors',errors,value=>value.length===0);
    return rows;
  }finally{await context.close();}
}
module.exports={verifyScheduling};
