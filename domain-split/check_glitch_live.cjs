/* Real canonical-origin native imports; no route fulfillment or storage reseeding. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const receipt=JSON.parse(fs.readFileSync(process.argv[2])),out=path.resolve(process.argv[3]);
const origin='https://www.madebymatt-play.uk',route='/Lessons/Games/Glitch_Clash.html',key='glitchclash_save';
assert.equal(receipt.origin,origin);assert.equal(receipt.route,route);
const seed={v:3,owned:['stryke','halo','brik'],dups:{stryke:2},team:['stryke','halo','brik'],cleared:[],xp:123,stickers:{},settings:{calm:false,motion:'auto',hc:false,cb:false},dailyDone:'',weeklyDone:'',tutorialDone:false,seen:{},stats:{wins:0,clashWins:0}};
const results=[];
async function settle(page){await page.waitForFunction(()=>typeof __GCsave==='function'&&typeof __GCcampaign==='function'&&!document.querySelector('#campaign-waiting[open]')&&!__GCcampaign()?.pending);}
function known(actual,expected){for(const field of Object.keys(seed))assert.deepEqual(actual[field],expected[field],'Native campaign differs: '+field);if('extra' in expected)assert.equal(actual.extra,expected.extra,'Large native field truncated');}
async function responseBytes(response,expected=receipt.expected_sha256){assert(response,'Navigation response missing');assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/text\/html/);assert.equal(crypto.createHash('sha256').update(await response.body()).digest('hex'),expected,'Live navigation bytes differ from the source-bound publication');}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch();
 try{
  for(const width of [390,1280])for(const mode of ['fragment','file','reject']){
   const context=await browser.newContext({viewport:{width,height:844},hasTouch:width===390,isMobile:width===390,serviceWorkers:'block',acceptDownloads:true});
   const errors=[],requests=[];context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
   context.on('request',request=>{const url=new URL(request.url());if(url.origin!==origin||request.method()!=='GET'||request.postData()!==null||url.searchParams.has('mbm_import'))requests.push({url:request.url(),method:request.method(),body:request.postData()});});
   const result={width,mode,scope:'Real canonical Play origin; synthetic isolated browser saves only'};
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
     assert.equal(await page.evaluate(()=>__GCcampaign().id),identity,'Reload selected another campaign');known(await page.evaluate(()=>__GCsave()),incoming);
     assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),legacy,'Reload changed legacy campaign');
    }
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    await page.screenshot({path:path.join(out,mode+'-'+width+'.png')});
    result.status='PASS';result.fragmentRemoved=true;result.legacyPreserved=true;result.networkBytesMatch=true;
   }catch(error){result.status='FAIL';result.reason=error.message;throw error;}
   finally{result.errors=errors;result.unexpectedRequests=requests;results.push(result);fs.writeFileSync(path.join(out,'native-live.json'),JSON.stringify({status:results.every(r=>r.status==='PASS')?'PASS':'FAIL',receipt,results},null,2)+'\n');await context.close();}
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
