/* Actual two-origin native flow against inactive assembled publication fixtures. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
const edu='https://madebymatt.uk',play='https://www.madebymatt-play.uk',route='/Lessons/Games/Glitch_Clash.html',key='glitchclash_save';
const seed={v:3,owned:['stryke','halo','brik'],dups:{stryke:2},team:['stryke','halo','brik'],cleared:[],xp:123,stickers:{},settings:{calm:false,motion:'auto',hc:false,cb:false},dailyDone:'',weeklyDone:'',tutorialDone:false,seen:{},stats:{wins:0,clashWins:0}};
const results=[];const sender=fs.readFileSync(path.join(root,'education-site/stub-handoff.js'),'utf8');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
let browser;
async function caseRun(name,{width=390,empty=false,drift=false,large=false,reject=false,script=sender}={}){
 const context=await browser.newContext({viewport:{width,height:844},hasTouch:width===390,isMobile:width===390,acceptDownloads:true});
 const errors=[],unexpected=[],fragmentNetwork=[];let source=JSON.stringify({...seed,...(large?{extra:'x'.repeat(40000)}:{}),...(reject?{owned:['toString'],team:['toString']}:{})});
 await context.addInitScript(({edu,play,key,source,empty,seed})=>{
  if(location.origin===edu){if(!empty&&localStorage.getItem(key)===null)localStorage.setItem(key,source);localStorage.setItem('unrelated_hc3_synthetic','preserve');}
  if(location.origin===play&&localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify({...seed,xp:9}));
 },{edu,play,key,source,empty,seed});
 await context.route('**/*',async request=>{
  const url=new URL(request.request().url());
  if(url.hash.includes('mbm_import'))fragmentNetwork.push(url.href);
  let file;
  if(url.origin===edu){
   if(url.pathname===route)file=path.join(root,'education-lessons/Games/Glitch_Clash.html');
   else if(url.pathname==='/stub-handoff.js')return request.fulfill({status:200,contentType:'text/javascript',body:script});
   else {unexpected.push(url.href);return request.abort();}
  }else if(url.origin===play)file=path.resolve(root,'games','.'+decodeURIComponent(url.pathname));
  else {unexpected.push(url.href);return request.abort();}
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){unexpected.push('missing '+url.href);return request.fulfill({status:404,body:'Missing fixture'});}
  if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  return request.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const result={name,width,scope:'Inactive assembled candidate; not live publication'};
 try{
  await page.goto(edu+route+'?view=calm#keep=one',{waitUntil:'load'});
  const button=page.getByRole('button',{name:'Bring my progress',exact:true});
  assert.equal(await button.count(),empty?0:1,'Expected route-specific progress button');
  if(empty){assert.equal(new URL(await page.locator('#play-game').getAttribute('href')).search,'?view=calm');assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);result.status='PASS';return;}
  if(drift){source=JSON.stringify({...seed,xp:456});await page.evaluate(({key,source})=>localStorage.setItem(key,source),{key,source});}
  if(large){
   const downloadPromise=page.waitForEvent('download');await button.click();const download=await downloadPromise;
   const data=fs.readFileSync(await download.path());assert.equal(data.toString(),source);
   await page.locator('#play-game').click();await page.waitForFunction(()=>typeof __GCsave==='function');
   await page.locator('#importfile').setInputFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer:data});
   await page.waitForFunction(()=>__GCsave().xp===123);
  }else{await button.click();await page.waitForURL(play+route+'**');}
  await page.waitForFunction(()=>typeof __GCsave==='function'&&!document.querySelector('#campaign-waiting[open]')&&!__GCcampaign()?.pending);
  const state=await page.evaluate(async key=>({memory:__GCsave(),campaign:__GCcampaign(),legacy:localStorage.getItem(key),records:await campaignRepository.list(),hash:location.hash,search:location.search}),key);
  assert.equal(JSON.parse(state.legacy).xp,9,'Destination legacy campaign changed');
  assert(!state.hash.includes('mbm_import'),'Consumed fragment remained in address');assert(state.hash.includes('keep=one'));assert.equal(state.search,'?view=calm');
  if(reject){assert.equal(state.memory.xp,9);assert.equal(state.records.length,0);}else{assert.equal(state.memory.xp,drift?456:123,'Imported campaign differs');assert.equal(state.records.length,1);assert.equal(JSON.parse(state.records[0].save).xp,drift?456:123);}
  const old=await context.newPage();await old.goto(edu+route);assert.equal(await old.evaluate(key=>localStorage.getItem(key),key),source);assert.equal(await old.evaluate(()=>localStorage.getItem('unrelated_hc3_synthetic')),'preserve');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(fragmentNetwork,[]);
  await page.screenshot({path:path.join(out,name.replace(/[^a-z0-9]/gi,'_')+'-'+width+'.png')});
  result.status='PASS';result.sourceUnchanged=true;result.destinationLegacyUnchanged=true;result.fragmentRemoved=true;result.records=state.records.length;
 }catch(error){result.status='FAIL';result.reason=error.message;throw error;}
 finally{result.errors=errors;result.unexpectedRequests=unexpected;results.push(result);fs.writeFileSync(path.join(out,'handoff-browser.json'),JSON.stringify({status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',scope:'Inactive two-origin fixture only',results},null,2)+'\n');await context.close();}
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await chromium.launch();
 try{
  for(const width of [390,1280])await caseRun('native round trip',{width});
  await caseRun('empty old origin',{empty:true});await caseRun('latest save at user action',{drift:true});await caseRun('native file fallback',{large:true});await caseRun('native rejection clears fragment',{reject:true});
  const before=results.length;const planted=sender.replace("key: 'glitchclash_save'","key: 'other_game'");assert.notEqual(planted,sender);
  await assert.rejects(()=>caseRun('planted wrong key',{script:planted}),/Expected route-specific progress button/);
  const rejected=results.splice(before);assert.equal(rejected.length,1);assert.equal(rejected[0].status,'FAIL');
  await caseRun('restored sender');
  fs.writeFileSync(path.join(out,'handoff-control.json'),JSON.stringify({real:'PASS',planted:'FAIL',restored:'PASS',rejected},null,2)+'\n');
  fs.writeFileSync(path.join(out,'handoff-browser.json'),JSON.stringify({status:'PASS',scope:'Inactive two-origin fixture only',results},null,2)+'\n');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
