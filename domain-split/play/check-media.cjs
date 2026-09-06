/* Decode and operate accepted deployment media in both browser engines.
 * Viewport/touch emulation is reported honestly; it is not physical iOS testing. */
const {chromium,webkit}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('.play-review'),base=process.env.PLAY_REVIEW_URL||'http://127.0.0.1:4173';
const games=JSON.parse(fs.readFileSync(path.join(root,'output/games/data/play-discovery.json'))).games.filter(g=>g.media.video),out=path.join(root,'media-qa');fs.mkdirSync(out,{recursive:true});
const report={date:new Date().toISOString(),expectedClips:games.length,proofs:[],failures:[],limitation:'Desktop browser engines with touch/viewport emulation. Physical iOS/Android devices, hardware gamepads and local multiplayer pairing are not certified.'};
(async()=>{for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'?{channel:'chrome'}:{});
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390}),page=await context.newPage();page.setDefaultTimeout(15000);let requested=[];page.on('request',r=>{if(/\.(mp4|webm)(\?|$)/.test(r.url()))requested.push(r.url());});
  await page.goto(base);assert.equal(requested.length,0,'Collection downloaded video before user request');
  for(const g of games){try{
   await page.locator('#query').fill(g.title);const trigger=page.locator('#game-grid [data-watch="'+g.id+'"]');if(width===390)await trigger.tap();else await trigger.click();
   const video=page.locator('#game-dialog video');await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.currentTime>.4&&!v.paused&&v.readyState>=2;});
   const frames=await video.evaluate(v=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('No decoded frame')),5000);if(v.requestVideoFrameCallback)v.requestVideoFrameCallback((_,meta)=>{clearTimeout(t);resolve({presentedFrames:meta.presentedFrames,width:v.videoWidth,height:v.videoHeight});});else{clearTimeout(t);resolve({width:v.videoWidth,height:v.videoHeight,time:v.currentTime});}}));assert(frames.width>0&&frames.height>0);
   const duration=await video.evaluate(v=>v.duration);assert(duration>=12&&duration<=25);
   await video.evaluate(v=>{v.currentTime=v.duration*.55;});await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.seeking&&v.currentTime>=v.duration*.54;});
   await video.evaluate(v=>v.pause());const time=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(300);assert.equal(await video.evaluate(v=>v.currentTime),time);
   if(width===390){await page.setViewportSize({width:844,height:390});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await video.evaluate(v=>v.play());await page.waitForFunction(()=>!document.querySelector('video').paused);await page.setViewportSize({width:390,height:844});}
   await page.screenshot({path:path.join(out,engine+'-'+width+'-'+g.id+'.png')});
   await page.keyboard.press('Escape');assert.equal(await page.locator('video').count(),0);assert(await trigger.evaluate(e=>e===document.activeElement));
   report.proofs.push({engine,version:browser.version(),width,title:g.title,duration,decoded:frames,seek:true,pause:true,closeStops:true,escapeReturnsFocus:true,landscape:width===390});
  }catch(e){report.failures.push({engine,width,title:g.title,error:e.stack});await page.screenshot({path:path.join(out,engine+'-'+width+'-'+g.id+'-failure.png')}).catch(()=>{});await page.goto(base);}}
  await context.close();
 }
 await browser.close();
}
report.pass=games.length>0&&report.failures.length===0;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
})().catch(e=>{report.failures.push({error:e.stack});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;});
