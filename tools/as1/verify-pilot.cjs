/* AS1 browser evidence. Runs in the repository's Playwright CI harness.
 * Assertions read game state or rendered geometry; labels alone never prove play state.
 * Every recorded verdict has a deliberate rejected observation as its firing control.
 */
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../..');
const OUT=path.join(ROOT,'audit-output/as1');
const BASE='85e3e02059c3e3314eddab03d6e3c842f0da7ec7';
const original=execFileSync('git',['show',BASE+':rallyvector3d/index.html'],{cwd:ROOT});
const changed=fs.readFileSync(path.join(ROOT,'rallyvector3d/index.html'));
fs.mkdirSync(OUT,{recursive:true});
const report={baseline:BASE,pilot:'rallyvector3d/index.html',bytes:{before:original.length,after:changed.length,delta:changed.length-original.length},checks:[],measurements:{},errors:[]};
const server=http.createServer((req,res)=>{
  let uri;try{uri=decodeURIComponent(new URL(req.url,'http://local').pathname)}catch{res.writeHead(400);res.end();return}
  if(uri==='/baseline/rallyvector3d/'||uri==='/baseline/rallyvector3d/index.html'){res.setHeader('Content-Type','text/html');res.end(original);return}
  const file=path.resolve(ROOT,'.'+uri+(uri.endsWith('/')?'index.html':''));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Missing');return}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
});
function check(name,value,predicate,broken){
  let fired=false,pass=false,error;
  try{fired=!predicate(broken);pass=predicate(value)===true}catch(e){error=e.message}
  const row={name,status:!fired?'MEASUREMENT INVALID':pass?'PASS':'FAIL',control:fired?'mutated observation RED; original observation '+(pass?'GREEN':'RED'):'did not fire',value};
  if(error)row.error=error;report.checks.push(row);console.log('AS1_CHECK '+JSON.stringify(row));return pass&&fired;
}
function unmeasured(name,reason){const row={name,status:'UNMEASURED',reason};report.checks.push(row);console.log('AS1_CHECK '+JSON.stringify(row))}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value}
async function section(name,fn){try{await fn()}catch(e){report.checks.push({name,status:'FAIL',reason:e.stack||String(e)});console.log('AS1_SECTION_FAIL '+name+' '+e.message)}}
const state=page=>page.evaluate(()=>{if(!window.MBMArcadeHooks?.state)throw Error('Game state hook unavailable');return window.MBMArcadeHooks.state()});
async function start(page){await page.evaluate(()=>{if(!window.MBMArcadeHooks?.testStart)throw Error('Real game start hook unavailable');window.MBMArcade?.close();return window.MBMArcadeHooks.testStart()})}
async function click(page,id,name){const exact=page.locator('#'+id);if(await exact.count()&&await exact.isVisible()){await exact.click();return}await page.getByRole('button',{name,exact:true}).click()}
async function done(page){await click(page,'as1-done','Done')}
async function more(page){await click(page,'as1-more','More')}
function holding(s,kind){return s&&s.paused===true&&s.panelPaused===(kind==='panel')&&typeof s.userPaused==='boolean'}
function running(s){return s&&s.mode==='running'&&s.paused===false&&s.userPaused===false&&s.panelPaused===false}
function userPaused(s){return s&&s.paused===true&&s.userPaused===true&&s.panelPaused===false}
async function tabWalk(page,label){
  const walk=[];
  for(let i=0;i<60;i++){
    await page.keyboard.press('Tab');
    const item=await page.evaluate(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return{id:e.id,tag:e.tagName,text:(e.getAttribute('aria-label')||e.textContent||'').trim().slice(0,80),href:e.getAttribute('href'),visible:r.width>0&&r.height>0}});
    walk.push(item);if(item.id==='mbmexit-back'||item.id==='as1-exit'||/^Exit\b/.test(item.text)||/^Back: Arcade/.test(item.text))break;
  }
  const exit=walk.findIndex(x=>x.id==='mbmexit-back'||x.id==='as1-exit'||/^Exit\b/.test(x.text)||/^Back: Arcade/.test(x.text));
  const value={steps:walk,exitPosition:exit<0?null:exit+1};
  check(label,value,x=>Number.isInteger(x.exitPosition)&&x.exitPosition>0,{...value,exitPosition:null});return value;
}
async function boot(context,url){
  const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({url,error:e.message}));
  await page.addInitScript(()=>{
    window.__AS1_CLEAR_COUNT=0;
    for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){const proto=window[name]?.prototype;if(!proto)continue;const clear=proto.clear;proto.clear=function(...args){window.__AS1_CLEAR_COUNT++;return clear.apply(this,args)}}
  });
  await page.goto(url,{waitUntil:'load',timeout:90000});await page.waitForTimeout(1700);return page;
}
async function metrics(page,label){
  const a=await page.evaluate(()=>({clears:window.__AS1_CLEAR_COUNT,at:performance.now()}));await page.waitForTimeout(1800);
  const value=await page.evaluate(a=>{const rect=document.querySelector('#gl').getBoundingClientRect();return{clears:window.__AS1_CLEAR_COUNT-a.clears,elapsed:performance.now()-a.at,paintsPerSecond:(window.__AS1_CLEAR_COUNT-a.clears)*1000/(performance.now()-a.at),firstPaint:performance.getEntriesByName('first-paint')[0]?.startTime??null,firstContentfulPaint:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,canvas:{x:rect.x,y:rect.y,width:rect.width,height:rect.height,aspect:rect.width/rect.height}}},a);
  check(label+' first paint',value,x=>Number.isFinite(x.firstPaint)&&x.firstPaint>=0,{...value,firstPaint:null});
  check(label+' paint counter',value,x=>Number.isFinite(x.paintsPerSecond)&&x.paintsPerSecond>=0,{...value,paintsPerSecond:NaN});return value;
}
async function geometry(page){return page.evaluate(()=>{
  const visible=e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return r.width>0&&r.height>0&&c.display!=='none'&&c.visibility!=='hidden'};
  const ids=['mbmexit-back','as1-exit','as1-pause','as1-sound','as1-more','as1-battery','as1-comfort','as1-save'];
  return ids.flatMap(id=>{const e=document.getElementById(id);if(!e||!visible(e))return[];const r=e.getBoundingClientRect(),c=getComputedStyle(e);const text=e.querySelector('[data-label],.as1-label,.label')||e.lastElementChild||e;const range=document.createRange();range.selectNodeContents(text);const rr=range.getClientRects();return[{id,width:r.width,height:r.height,x:r.x,y:r.y,right:r.right,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,text:(e.textContent||'').trim(),whiteSpace:c.whiteSpace,textRows:[...rr].filter(r=>r.width>1&&r.height>1).map(r=>({y:r.y,height:r.height,width:r.width}))}]});
})}
async function contrast(page){return page.evaluate(()=>{
  const rgb=s=>{const m=s.match(/^rgba?\(([^)]+)\)$/);if(!m)return null;const a=m[1].split(/[, /]+/).filter(Boolean).map(Number);return[a[0],a[1],a[2],a.length>3?a[3]:1]};
  const blend=(fg,bg)=>{const a=fg[3]+bg[3]*(1-fg[3]);return[(fg[0]*fg[3]+bg[0]*bg[3]*(1-fg[3]))/a,(fg[1]*fg[3]+bg[1]*bg[3]*(1-fg[3]))/a,(fg[2]*fg[3]+bg[2]*bg[3]*(1-fg[3]))/a,a]};
  const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const out=[];
  for(const e of document.querySelectorAll('#as1-shell *')){
    if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
    const r=e.getBoundingClientRect(),c=getComputedStyle(e);if(!r.width||!r.height||c.visibility==='hidden'||c.display==='none')continue;
    let bg=[255,255,255,1],chain=[],unsupported=[];for(let p=e;p;p=p.parentElement)chain.push(p);
    for(const p of chain.reverse()){const cs=getComputedStyle(p);if(cs.backgroundImage!=='none')unsupported.push(p.id||p.tagName);const colour=rgb(cs.backgroundColor);if(colour)bg=blend(colour,bg)}
    const colour=rgb(c.color);if(!colour)continue;const fg=blend(colour,bg),a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05),size=parseFloat(c.fontSize),bold=parseInt(c.fontWeight,10)>=700;
    out.push({id:e.id||((e.closest('[id]')?.id||'')+' '+e.tagName),text:e.textContent.trim().slice(0,90),ratio,required:size>=24||(bold&&size>=18.66)?3:4.5,foreground:fg,background:bg,unsupported,disabled:!!e.closest(':disabled')});
  }
  return out;
})}
async function authority(page){return page.evaluate(async()=>{const value=await window.MBMArcadeHooks.serialize();return{save:{format:value.format,version:value.version,localStorage:value.localStorage,sharedProfiles:value.sharedProfiles,touchline:value.touchline},pose:window.MBMArcadeHooks.state().pose,localStorage:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))}})}
async function placeholderMarkup(page,label){
  const inspect=()=>{const bad=[],rx=/\b(?:Heading|Title|Label|Lorem|TODO|TBC|Placeholder|Your text here|X{3,})\b/i;const root=document.getElementById('as1-shell'),walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walk.nextNode()){const n=walk.currentNode,e=n.parentElement,r=e.getBoundingClientRect();if(r.width&&r.height&&getComputedStyle(e).visibility!=='hidden'&&rx.test(n.textContent))bad.push(n.textContent.trim())}return bad};
  const original=await page.evaluate(inspect);
  await page.evaluate(()=>{const e=document.createElement('span');e.id='as1-placeholder-control';e.textContent='Heading';document.getElementById('as1-shell').append(e)});
  const planted=await page.evaluate(inspect);await page.locator('#as1-placeholder-control').evaluate(e=>e.remove());const restored=await page.evaluate(inspect);
  const value={original,planted,restored};check(label+' composed placeholder control',value,x=>x.original.length===0&&x.planted.includes('Heading')&&x.restored.length===0,{...value,planted:[]});
  const markup=await page.locator('#as1-shell').evaluate(e=>e.outerHTML);fs.writeFileSync(path.join(OUT,label.replace(/[^a-z0-9]+/gi,'-')+'-composed.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><title>Arcade inspection</title><body>'+markup+'</body></html>');
}
async function main(){
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  let page,context;
  try{
    await section('baseline',async()=>{const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const p=await boot(c,origin+'/baseline/rallyvector3d/');report.measurements.baseline=await metrics(p,'baseline');report.measurements.baselineTab=await tabWalk(p,'baseline Tab walk');await c.close()});
    context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});page=await boot(context,origin+'/rallyvector3d/');
    await section('pilot boot',async()=>{const hook=await page.evaluate(()=>({hooks:!!window.MBMArcadeHooks,host:!!window.MBMArcade,webgl:window.RallyVector3D?.getState().webglError}));check('pilot hook and WebGL',hook,x=>x.hooks&&x.host&&x.webgl===0,{...hook,hooks:false});report.measurements.pilot=await metrics(page,'pilot');check('idle title draws zero frames',report.measurements.pilot,x=>x.clears===0,{...report.measurements.pilot,clears:1});report.measurements.pilotTab=await tabWalk(page,'pilot Tab walk');});
    await section('three state sequences',async()=>{
      const sequences=[];
      for(const variant of ['running','user-paused','comfort']){
        await start(page);const steps=[{action:'start',state:await state(page)}];
        check(variant+' starts RUNNING',steps[0].state,running,{...steps[0].state,paused:true});
        if(variant==='user-paused'){await click(page,'as1-pause','Pause');const s=await state(page);steps.push({action:'Pause',state:s});check('Pause changes game state by value',s,userPaused,{...s,paused:false})}
        await more(page);const held=await state(page);steps.push({action:'open More',state:held});check(variant+' More holds game',held,s=>holding(s,'panel'),{...held,paused:false});
        const affordance=await page.locator('#as1-held').evaluate(e=>({text:e.textContent,hidden:e.hidden,background:getComputedStyle(e).backgroundColor}));check(variant+' Paused affordance',affordance,x=>x.text==='Paused'&&!x.hidden&&x.background!=='rgba(0, 0, 0, 0)',{...affordance,text:''});
        const button=await page.locator('#as1-pause').isDisabled();check(variant+' Pause disabled in panel',button,x=>x===true,false);
        const before=await state(page);await page.evaluate(()=>window.MBMArcadeHooks.testStep(12));const after=await state(page);
        check(variant+' held physics does not move',JSON.stringify(after.pose),x=>x===JSON.stringify(before.pose),JSON.stringify({wrong:'moved'}));
        if(variant==='comfort'){await click(page,'as1-comfort','Comfort');steps.push({action:'Comfort',state:await state(page)});await click(page,'as1-back','Back');steps.push({action:'back',state:await state(page)})}
        await done(page);const s=await state(page);steps.push({action:'close',state:s});check(variant+' returns to '+(variant==='user-paused'?'USER-PAUSED':'RUNNING'),s,variant==='user-paused'?userPaused:running,{...s,paused:!s.paused});sequences.push({variant,steps});
      }
      report.measurements.stateSequences=sequences;
    });
    await section('bar and reserved band',async()=>{
      await start(page);await page.setViewportSize({width:390,height:844});const phone=await geometry(page);report.measurements.phone=phone;
      const phoneIds=phone.map(x=>x.id);check('phone four controls',phoneIds,x=>x.length===4&&x.includes('as1-more')&&x.includes('as1-pause')&&x.includes('as1-sound'),phoneIds.slice(1));
      check('phone targets at least 44px',phone,x=>x.length===4&&x.every(r=>r.width>=44&&r.height>=44&&r.scrollWidth<=r.clientWidth+1),phone.map((r,i)=>i? r:{...r,width:43}));
      await click(page,'as1-pause','Pause');const active=await geometry(page);check('phone active targets at least 44px',active,x=>x.length===4&&x.every(r=>r.width>=44&&r.height>=44),active.map((r,i)=>i?r:{...r,height:43}));await click(page,'as1-pause','Pause');
      let breakpoint=null,boundary;
      const fits=g=>g.length===6&&!g.some(x=>x.id==='as1-more')&&g.every(x=>x.width>=44&&x.height>=44&&x.scrollWidth<=x.clientWidth+1&&x.textRows.length<=1);
      let low=391,high=1400;while(low<high){const width=Math.floor((low+high)/2);await page.setViewportSize({width,height:844});if(fits(await geometry(page)))high=width;else low=width+1}
      await page.setViewportSize({width:low,height:844});const g=await geometry(page);if(fits(g)){breakpoint=low;boundary=g;await page.setViewportSize({width:low-1,height:844});const narrower=await geometry(page);check('one pixel below breakpoint does not fit six',narrower,x=>!fits(x),g)}
      report.measurements.breakpoint={width:breakpoint,controls:boundary};check('measured six-control breakpoint',report.measurements.breakpoint,x=>Number.isInteger(x.width)&&x.controls.length===6,{width:null,controls:[]});
      await page.setViewportSize({width:390,height:844});const band=await page.evaluate(()=>{const canvas=document.querySelector('#gl').getBoundingClientRect(),bar=document.querySelector('#as1-bar').getBoundingClientRect();return{canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height,aspect:canvas.width/canvas.height},bar:{x:bar.x,y:bar.y,width:bar.width,height:bar.height,bottom:bar.bottom}}});
      report.measurements.reservedBand={before:report.measurements.baseline?.canvas,after:band};check('reserved band does not overlap canvas',band,x=>x.canvas.y>=x.bar.bottom-.5&&x.bar.height>=44,{...band,canvas:{...band.canvas,y:0}});
      await page.screenshot({path:path.join(OUT,'phone-running.png')});
    });
    await section('greyscale and composed contrast',async()=>{
      const widths=[390,report.measurements.breakpoint?.width].filter(Number.isFinite);const census=[];
      for(const width of [...new Set(widths)]){
        await page.setViewportSize({width,height:844});await start(page);
        for(const panel of ['bar','more','comfort','save']){
          if(panel==='more'){if(width===390)await more(page);else continue}
          if(panel==='comfort'){if(width===390){if(await page.locator('#as1-panel-title').isVisible())await done(page);await more(page)}await click(page,'as1-comfort','Comfort')}
          if(panel==='save'){await done(page);if(width===390)await more(page);await click(page,'as1-save','Save code')}
          const values=await contrast(page);const eligible=values.filter(x=>!x.disabled&&!x.unsupported.length);census.push({width,panel,values});
          await placeholderMarkup(page,width+'-'+panel);
          check(width+' '+panel+' contrast',eligible,x=>x.length>0&&x.every(v=>v.ratio+0.01>=v.required),eligible.map((v,i)=>i?v:{...v,ratio:1}));
          if(values.some(x=>x.unsupported.length))unmeasured(width+' '+panel+' gradient-backed contrast','Computed solid-alpha compositing cannot certify gradient or image backgrounds: '+values.filter(x=>x.unsupported.length).map(x=>x.id).join(','));
          await page.screenshot({path:path.join(OUT,`${width}-${panel}.png`)});
        }
        await done(page);
      }
      report.measurements.contrast=census;await page.setViewportSize({width:390,height:844});await start(page);
      const inactive=await page.locator('#as1-more').evaluate(e=>{const c=getComputedStyle(e);return{background:c.backgroundColor,border:c.borderColor}});await more(page);
      const greyStyle=await page.addStyleTag({content:'html{filter:grayscale(1)!important}'});await page.screenshot({path:path.join(OUT,'phone-more-greyscale.png')});
      const cue=await page.evaluate(()=>{const e=document.querySelector('#as1-more'),c=getComputedStyle(e);return{pressed:e.getAttribute('aria-pressed'),expanded:e.getAttribute('aria-expanded'),text:e.textContent,border:c.borderStyle,borderWidth:c.borderWidth,borderColour:c.borderColor,background:c.backgroundColor,after:getComputedStyle(e,'::after').content,html:e.innerHTML}});cue.inactive=inactive;
      const grey=c=>{const v=(c.match(/[\d.]+/g)||[]).map(Number);return(v[0]||0)*.2126+(v[1]||0)*.7152+(v[2]||0)*.0722};
      report.measurements.greyscale=cue;check('More has non-colour active cue',cue,x=>(x.pressed==='true'||x.expanded==='true')&&Math.abs(grey(x.background)-grey(x.inactive.background))>=60&&parseFloat(x.borderWidth)>=2&&!x.borderColour.endsWith(', 0)'),{...cue,background:inactive.background,borderColour:'rgba(0, 0, 0, 0)'});
      const duplicate=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return [...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))]});check('zero duplicate ids',duplicate,x=>x.length===0,['as1-more']);await greyStyle.evaluate(e=>e.remove());await done(page);
    });
    await section('save paste controls',async()=>{
      await page.setViewportSize({width:390,height:844});await start(page);await more(page);await click(page,'as1-save','Save code');
      const box=page.locator('#as1-code');const valid=await page.evaluate(async()=>window.MBMCartridge.encode(window.MBMArcadeHooks.serialize()));check('real save encodes',valid,x=>typeof x==='string'&&x.length>8,'');
      const originalState=await authority(page);const restored=[];
      const forms={hyphens:valid,enDashes:valid.replace(/-/g,'\u2013'),spaces:valid.split('-').map(g=>' \u00a0'+g+' \t').join('-'),lowercase:valid.toLowerCase()};
      for(const [name,code] of Object.entries(forms)){await box.fill(code);await click(page,'as1-restore','Restore code');await page.waitForTimeout(80);const value=await authority(page);restored.push({name,length:code.length,state:value});check('paste '+name+' restores identically',JSON.stringify(stable(value.save)),x=>x===JSON.stringify(stable(originalState.save)),JSON.stringify({wrong:'restore'}))}
      const index=[...valid].findIndex((c,i)=>i>5&&/[A-Z0-9]/i.test(c));if(index<0)throw Error('No payload character to corrupt');const bad=valid.slice(0,index)+(valid[index]==='A'?'B':'A')+valid.slice(index+1);
      await box.fill(bad);const before=await authority(page);await click(page,'as1-restore','Restore code');await page.waitForTimeout(100);const after=await authority(page),text=await box.inputValue();const line=await page.locator('#as1-status').textContent();
      const observation={unchanged:JSON.stringify(before)===JSON.stringify(after),textRetained:text===bad,error:line};check('wrong character refused without lost state',observation,x=>x.unchanged&&x.textRetained&&!!x.error,{...observation,unchanged:false});
      if(!observation.unchanged)report.hardStop='G-S3: wrong-character restore changed existing pupil state';report.measurements.paste={forms:restored.map(x=>({name:x.name,length:x.length})),wrongCharacter:observation,realSaveBytes:Buffer.byteLength(JSON.stringify(originalState.save)),encodedLength:valid.length};
      const sizing=await box.evaluate(e=>{const s=getComputedStyle(e),c=document.createElement('canvas').getContext('2d');c.font=s.font;const width=e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),character=c.measureText('A').width,group=c.measureText('AAAAA-').width,groups=Math.floor(width/group);return{availableWidth:width,characterWidth:character,groupWidth:group,groupsPerLine:groups,lineHeight:parseFloat(s.lineHeight),paper:Math.max(0,groups*6*4-1),basis:'four fully visible monospace lines at 390px; readability fit, not a human transcription study'}});
      check('paper size proposed from rendered text',sizing,x=>x.groupsPerLine>0&&x.paper>0&&x.groupWidth*x.groupsPerLine<=x.availableWidth,{...sizing,groupsPerLine:0});
      await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(Error('AS1 clipboard API disabled'))}}));
      const candidate='A'.repeat(16000);await box.fill(candidate);await click(page,'as1-copy','Copy');
      const selection=await box.evaluate(e=>({length:e.value.length,selected:e.selectionEnd-e.selectionStart,unchanged:e.value==='A'.repeat(16000)}));check('16000-character non-clipboard fallback',selection,x=>x.length===16000&&x.selected===16000&&x.unchanged,{...selection,selected:0});
      report.measurements.thresholdProposal={...sizing,clipboard:16000,fileAbove:16000,clipboardProof:selection,qrCap:2000};
      const configured=await page.evaluate(()=>{try{return window.MBMArcadeHooks.thresholds()}catch(e){return{unconfigured:e.message}}});
      if(configured.unconfigured)unmeasured('configured size thresholds',configured.unconfigured);else{await click(page,'as1-get-save','Get save code');await page.waitForTimeout(120);report.measurements.thresholdsConfigured=configured;const supplied=await box.inputValue(),decoded=await page.evaluate(code=>window.MBMCartridge.decode(code),supplied);check('Get save code uses measured classes',{length:supplied.length,configured,restores:JSON.stringify(stable(decoded.localStorage))===JSON.stringify(stable(originalState.save.localStorage))},x=>x.length>0&&x.restores&&x.configured.measured===true,{length:0,configured,restores:false})}
      await done(page);
    });
    if(report.hardStop)throw Error(report.hardStop);
    await section('comfort frame cost and spectrum',async()=>{
      await start(page);await more(page);await click(page,'as1-comfort','Comfort');const warm=page.getByRole('button',{name:'Warm screen',exact:true});
      const defaults=await warm.getAttribute('aria-pressed');check('Warm screen off by default',defaults,x=>x==='false','true');await done(page);
      const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:6});const fps=[];
      for(const on of [false,true]){
        await more(page);await click(page,'as1-comfort','Comfort');if((await warm.getAttribute('aria-pressed')==='true')!==on)await warm.click();await done(page);
        await page.evaluate(()=>{window.RallyVector3D.returnToMenu()});await page.locator('#startBtn').click();await page.evaluate(()=>{window.__RV.skipCountdown();window.__RV.autopilot(true)});
        const first=await state(page),at=Date.now();await page.waitForTimeout(1800);const last=await state(page);fps.push({overlay:on,elapsedMs:Date.now()-at,frames:last.renderCount-first.renderCount,fps:(last.renderCount-first.renderCount)*1000/(Date.now()-at),physics:last.physicsCount-first.physicsCount});
      }
      await session.send('Emulation.setCPUThrottlingRate',{rate:1});report.measurements.comfortFPS={profile:'Chromium software WebGL; CDP CPU throttling 6x; 390x844',samples:fps};check('comfort frame counter observes rendering',fps,x=>x.length===2&&x.every(v=>Number.isFinite(v.fps)&&v.fps>0),fps.map(x=>({...x,fps:0})));
      await more(page);await click(page,'as1-comfort','Comfort');const soft=page.getByRole('button',{name:'Soften sound',exact:true});if(await soft.getAttribute('aria-pressed')!=='true')await soft.click();
      const graph=await page.evaluate(()=>{const g=window.MBMArcadeHooks.audioGraph?.();if(!g?.filter)return null;const f=new Float32Array([100,500,1000,3500,7000,12000]),m=new Float32Array(f.length),phase=new Float32Array(f.length);g.filter.getFrequencyResponse(f,m,phase);return{type:g.filter.type,frequency:g.filter.frequency.value,hz:[...f],gain:[...m],contextState:g.ctx?.state}});
      if(!graph)unmeasured('sound output spectrum','Pilot did not expose its actual master low-pass graph');else{report.measurements.filterResponse=graph;check('actual low-pass frequency response',graph,x=>x.type==='lowpass'&&x.gain[0]>.9&&x.gain[1]>.9&&x.gain[2]>.8&&x.gain[4]<.5&&x.gain[5]<.2,{...graph,gain:graph.gain.map(()=>1)});unmeasured('recorded sound output spectrum','Actual graph transfer function measured; a recorded in/out game output spectrum is still required')}
      const mic=changed.toString().includes('getUserMedia');report.measurements.microphone=mic?'source call present; permission denied run required':'not present on the pilot';if(mic)unmeasured('microphone denied permission','Pilot contains getUserMedia; this harness has not proven its denied path');else check('microphone absent from pilot source',mic,x=>x===false,true);await done(page);
    });
    await section('existing playability checks',async()=>{const result=await page.evaluate(async()=>window.RallyVector3D.runSelfTests());report.measurements.selfTests=result;check('existing Rally self tests',result,x=>x.pass===true&&x.results.length>0&&x.results.every(r=>r.pass),{...result,pass:false});});
    await section('ghost real run',async()=>{
      if(report.hardStop){unmeasured('ghost proof','Stopped after state loss control');return}
      await start(page);const available=await page.evaluate(()=>({samples:typeof window.MBMArcadeHooks.ghostSamples==='function',bounds:typeof window.MBMArcadeHooks.ghostBounds==='function',link:typeof window.MBMArcadeHooks.ghostLink==='function'}));
      if(!available.samples||!available.bounds||!available.link){unmeasured('ghost real run','Geometry recording, map bounds, and link hooks are not all available');return}
      const lengths=[];let lastObserved;
      for(const seconds of [15,45,90]){
        await page.evaluate(n=>{window.__RV.autopilot(true);window.MBMArcadeHooks.testStep(n)},(seconds-(lengths.at(-1)?.seconds||0))*60);
        const observed=await page.evaluate(async()=>({samples:window.MBMArcadeHooks.ghostSamples(),bounds:window.MBMArcadeHooks.ghostBounds(),link:await window.MBMArcadeHooks.ghostLink(),state:window.MBMArcadeHooks.state()}));lastObserved=observed;
        lengths.push({seconds,length:observed.link.length,encodedLength:observed.link.split('#ghost=')[1].length,samples:observed.samples.length,last:observed.samples.at(-1),link:observed.link,bounds:observed.bounds});
        const sample={samples:observed.samples.length,physicsCount:observed.state.physicsCount,linkLength:observed.link.length,form:observed.link.includes('#ghost=')};
        check(seconds+'s geometry recording',sample,x=>x.samples===seconds*10&&x.physicsCount>=seconds*60&&x.form,{...sample,samples:0});
      }
      report.measurements.ghost={runs:lengths};fs.writeFileSync(path.join(OUT,'ghost-runs.json'),JSON.stringify({runs:lengths,recordedSamples:lastObserved.samples},null,2));
      const textControl=await page.evaluate(async()=>{const h=window.MBMArcadeHooks,s=h.ghostSamples();try{await window.MBMGhost.encode([{...s[0],name:'Unwanted free text'}],h.ghostBounds());return false}catch{return true}});check('ghost rejects free text payload field',textControl,x=>x===true,false);
      const clean=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
      try{
        const playback=await boot(clean,lastObserved.link);await playback.waitForFunction(()=>window.MBMArcadeHooks?.ghostRendered()!==null,undefined,{timeout:12000});await start(playback);
        const bounds=lastObserved.bounds,samples=lastObserved.samples,axes=['x','y','z'],tolerance=Object.fromEntries(axes.map(a=>[a,(bounds['max'+a]-bounds['min'+a])/131070+1e-6]));tolerance.heading=Math.PI/256+1e-6;
        const comparisons=[];
        for(const index of [...new Set([0,Math.floor(samples.length/4),Math.floor(samples.length/2),samples.length-1])]){
          const rendered=await playback.evaluate(t=>window.MBMArcadeHooks.ghostAt(t),(index+1)/10),expected=samples[index];
          const error={};for(const a of axes)error[a]=Math.abs(rendered[a]-expected[a]);error.heading=Math.abs(Math.atan2(Math.sin(rendered.heading-expected.angle),Math.cos(rendered.heading-expected.angle)));comparisons.push({index,time:(index+1)/10,expected,rendered,error});
        }
        const observation={tolerance,comparisons};report.measurements.ghost.playback=observation;
        check('clean-profile rendered path matches recorded geometry',observation,x=>x.comparisons.length>=4&&x.comparisons.every(r=>[...axes,'heading'].every(a=>r.error[a]<=x.tolerance[a])),{...observation,comparisons:comparisons.map((r,i)=>i?r:{...r,error:{...r.error,x:tolerance.x+1}})});
        await playback.screenshot({path:path.join(OUT,'clean-profile-ghost.png')});
      }finally{await clean.close()}
      const corrupted=await page.evaluate(link=>{const url=new URL(link),bytes=window.MBMCartridge.unbase64(url.hash.slice(7));bytes[6]^=1;url.hash='ghost='+window.MBMCartridge.base64(bytes);return url.href},lastObserved.link);
      const badContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
      try{
        const broken=await boot(badContext,corrupted);await start(broken);const before=await state(broken);await broken.evaluate(()=>{window.RallyVector3D.setInput({throttle:1});window.MBMArcadeHooks.testStep(60)});const after=await state(broken),ghost=await broken.evaluate(()=>window.MBMArcadeHooks.ghostRendered());
        const observation={ghost,mode:after.mode,paused:after.paused,moved:Math.hypot(after.pose.x-before.pose.x,after.pose.z-before.pose.z)>0.01};report.measurements.ghost.corruption=observation;
        check('one-byte corrupt ghost fails cleanly; race still drives',observation,x=>x.ghost===null&&x.mode==='running'&&!x.paused&&x.moved,{...observation,ghost:{x:0,y:0,z:0}});
      }finally{await badContext.close()}
      unmeasured('chat client paste','No link-shortening chat client round trip was performed');
    });
    await section('one-tap exit in every shell state',async()=>{
      const exits=[];
      for(const mode of ['running','user-paused','more','comfort','save']){
        const c=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
        try{
          const p=await boot(c,origin+'/rallyvector3d/');await start(p);if(mode==='user-paused')await click(p,'as1-pause','Pause');if(['more','comfort','save'].includes(mode))await more(p);if(mode==='comfort')await click(p,'as1-comfort','Comfort');if(mode==='save')await click(p,'as1-save','Save code');
          const walk=await tabWalk(p,mode+' Exit Tab walk'),exit=p.locator('#mbmexit-back'),href=await exit.getAttribute('href'),expected=new URL(href,p.url()).href,dialogs=[];p.on('dialog',async d=>{dialogs.push(d.type());await d.dismiss()});
          await Promise.all([p.waitForURL(expected,{timeout:15000}),exit.click()]);const observation={mode,href,url:p.url(),expected,dialogs,tabPosition:walk.exitPosition};exits.push(observation);
          check(mode+' one-tap Exit',observation,x=>x.url===x.expected&&x.dialogs.length===0&&x.tabPosition>0,{...observation,dialogs:['confirm']});
        }finally{await c.close()}
      }
      report.measurements.exitStates=exits;
    });
  }finally{if(context)await context.close();await browser.close();await new Promise(r=>server.close(r));}
  report.status=report.checks.some(c=>c.status==='FAIL'||c.status==='MEASUREMENT INVALID')?'FAIL':report.checks.some(c=>c.status==='UNMEASURED')?'PARTIAL':'PASS';fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify(report,null,2));console.log('AS1_RESULT '+JSON.stringify(report));if(report.status==='FAIL')process.exitCode=1;
}
main().catch(e=>{report.fatal=e.stack;fs.writeFileSync(path.join(OUT,'verification.json'),JSON.stringify(report,null,2));console.error(e);server.close();process.exitCode=1});
