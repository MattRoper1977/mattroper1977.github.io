/* Real canonical-origin native imports; no route fulfillment or storage reseeding. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const receipt=JSON.parse(fs.readFileSync(process.argv[2])),out=path.resolve(process.argv[3]);
const origin='https://www.madebymatt-play.uk',route='/Lessons/Games/Glitch_Clash.html',key='glitchclash_save';
assert.equal(receipt.origin,origin);assert.equal(receipt.route,route);
const seed={v:3,owned:['stryke','halo','brik'],dups:{stryke:2},team:['stryke','halo','brik'],cleared:[],xp:123,stickers:{},settings:{calm:false,motion:'auto',hc:false,cb:false},dailyDone:'',weeklyDone:'',tutorialDone:false,seen:{},stats:{wins:0,clashWins:0}};
const results=[];
const expectedSearch='?hc3='+receipt.publication.publication_sha;
const publishedPaths=new Set();
function indexPublication(root,prefix=''){
 for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  const relative=prefix+'/'+entry.name;
  if(entry.isDirectory())indexPublication(path.join(root,entry.name),relative);
  else if(entry.isFile()){publishedPaths.add(relative);if(entry.name==='index.html')publishedPaths.add(relative.slice(0,-10));}
  else throw new Error('Non-file publication entry: '+relative);
 }
}
indexPublication(receipt.publication.root);
assert(publishedPaths.has(route),'Receiver absent from request-path admission');
function allowedRequest(url,method,body){
 const target=new URL(url);
 let decoded;try{decoded=decodeURIComponent(target.pathname);}catch{return false;}
 return target.origin===origin&&method==='GET'&&body===null&&publishedPaths.has(decoded)&&
  (target.search===''||(target.pathname===route&&target.search===expectedSearch));
}
assert(allowedRequest(origin+route+expectedSearch,'GET',null));
assert(!allowedRequest(origin+route+'?save=synthetic-planted-value','GET',null),'Alternate query transport was accepted');
assert(!allowedRequest(origin+'/__hc3_save_exfiltration__/synthetic-planted-value','GET',null),'Alternate path transport was accepted');
assert(allowedRequest(origin+route+expectedSearch,'GET',null));
const transportControl={real:'PASS',plantedAlternateQuery:'FAIL',plantedAlternatePath:'FAIL',restored:'PASS'};
async function settle(page){await page.waitForFunction(()=>typeof __GCsave==='function'&&typeof __GCcampaign==='function'&&!document.querySelector('#campaign-waiting[open]')&&!__GCcampaign()?.pending);}
function known(actual,expected){for(const field of Object.keys(seed))assert.deepEqual(actual[field],expected[field],'Native campaign differs: '+field);if('extra' in expected)assert.equal(actual.extra,expected.extra,'Large native field truncated');}
async function responseBytes(response,expected=receipt.expected_sha256){assert(response,'Navigation response missing');assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/text\/html/);assert.equal(crypto.createHash('sha256').update(await response.body()).digest('hex'),expected,'Live navigation bytes differ from the source-bound publication');}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch();
 try{
  for(const width of [390,1280])for(const mode of ['fragment','file','reject']){
   const context=await browser.newContext({viewport:{width,height:844},hasTouch:width===390,isMobile:width===390,serviceWorkers:'block',acceptDownloads:true});
   const errors=[],requests=[];context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
   context.on('request',request=>{if(!allowedRequest(request.url(),request.method(),request.postData()))requests.push({url:request.url(),method:request.method(),body:request.postData()});});
   const result={width,mode,transportControl,scope:'Real canonical Play origin; synthetic isolated browser saves only'};
   try{
    const base=origin+route+'?hc3='+receipt.publication.publication_sha;
    const legacy=JSON.stringify({...seed,xp:9}),incoming={...seed,...(mode==='file'?{extra:'x'.repeat(40000)}:{}),...(mode==='reject'?{owned:['toString'],team:['toString']}:{})};
    const measured=await context.request.get(base);await responseBytes(measured);
    const planted=(receipt.expected_sha256[0]==='0'?'1':'0')+receipt.expected_sha256.slice(1);
    await assert.rejects(()=>responseBytes(measured,planted),/Live navigation bytes differ/);await responseBytes(measured);
    result.byteControl={real:'PASS',planted:'FAIL',restored:'PASS'};
    const setup=await context.newPage();const seedResponse=await setup.goto(origin+'/game-saves/');assert.equal(seedResponse.status(),200);assert.equal(new URL(setup.url()).origin,origin);
    await setup.evaluate(({key,legacy})=>{localStorage.setItem(key,legacy);localStorage.setItem('hc3_unrelated_native','preserve');},{key,legacy});await setup.close();
    const page=await context.newPage();let hash='#keep=one';
    if(mode!=='file')hash+='&mbm_import='+Buffer.from(JSON.stringify(incoming)).toString('base64url');
    await responseBytes(await page.goto(base+hash));await settle(page);
    if(mode==='file'){
     await page.locator('.screen.active [data-open="settings"]').click();
     const chooser=page.waitForEvent('filechooser');await page.locator('#ov-settings label').filter({hasText:'Import save'}).click();
     await (await chooser).setFiles({name:'hc3-synthetic-native.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(incoming))});
     await page.waitForFunction(()=>__GCsave().xp===123);await settle(page);
    }
    let state=await page.evaluate(async key=>({memory:__GCsave(),campaign:__GCcampaign(),legacy:localStorage.getItem(key),sentinel:localStorage.getItem('hc3_unrelated_native'),records:await campaignRepository.list(),hash:location.hash,search:location.search}),key);
    assert.equal(state.legacy,legacy,'Legacy destination campaign changed');assert.equal(state.sentinel,'preserve');assert(!state.hash.includes('mbm_import'));assert(state.hash.includes('keep=one'));assert.equal(state.search,new URL(base).search);
    if(mode==='reject'){known(state.memory,JSON.parse(legacy));assert.equal(state.records.length,0);}else{
     known(state.memory,incoming);assert.equal(state.records.length,1);known(JSON.parse(state.records[0].save),incoming);
     const identity=state.campaign.id;assert(identity);await responseBytes(await page.reload());await settle(page);
     const reloaded=await page.evaluate(async key=>({memory:__GCsave(),campaign:__GCcampaign(),legacy:localStorage.getItem(key),sentinel:localStorage.getItem('hc3_unrelated_native'),records:await campaignRepository.list(),hash:location.hash,search:location.search}),key);
     assert.equal(reloaded.campaign.id,identity,'Reload selected another campaign');known(reloaded.memory,incoming);
     assert.equal(reloaded.legacy,legacy,'Reload changed legacy campaign');assert.equal(reloaded.sentinel,'preserve','Reload changed unrelated sentinel');
     assert.equal(reloaded.records.length,state.records.length,'Reload changed record count');
     assert.equal(reloaded.records[0].id,state.records[0].id,'Reload replaced campaign record');known(JSON.parse(reloaded.records[0].save),incoming);
     assert.equal(reloaded.hash,state.hash,'Reload changed retained fragment');assert.equal(reloaded.search,state.search,'Reload changed retained query');
    }
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    await page.screenshot({path:path.join(out,mode+'-'+width+'.png')});
    result.status='PASS';result.fragmentRemoved=true;result.legacyPreserved=true;result.networkBytesMatch=true;
   }catch(error){result.status='FAIL';result.reason=error.message;throw error;}
   finally{result.errors=errors;result.unexpectedRequests=requests;results.push(result);fs.writeFileSync(path.join(out,'native-live.json'),JSON.stringify({status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',receipt,results},null,2)+'\n');await context.close();}
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
