/* Genuine old-origin button journeys; no fulfillment, initializer or reseeding. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const receipt=JSON.parse(fs.readFileSync(process.argv[2])),out=path.resolve(process.argv[3]);
assert.equal(receipt.status,'READY');
const route=receipt.route,key='glitchclash_save',play=receipt.playOrigin;
const seed={v:3,owned:['stryke','halo','brik'],dups:{stryke:2},team:['stryke','halo','brik'],cleared:[],xp:123,stickers:{},settings:{calm:false,motion:'auto',hc:false,cb:false},dailyDone:'',weeklyDone:'',tutorialDone:false,seen:{},stats:{wins:0,clashWins:0}};
const results=[],origins=[];const allowed=new Map();
function paths(root,prefix='',found=new Set()){
 for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  const name=prefix+'/'+entry.name;
  if(entry.isDirectory())paths(path.join(root,entry.name),name,found);
  else if(entry.isFile()){found.add(name);if(entry.name==='index.html')found.add(name.slice(0,-10));}
  else throw Error('Non-file artifact entry: '+name);
 }return found;
}
const eduPaths=paths(receipt.publications.site.root);for(const p of paths(receipt.publications.lessons.root))eduPaths.add('/Lessons'+p);
for(const origin of receipt.educationOrigins)allowed.set(origin,eduPaths);
const playPaths=paths(receipt.publications.games.root);for(const origin of [play,'https://madebymatt-play.uk'])allowed.set(origin,playPaths);
function permitted(url,method,body){const u=new URL(url);let p;try{p=decodeURIComponent(u.pathname);}catch{return false;}return method==='GET'&&body===null&&allowed.get(u.origin)?.has(p)&&(u.search===''||(p===route&&u.search==='?view=calm'));}
const realRequest=[receipt.educationOrigins[0]+route+'?view=calm','GET',null];assert(permitted(...realRequest));assert(!permitted(realRequest[0]+'&save=planted','GET',null));assert(!permitted(receipt.educationOrigins[0]+'/__hc3_save__/planted','GET',null));assert(permitted(...realRequest));
async function exact(response,digest){assert(response);assert.equal(response.status(),200);assert.equal(crypto.createHash('sha256').update(await response.body()).digest('hex'),digest,'Live component differs from its bound publication');}
async function settled(page){await page.waitForFunction(()=>typeof __GCsave==='function'&&typeof __GCcampaign==='function'&&!document.querySelector('#campaign-waiting[open]')&&!__GCcampaign()?.pending);}
async function state(page){return page.evaluate(async key=>({memory:__GCsave(),campaign:__GCcampaign(),legacy:localStorage.getItem(key),sentinel:localStorage.getItem('hc3_destination_sentinel'),records:await campaignRepository.list(),hash:location.hash,search:location.search}),key);}
function fields(actual,expected){for(const field of Object.keys(seed))assert.deepEqual(actual[field],expected[field],field);if('extra'in expected)assert.equal(actual.extra,expected.extra);}
function durable(actual,incoming,legacy,reject){assert.equal(actual.legacy,legacy);assert.equal(actual.sentinel,'destination untouched');assert(!actual.hash.includes('mbm_import'));assert(actual.hash.includes('keep=one'));assert.equal(actual.search,'?view=calm');if(reject){fields(actual.memory,JSON.parse(legacy));assert.equal(actual.records.length,0);}else{assert.equal(actual.records.length,1);fields(actual.memory,incoming);fields(JSON.parse(actual.records[0].save),incoming);assert.equal(actual.campaign.id,actual.records[0].id);}}
function save(){
 const expected=origins.filter(o=>o.status==='SERVED').flatMap(o=>[390,1280].flatMap(width=>['fragment','empty','latest','file','reject'].map(mode=>o.origin+'|'+width+'|'+mode)));
 const actual=results.map(r=>r.origin+'|'+r.width+'|'+r.mode);
 const complete=origins.length===receipt.educationOrigins.length&&expected.length>0&&actual.length===expected.length&&new Set(actual).size===actual.length&&expected.every(key=>actual.includes(key));
 fs.writeFileSync(path.join(out,'handoff-live.json'),JSON.stringify({status:results.some(r=>r.status==='FAIL')?'FAIL':complete&&results.every(r=>r.status==='PASS')?'PASS':'INCOMPLETE',expectedCases:expected.length,completedCases:results.length,scope:'Synthetic saves through genuine published button and native importer; unavailable redirected origins are explicitly excluded',receipt,origins,results},null,2)+'\n');}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch();
 try{
  // Probe redirects without creating any saved state on the destination origin.
  for(const edu of receipt.educationOrigins){
   const context=await browser.newContext({serviceWorkers:'block'});try{
    const response=await context.request.get(edu+route,{maxRedirects:0});
    if([301,302,303,307,308].includes(response.status())){origins.push({origin:edu,status:'UNAVAILABLE_ORIGIN',http:response.status(),location:response.headers().location,reason:'Redirected before same-origin code can recover storage; no storage seeded or read'});continue;}
    await exact(response,receipt.digests.stub);const wrong=(receipt.digests.stub[0]==='0'?'1':'0')+receipt.digests.stub.slice(1);await assert.rejects(()=>exact(response,wrong),/Live component differs/);await exact(response,receipt.digests.stub);origins.push({origin:edu,status:'SERVED',byteControl:{real:'PASS',planted:'FAIL',restored:'PASS'}});
   }finally{await context.close();save();}
  }
  assert(origins.some(o=>o.status==='SERVED'),'No legacy education origin serves the handoff');
  for(const edu of origins.filter(o=>o.status==='SERVED').map(o=>o.origin))for(const width of [390,1280])for(const mode of ['fragment','empty','latest','file','reject']){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390,serviceWorkers:'block',acceptDownloads:true});
   const errors=[],unexpected=[],responses=[];const result={origin:edu,width,mode};
   context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
   context.on('request',r=>{if(!permitted(r.url(),r.method(),r.postData()))unexpected.push({url:r.url(),method:r.method(),body:r.postData()});});
   context.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
   context.on('response',r=>{const u=new URL(r.url());let digest;if(u.origin===edu&&u.pathname==='/stub-handoff.js')digest=receipt.digests.sender;else if(u.origin===play&&u.pathname===route&&r.request().resourceType()==='document')digest=receipt.digests.receiver;if(digest)responses.push(exact(r,digest).catch(e=>errors.push(e.message)));});
   let incoming={...seed,...(mode==='file'?{extra:'x'.repeat(40000)}:{}),...(mode==='reject'?{owned:['toString'],team:['toString']}:{})};
   let source=JSON.stringify(incoming);const legacy=JSON.stringify({...seed,xp:9});
   try{
    const setup=await context.newPage();await exact(await setup.goto(edu+route),receipt.digests.stub);assert.equal(new URL(setup.url()).origin,edu,'Redirect changed the source storage origin');
    await setup.evaluate(({key,source,mode})=>{if(mode!=='empty')localStorage.setItem(key,source);localStorage.setItem('hc3_source_sentinel','source untouched');},{key,source,mode});
    const landing=await setup.goto(play+'/game-saves/');assert.equal(landing.status(),200);assert.equal(new URL(setup.url()).origin,play);await setup.waitForFunction(()=>document.querySelector('#save-export')?.disabled===false);await setup.evaluate(({key,legacy})=>{localStorage.setItem(key,legacy);localStorage.setItem('hc3_destination_sentinel','destination untouched');},{key,legacy});await setup.close();
    const page=await context.newPage();await exact(await page.goto(edu+route+'?view=calm#keep=one'),receipt.digests.stub);assert.equal(new URL(page.url()).origin,edu);
    const button=page.getByRole('button',{name:'Bring my progress',exact:true});assert.equal(await button.count(),mode==='empty'?0:1);
    if(mode==='empty'){
     assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);assert.equal(await page.evaluate(()=>localStorage.getItem('hc3_source_sentinel')),'source untouched');
    }else{
     const box=await button.boundingBox();assert(box&&box.width>=44&&box.height>=44);
     let reached=false;for(let i=0;i<12;i++){await page.keyboard.press('Tab');if(await button.evaluate(e=>e===document.activeElement)){reached=true;break;}}assert(reached,'Real Tab walk missed progress button');
     if(mode==='latest'){incoming={...seed,xp:456};source=JSON.stringify(incoming);await page.evaluate(({key,source})=>localStorage.setItem(key,source),{key,source});}
     if(mode==='file'){
      const downloadEvent=page.waitForEvent('download');await button.click();const download=await downloadEvent;const bytes=fs.readFileSync(await download.path());assert.equal(bytes.toString(),source);
      await page.locator('#play-game').click();await page.waitForURL(play+route+'**');await settled(page);
      await page.locator('.screen.active [data-open="settings"]').click();const choose=page.waitForEvent('filechooser');await page.locator('#ov-settings label').filter({hasText:'Import save'}).click();await(await choose).setFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer:bytes});await page.waitForFunction(()=>__GCsave().xp===123);
     }else{if(width===1280)await page.keyboard.press('Enter');else await button.click();await page.waitForURL(play+route+'**');}
     await settled(page);assert.equal(new URL(page.url()).origin,play);
     await exact(await context.request.get(play+route+'?view=calm'),receipt.digests.receiver);
     const before=await state(page);durable(before,incoming,legacy,mode==='reject');await exact(await page.reload(),receipt.digests.receiver);await settled(page);const after=await state(page);durable(after,incoming,legacy,mode==='reject');if(mode==='reject'){assert.equal(before.campaign,null);assert.equal(after.campaign,null);}else assert.equal(after.campaign.id,before.campaign.id);
     const old=await context.newPage();await exact(await old.goto(edu+route),receipt.digests.stub);assert.equal(new URL(old.url()).origin,edu);assert.equal(await old.evaluate(key=>localStorage.getItem(key),key),source,'Source campaign changed');assert.equal(await old.evaluate(()=>localStorage.getItem('hc3_source_sentinel')),'source untouched');await old.close();
     result.sourcePreserved=true;result.destinationLegacyPreserved=true;result.fragmentRemoved=true;result.reloadPreserved=true;
    }
    await Promise.all(responses);assert(responses.length>0,'Published sender script was never loaded');assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);await page.screenshot({path:path.join(out,mode+'-'+width+'.png')});result.status='PASS';
   }catch(e){result.status='FAIL';result.reason=e.message;throw e;}
   finally{result.errors=errors;result.unexpectedRequests=unexpected;results.push(result);save();await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
