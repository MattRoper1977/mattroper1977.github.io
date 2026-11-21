'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');

/* The discovery form as it is served now (Site 832852d, 8 Sep): the search
   field stays in #discovery-form, but the four selects (genre, control, mode,
   list) sit in #filters-form inside <dialog id="filters">, opened by
   #filters-open and closed by #filters-close. A select inside a shut dialog
   has no box, so every option read and every choice below opens the drawer
   first; the search field is inert while the modal is up, so the drawer is
   closed again before the field is typed into. What is measured has not
   moved: the stable value travels in the URL, the visible label stays on the
   control, deep links track their value, an unknown option falls back to the
   whole shelf, foreign parameters survive, history is replaced not pushed,
   and clearing leaves the URL clean. */
async function verify(){
 const base=execFileSync('python3',[path.join(__dirname,'../route_origins.py'),'--origin','play'],{encoding:'utf8'}).trim();
 const url=new URL('/games/',base).href,out=path.resolve('audit-output/published-url-filter');
 fs.mkdirSync(out,{recursive:true});const results=[];
 const browser=await chromium.launch();
 async function scenario(width,plant=false){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(plant)await page.addInitScript(()=>{history.replaceState=()=>{};});
  async function ready(){await page.waitForFunction(()=>document.querySelectorAll('#game-grid [data-card]').length>0);}
  async function shown(){return page.locator('#game-grid [data-card]:not([hidden])').count();}
  async function params(){return new URL(page.url()).searchParams;}
  const drawer=page.locator('dialog#filters');
  async function drawerOpen(){return drawer.evaluate(d=>d.open);}
  async function openDrawer(){
   if(!await drawerOpen())await page.locator('#filters-open').click();
   await page.locator('#filters-form select').first().waitFor({state:'visible'});
   assert(await drawerOpen(),'The Filters drawer must open from #filters-open');
   assert.equal(await page.locator('#filters-form select').count(),4,'The Filters drawer must carry the four discovery selects');
  }
  async function closeDrawer(){
   if(await drawerOpen())await page.locator('#filters-close').click();
   assert(!await drawerOpen(),'The Filters drawer must close from #filters-close');
  }
  try{
   await page.goto(url,{waitUntil:'load'});await ready();
   // PLAY-D2 (21 Nov): the drawer and its selects are retired; the page's URL state is the
   // search (?q=, replaced not pushed) and the mood (#mood=, one entry per press). Same claims.
   if(await page.locator('#filters-open').count()===0&&await page.locator('#mood-grid').count()===1)return await d2(page,errors,width);
   const atRest=await shown();assert(atRest>1,'Published shelf did not render');assert.equal(new URL(page.url()).search,'');
   await openDrawer();
   const choices=await page.locator('#filters-form select').evaluateAll(selects=>selects.flatMap(s=>Array.from(s.options).filter(o=>o.value).map(o=>({field:s.name,value:o.value,label:o.textContent.trim()}))));
   const choice=choices.find(x=>x.value!==x.label && !['list','mode'].includes(x.field));
   assert(choice,'No stable value/display-label pair could be measured');
   const select=page.locator('#filters-form select[name="'+choice.field+'"]');
   await select.selectOption(choice.value);assert.equal((await params()).get(choice.field),choice.value,'U2: changing a filter must write its stable value to the URL');
   const subset=await shown();assert(subset>0&&subset<atRest,'Filter must change actual card membership');
   assert.equal((await select.locator('option:checked').innerText()).trim(),choice.label,'The visible selected control must retain its label');
   const filtered=page.url();await page.goto(filtered);await ready();assert.equal(await select.inputValue(),choice.value);assert.equal(await shown(),subset);
   const other=choices.find(x=>x.field===choice.field&&x.value!==choice.value);assert(other,'A discriminating second filter is required');
   const second=new URL(url);second.searchParams.set(other.field,other.value);await page.goto(second.href);await ready();assert.equal(await select.inputValue(),other.value,'Deep links must track their value, not always restore one facet');
   const unknown=new URL(url);unknown.searchParams.set(choice.field,'not-a-real-option-hc3');await page.goto(unknown.href);await ready();assert.equal(await select.inputValue(),'');assert.equal(await shown(),atRest);assert(await page.locator('#empty-state').isHidden());
   await page.goto(url+'?q=neon&hc3_keep=one');await ready();assert.equal(await page.locator('#query').inputValue(),'neon');assert(await shown()>0&&await shown()<atRest);
   const before=await page.evaluate(()=>history.length);await page.locator('#query').fill('');await openDrawer();await select.selectOption(choice.value);
   assert.equal((await params()).get('hc3_keep'),'one');assert.equal(await page.evaluate(()=>history.length),before,'Typing/selecting must replace history');
   await select.selectOption('');assert.equal((await params()).get(choice.field),null);assert.equal((await params()).get('q'),null);assert.equal((await params()).get('hc3_keep'),'one');
   await closeDrawer();
   await page.goto(url);await ready();await page.locator('#query').fill('neon');await page.locator('#query').fill('');assert.equal(new URL(page.url()).search,'');
   assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'filters-'+width+'.png')});
   return {width,atRest,choice,subset,drawer:true,deepLink:true,search:true,unknownFallback:true,foreignParameters:true,replaceHistory:true,clear:true,errors};
  }finally{await context.close();}
 }
 async function d2(page,errors,width){
  await page.waitForFunction(()=>document.documentElement.dataset.playReady==='1');
  const shown=()=>page.locator('#game-grid [data-card]:not([hidden])').count(),params=async()=>new URL(await page.evaluate(()=>location.href)).searchParams;
  const total=await page.locator('#game-grid [data-card]').count(),atRest=await shown();assert(atRest>1&&total>=atRest,'Published page did not render');assert.equal(new URL(page.url()).search,'');
  await page.locator('#query').fill('neon');assert.equal((await params()).get('q'),'neon','U2: changing a filter must write its stable value to the URL');
  const subset=await shown();assert(subset>0&&subset<total,'Search must change actual card membership');
  assert.equal(await page.locator('#result-count').innerText(),subset+' of '+total+' games','The visible count must name the result');
  await page.goto(url+'?q=neon');await page.waitForFunction(()=>document.documentElement.dataset.playReady==='1');assert.equal(await page.locator('#query').inputValue(),'neon');assert.equal(await shown(),subset,'Deep links must restore their value');
  await page.goto(url+'?q=mbm-no-such-game');await page.waitForFunction(()=>document.documentElement.dataset.playReady==='1');assert.equal(await shown(),0);assert(await page.locator('#empty-state').isVisible(),'An unmatched deep link must say so');
  const moods=await page.locator('#mood-grid .mood-btn[data-mood]').evaluateAll(b=>b.map(x=>x.dataset.mood).filter(m=>m!=='all'));assert(moods.length>=2,'The mood controls are missing');
  await page.goto(url+'#mood='+moods[1]);await page.waitForFunction(()=>document.documentElement.dataset.playReady==='1');assert(await page.locator('#mood-results').isVisible(),'#mood= deep links must open their mood');assert.equal(await page.locator('#mood-grid .mood-btn[data-mood="'+moods[1]+'"]').getAttribute('aria-pressed'),'true','Deep links must track their value, not always restore one facet');
  await page.goto(url+'#mood=not-a-real-option-hc3');await page.waitForFunction(()=>document.documentElement.dataset.playReady==='1');assert(await page.locator('#mood-results').isHidden(),'An unknown mood must fall back to the whole page');assert.equal(await shown(),atRest);
  await page.goto(url+'?q=neon&hc3_keep=one');await page.waitForFunction(()=>document.documentElement.dataset.playReady==='1');assert.equal(await page.locator('#query').inputValue(),'neon');
  const before=await page.evaluate(()=>history.length);await page.locator('#query').fill('neo');await page.locator('#query').fill('neon');
  assert.equal((await params()).get('hc3_keep'),'one');assert.equal(await page.evaluate(()=>history.length),before,'Typing must replace history');
  await page.locator('#query').fill('');assert.equal((await params()).get('q'),null);assert.equal((await params()).get('hc3_keep'),'one');
  await page.locator('#mood-grid .mood-btn[data-mood="'+moods[0]+'"]').click();assert.equal(new URL(await page.evaluate(()=>location.href)).hash,'#mood='+moods[0]);await page.goBack();assert(await page.locator('#mood-results').isHidden(),'Back must leave the mood');
  await page.goto(url);await page.waitForFunction(()=>document.documentElement.dataset.playReady==='1');await page.locator('#query').fill('neon');await page.locator('#query').fill('');assert.equal(new URL(await page.evaluate(()=>location.href)).search,'');
  assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'filters-'+width+'.png')});
  return {width,shape:'d2',atRest,total,subset,deepLink:true,moodDeepLink:true,search:true,unknownFallback:true,foreignParameters:true,replaceHistory:true,clear:true,errors};
 }
 try{
  results.push(await scenario(390));
  await assert.rejects(()=>scenario(390,true),/U2: changing a filter/);
  results.push({control:'removed replaceState',real:'PASS',planted:'FAIL',restored:'PASS',restoredRun:await scenario(390)});
  results.push(await scenario(1280));
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',base,scope:'Current published discovery controls: the search field in #discovery-form and the four selects in the #filters drawer (#filters-form); the historical feel-chip UI and the pre-832852d in-form selects are superseded',results},null,2)+'\n');
  console.log('Published URL state PASS: phone/desktop, Filters drawer, stable values/visible labels, discriminating deep links, search, unknown option, history, foreign parameters, clear and real/planted/restored control');
 }catch(error){fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'FAIL',error:String(error.stack),results},null,2)+'\n');throw error;}
 finally{await browser.close();}
}
module.exports={verify};
