'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');

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
  try{
   await page.goto(url,{waitUntil:'load'});await ready();
   const atRest=await shown();assert(atRest>1,'Published shelf did not render');assert.equal(new URL(page.url()).search,'');
   const choices=await page.locator('#discovery-form select').evaluateAll(selects=>selects.flatMap(s=>Array.from(s.options).filter(o=>o.value).map(o=>({field:s.name,value:o.value,label:o.textContent.trim()}))));
   const choice=choices.find(x=>x.value!==x.label && !['list','mode'].includes(x.field));
   assert(choice,'No stable value/display-label pair could be measured');
   const select=page.locator('#discovery-form select[name="'+choice.field+'"]');
   await select.selectOption(choice.value);assert.equal((await params()).get(choice.field),choice.value,'U2: changing a filter must write its stable value to the URL');
   const subset=await shown();assert(subset>0&&subset<atRest,'Filter must change actual card membership');
   assert.equal((await select.locator('option:checked').innerText()).trim(),choice.label,'The visible selected control must retain its label');
   const filtered=page.url();await page.goto(filtered);await ready();assert.equal(await select.inputValue(),choice.value);assert.equal(await shown(),subset);
   const other=choices.find(x=>x.field===choice.field&&x.value!==choice.value);assert(other,'A discriminating second filter is required');
   const second=new URL(url);second.searchParams.set(other.field,other.value);await page.goto(second.href);await ready();assert.equal(await select.inputValue(),other.value,'Deep links must track their value, not always restore one facet');
   const unknown=new URL(url);unknown.searchParams.set(choice.field,'not-a-real-option-hc3');await page.goto(unknown.href);await ready();assert.equal(await select.inputValue(),'');assert.equal(await shown(),atRest);assert(await page.locator('#empty-state').isHidden());
   await page.goto(url+'?q=neon&hc3_keep=one');await ready();assert.equal(await page.locator('#query').inputValue(),'neon');assert(await shown()>0&&await shown()<atRest);
   const before=await page.evaluate(()=>history.length);await page.locator('#query').fill('');await select.selectOption(choice.value);
   assert.equal((await params()).get('hc3_keep'),'one');assert.equal(await page.evaluate(()=>history.length),before,'Typing/selecting must replace history');
   await select.selectOption('');assert.equal((await params()).get(choice.field),null);assert.equal((await params()).get('q'),null);assert.equal((await params()).get('hc3_keep'),'one');
   await page.goto(url);await ready();await page.locator('#query').fill('neon');await page.locator('#query').fill('');assert.equal(new URL(page.url()).search,'');
   assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'filters-'+width+'.png')});
   return {width,atRest,choice,subset,deepLink:true,search:true,unknownFallback:true,foreignParameters:true,replaceHistory:true,clear:true,errors};
  }finally{await context.close();}
 }
 try{
  results.push(await scenario(390));
  await assert.rejects(()=>scenario(390,true),/U2: changing a filter/);
  results.push({control:'removed replaceState',real:'PASS',planted:'FAIL',restored:'PASS',restoredRun:await scenario(390)});
  results.push(await scenario(1280));
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',base,scope:'Current published discovery controls; historical feel-chip UI is superseded',results},null,2)+'\n');
  console.log('Published URL state PASS: phone/desktop, stable values/visible labels, discriminating deep links, search, unknown option, history, foreign parameters, clear and real/planted/restored control');
 }catch(error){fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'FAIL',error:String(error.stack),results},null,2)+'\n');throw error;}
 finally{await browser.close();}
}
module.exports={verify};
