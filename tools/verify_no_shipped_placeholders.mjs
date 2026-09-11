#!/usr/bin/env node
/**
 * AS1-H H0.2: inspect rendered output in a browser.
 * Text nodes, displayed form values/placeholders, selected labels, broken-image
 * alternative text and the currently hovered native title are inspected.
 * IDs, classes, script source, hidden content and ARIA-only metadata are not text
 * on the screen. Title and Label are ordinary words and are not in the list.
 * A non-rendering page is inconclusive, never green. Canvas pixels are not OCR.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
export function inspectRenderedDocument(rootSelector='body'){
  const root=document.querySelector(rootSelector);
  if(!root)throw new Error('Required rendered root is absent: '+rootSelector);
  const findings=[],groups=new Map();
  let visibleTextNodes=0,visibleAttributes=0;
  const normalize=value=>String(value).normalize('NFKC').replace(/\s+/gu,' ').trim();
  const match=value=>[...normalize(value).matchAll(/(?<![\p{L}\p{N}_])(?:Lorem|TODO|TBC|Placeholder|Your text here|X{3,}|Heading)(?![\p{L}\p{N}_])/giu)];
  const describe=e=>e.id?'#'+e.id:e.tagName.toLowerCase();
  function shown(e){
    if(!e||!e.isConnected||!e.getClientRects().length)return false;
    const style=getComputedStyle(e);
    if(style.visibility==='hidden'||style.visibility==='collapse')return false;
    for(let p=e;p;p=p.parentElement||(p.getRootNode()?.host??null)){
      const s=getComputedStyle(p);if(s.display==='none'||Number(s.opacity)===0||s.contentVisibility==='hidden')return false;
      if(s.clip==='rect(0px, 0px, 0px, 0px)'||s.clipPath==='inset(50%)')return false;
    }
    return true;
  }
  function record(kind,e,value){
    for(const m of match(value))findings.push({kind,location:describe(e),token:m[0],text:normalize(value).slice(0,240),
      inArcadeShell:!!e.closest('#as1-shell')||e.id==='as1-held'});
  }
  const roots=[root];
  for(let i=0;i<roots.length;i++){
    const scope=roots[i],elements=[...(scope instanceof Element?[scope]:[]),...scope.querySelectorAll('*')];
    for(const e of elements)if(e.shadowRoot)roots.push(e.shadowRoot);
    const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode,e=node.parentElement;
      if(!e||e.closest('script,style,template,noscript,textarea,select')||!shown(e)||!normalize(node.nodeValue))continue;
      const range=document.createRange();range.selectNodeContents(node);
      if(![...range.getClientRects()].some(r=>r.width>0&&r.height>0))continue;
      visibleTextNodes++;
      let block=e;
      while(block.parentElement&&block!==root&&/^(inline|contents)$/.test(getComputedStyle(block).display))block=block.parentElement;
      const group=groups.get(block)||[];group.push(node.nodeValue);groups.set(block,group);
    }
    for(const e of elements){
      if(!shown(e))continue;
      const add=(kind,value)=>{if(value){visibleAttributes++;record(kind,e,value);}};
      if(e instanceof HTMLInputElement){
        if(!['hidden','password','checkbox','radio','range','color','file'].includes(e.type))add('displayed input value',e.value);
        if(!e.value&&['text','search','url','tel','email','password','number'].includes(e.type))add('displayed placeholder',e.placeholder);
      }else if(e instanceof HTMLTextAreaElement){add('displayed textarea value',e.value);if(!e.value)add('displayed placeholder',e.placeholder);}
      else if(e instanceof HTMLSelectElement){for(const option of e.selectedOptions)add('selected option label',option.label);}
      else if(e instanceof HTMLImageElement&&e.complete&&e.naturalWidth===0)add('rendered alternative text',e.alt);
    }
  }
  for(const [e,parts] of groups)record('rendered text',e,parts.join(''));
  const hover=[...document.querySelectorAll(':hover')].at(-1)?.closest('[title]');
  if(hover&&root.contains(hover)&&shown(hover)&&hover.title){visibleAttributes++;record('hovered native title',hover,hover.title);}
  return {root:rootSelector,visibleTextNodes,visibleAttributes,findings};
}
export async function inspectRenderedPage(page,root='body'){return page.evaluate(inspectRenderedDocument,root);}
export function requireRenderedEvidence(result){
  assert(result.visibleTextNodes+result.visibleAttributes>0,'No rendered content was observed');
  return result.findings.length===0;
}
export async function selfTest(){
  const {chromium}=require('playwright'),browser=await chromium.launch({headless:true});
  const page=await browser.newPage();const results=[];
  async function check(name,expected){
    const result=await inspectRenderedPage(page);assert(result.visibleTextNodes>0);
    assert.equal(result.findings.length,expected,name+': '+JSON.stringify(result.findings));
    results.push({name,expected,count:result.findings.length,status:expected?'RED':'GREEN'});
    console.log((expected?'RED ':'GREEN ')+name);
  }
  try{
    await page.setContent('<!doctype html><html><body><p>Title Label subHeading placeholders XXXL</p><p hidden>Heading Lorem TODO TBC Placeholder Your text here XXX</p><p style="opacity:0">TODO</p><span id="Heading" class="Placeholder" aria-label="Lorem" data-label="TODO"></span><script>const Heading="TODO";const Title="Placeholder";const Label="XXX";</script><p id="host"></p></body></html>');
    await check('identifiers, hidden content and ordinary Title/Label are allowed',0);
    for(const value of ['Heading','Lorem','TODO','TBC','Placeholder','Your text here','XXX']){
      await page.locator('#host').evaluate((e,t)=>{e.textContent=t},value);await check('visible '+value+' planted',1);
      await page.locator('#host').evaluate(e=>{e.textContent=''});await check('visible '+value+' removed',0);
    }
    await page.locator('#host').evaluate(e=>{e.innerHTML='<span>Your </span><span>text here</span>'});await check('phrase split across rendered inline nodes',1);
    await page.locator('#host').evaluate(e=>{e.innerHTML='<input placeholder="TODO">'});await check('empty input displays a placeholder',1);
    await page.locator('#host input').fill('Ready');await check('filled input does not display its placeholder',0);
    await page.locator('#host input').fill('TBC');await check('displayed form value planted',1);
    await page.locator('#host').evaluate(e=>{e.innerHTML='<select><option>Ready</option><option>TODO</option></select>'});await check('unselected option is not displayed',0);
    await page.locator('#host select').selectOption({label:'TODO'});await check('selected option label planted',1);
    await page.locator('#host').evaluate(e=>{e.innerHTML='<button title="TODO">Ready</button>'});
    await page.mouse.move(1000,700);await check('unhovered metadata is not currently displayed',0);
    await page.locator('#host button').hover();await check('hovered tooltip value planted',1);
    await page.locator('#host').evaluate(e=>{e.innerHTML=''});await check('all planted output removed',0);
    return results;
  }finally{await browser.close();}
}
async function main(){
  const args=process.argv.slice(2);if(args.length===1&&args[0]==='--self-test'){await selfTest();return;}
  assert(args.length===2&&args[0]==='--url','Use --self-test or --url with an explicit served document URL');
  const url=new URL(args[1]);assert(['http:','https:'].includes(url.protocol),'An HTTP document is required');
  const {chromium}=require('playwright'),browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage(),response=await page.goto(url.href,{waitUntil:'load'});
    assert(response?.ok(),'The requested document did not load successfully');
    const result=await inspectRenderedPage(page);const green=requireRenderedEvidence(result);
    console.log(JSON.stringify({url:url.href,status:green?'GREEN':'RED',...result},null,2));if(!green)process.exitCode=1;
  }finally{await browser.close();}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])main().catch(e=>{console.error('MEASUREMENT INVALID '+e.message);process.exitCode=2});
