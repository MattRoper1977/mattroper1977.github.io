/* AS1-H H0.2: actual pilot output and a visible mutation, with no source grep. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'audit-output/as1/static-gates');
const report={scope:'Rally whole-document rendered text and visible attributes at 390px and the recorded 669px breakpoint; canvas pixels are not OCR.',before:{placeholders:0,unresolvedSourceSites:95},states:[],controls:[],errors:[]};
const server=http.createServer((req,res)=>{
  let uri;try{uri=decodeURIComponent(new URL(req.url,'http://local').pathname)}catch{res.writeHead(400);res.end();return}
  const file=path.resolve(ROOT,'.'+uri+(uri.endsWith('/')?'index.html':''));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Missing');return}
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));
});
async function main(){
  const {inspectRenderedPage,requireRenderedEvidence}=await import('../verify_no_shipped_placeholders.mjs');
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({headless:true});
    for(const width of [390,669]){
      const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'});
      try{
        const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));
        const response=await page.goto('http://127.0.0.1:'+server.address().port+'/rallyvector3d/',{waitUntil:'load'});assert(response?.ok());
        await page.waitForFunction(()=>window.MBMArcadeHooks&&window.MBMArcade&&window.RallyVector3D);
        assert.equal(await page.evaluate(()=>window.RallyVector3D.getState().webglError),0,'Pilot WebGL did not boot');
        async function inspect(label){
          await page.evaluate(()=>new Promise(requestAnimationFrame));
          const value=await inspectRenderedPage(page);requireRenderedEvidence(value);
          report.states.push({width,label,...value});return value;
        }
        async function start(){await page.evaluate(()=>{window.MBMArcade.close();window.MBMArcadeHooks.testStart()})}
        async function more(){
          // More is absent at desktop width. Open it at phone width, then restore
          // the target width, as the existing composed-panel browser proof does.
          if(width!==390)await page.setViewportSize({width:390,height:844});
          await page.locator('#as1-more').click();
          if(width!==390)await page.setViewportSize({width,height:844});
        }
        await inspect('menu');await start();await inspect('running');
        await page.locator('#as1-pause').click();await inspect('user-paused');
        await start();await more();await inspect('More');
        await page.locator('#as1-comfort').click();await inspect('Comfort');
        await page.locator('#as1-done').click();
        if(width===390)await more();await page.locator('#as1-save').click();await inspect('Save code');
        // A control reaches the same rendered document the gate actually inspects.
        const before=await inspectRenderedPage(page);
        await page.evaluate(()=>{const e=document.createElement('p');e.id='as1-h-visible-control';e.textContent='Heading';document.querySelector('#as1-shell').append(e)});
        const planted=await inspectRenderedPage(page);assert.equal(requireRenderedEvidence(planted),false);
        assert.equal(planted.findings.length,before.findings.length+1,'Visible mutation did not add a finding');
        assert(planted.findings.some(f=>f.location==='#as1-h-visible-control'&&f.token==='Heading'));
        await page.locator('#as1-h-visible-control').evaluate(e=>e.remove());
        const restored=await inspectRenderedPage(page);assert.deepEqual(restored.findings,before.findings);
        report.controls.push({width,mutation:'visible Heading in the real pilot',before:before.findings.length,planted:planted.findings.length,restored:restored.findings.length,red:true,restoration:true});
        console.log('RED '+width+' visible placeholder planted; restored '+(restored.findings.length?'RED':'GREEN'));
      }finally{await context.close()}
    }
    const unique=new Map();
    for(const state of report.states)for(const finding of state.findings){
      const key=JSON.stringify([finding.kind,finding.location,finding.token,finding.text]);
      if(!unique.has(key))unique.set(key,{...finding,owner:finding.inArcadeShell?'AS1 pilot shell':'Driving-games / Rally existing UI',states:[]});
      unique.get(key).states.push(state.width+' '+state.label);
    }
    report.findings=[...unique.values()];report.after={renderedPlaceholders:report.findings.length,observedStates:report.states.length};
    report.status=report.findings.length||report.errors.length?'RED':'GREEN';
    assert.equal(report.states.length,12,'Every specified rendered state must be inspected');
    assert.equal(report.controls.length,2,'Both viewport controls must fire');
    if(report.status!=='GREEN')process.exitCode=1;
  }catch(e){report.status='MEASUREMENT INVALID';report.error=e.stack;process.exitCode=2;console.error(e.stack)}
  finally{
    if(browser)await browser.close();await new Promise(r=>server.close(r));
    fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,'rendered-placeholder.json'),JSON.stringify(report,null,2));
    console.log('AS1_RENDERED_PLACEHOLDER '+JSON.stringify(report));
  }
}
main().catch(e=>{console.error(e);process.exitCode=2;server.close()});
