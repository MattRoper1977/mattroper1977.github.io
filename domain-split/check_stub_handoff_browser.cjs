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
 const errors=[],unexpected=[],requests=[];let source=JSON.stringify({...seed,...(large?{extra:'x'.repeat(40000)}:{}),...(reject?{owned:['toString'],team:['toString']}:{})});
 const destination=JSON.stringify({...seed,xp:9});
 await context.route('**/*',async request=>{
  const url=new URL(request.request().url());
  const transport={url:url.href,method:request.request().method(),body:request.request().postData()};requests.push(transport);
  // Fragments are never part of an HTTP request. Check actual methods, query
  // strings and bodies instead, so a sender that moves save bytes there fails.
  if(transport.method!=='GET'||transport.body!==null||!['','?view=calm'].includes(url.search)){
   unexpected.push('Disallowed handoff transport '+JSON.stringify(transport));return request.abort();
  }
  if([edu,play].includes(url.origin)&&url.pathname==='/__hc3_seed__')return request.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Once-only synthetic storage fixture</title>'});
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
  // Seed each origin once. No page initializer may repair deletion or corruption
  // when the source is revisited for the preservation assertion.
  const setup=await context.newPage();await setup.goto(edu+'/__hc3_seed__');
  await setup.evaluate(({key,source,empty})=>{if(!empty)localStorage.setItem(key,source);localStorage.setItem('unrelated_hc3_synthetic','preserve');},{key,source,empty});
  await setup.goto(play+'/__hc3_seed__');
  await setup.evaluate(({key,destination})=>{localStorage.setItem(key,destination);localStorage.setItem('unrelated_hc3_destination','preserve destination');},{key,destination});
  await setup.close();
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
  const state=await page.evaluate(async key=>({memory:__GCsave(),campaign:__GCcampaign(),legacy:localStorage.getItem(key),unrelated:localStorage.getItem('unrelated_hc3_destination'),records:await campaignRepository.list(),hash:location.hash,search:location.search}),key);
  assert.equal(state.legacy,destination,'Destination legacy campaign changed');
  assert.equal(state.unrelated,'preserve destination','Unrelated destination storage changed');
  assert(!state.hash.includes('mbm_import'),'Consumed fragment remained in address');assert(state.hash.includes('keep=one'));assert.equal(state.search,'?view=calm');
  if(reject){assert.equal(state.memory.xp,9);assert.equal(state.records.length,0);}else{
   assert.equal(state.records.length,1);const persisted=JSON.parse(state.records[0].save),expected=JSON.parse(source);
   for(const field of Object.keys(seed)){assert.deepEqual(state.memory[field],expected[field],'Imported memory differs: '+field);assert.deepEqual(persisted[field],expected[field],'Imported campaign differs: '+field);}
  }
  const old=await context.newPage();await old.goto(edu+route);assert.equal(await old.evaluate(key=>localStorage.getItem(key),key),source,'Source campaign changed during transfer');assert.equal(await old.evaluate(()=>localStorage.getItem('unrelated_hc3_synthetic')),'preserve','Unrelated source storage changed');
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  await page.screenshot({path:path.join(out,name.replace(/[^a-z0-9]/gi,'_')+'-'+width+'.png')});
  result.status='PASS';result.sourceUnchanged=true;result.destinationLegacyUnchanged=true;result.unrelatedStorageUnchanged=true;result.noSavePayloadInRequests=true;result.fragmentRemoved=true;result.records=state.records.length;
 }catch(error){result.status='FAIL';result.reason=error.message;throw error;}
 finally{result.errors=errors;result.unexpectedRequests=unexpected;result.requests=requests;results.push(result);fs.writeFileSync(path.join(out,'handoff-browser.json'),JSON.stringify({status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',scope:'Inactive two-origin fixture only',results},null,2)+'\n');await context.close();}
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});browser=await chromium.launch();
 try{
  for(const width of [390,1280])await caseRun('native round trip',{width});
  await caseRun('empty old origin',{empty:true});await caseRun('latest save at user action',{drift:true});await caseRun('native file fallback',{large:true});await caseRun('native rejection clears fragment',{reject:true});
  const rejected=[];
  for(const [name,from,to,reason] of [
   ['wrong key',"key: 'glitchclash_save'","key: 'other_game'",/Expected route-specific progress button/],
   ['source deletion','location.assign(transfer.href);',"localStorage.removeItem(entry.key); location.assign(transfer.href);",/Source campaign changed during transfer/],
   ['unrelated source corruption','location.assign(transfer.href);',"localStorage.setItem('unrelated_hc3_synthetic','corrupted'); location.assign(transfer.href);",/Unrelated source storage changed/]
  ]){
   const before=results.length,planted=sender.replace(from,to);assert.notEqual(planted,sender);
   await assert.rejects(()=>caseRun('planted '+name,{script:planted}),reason);
   const failure=results.splice(before);assert.equal(failure.length,1);assert.equal(failure[0].status,'FAIL');rejected.push(...failure);
   await caseRun('restored after '+name);
  }
  await caseRun('restored sender');
  fs.writeFileSync(path.join(out,'handoff-control.json'),JSON.stringify({real:'PASS',planted:'FAIL',restored:'PASS',rejected},null,2)+'\n');
  fs.writeFileSync(path.join(out,'handoff-browser.json'),JSON.stringify({status:'PASS',scope:'Inactive two-origin fixture only',results},null,2)+'\n');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
