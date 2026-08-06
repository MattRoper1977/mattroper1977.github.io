/* Measures whether a trailer capture is achievable here, rather than assuming.
   Two routes are timed:
     A  real-time screencast — what Playwright video/CDP would record
     B  deterministic-clock offline render: drive rAF by hand at a fixed
        1/60 step and screenshot each frame, then encode at 60fps. Slow to
        capture, but every frame is a true 60fps frame.
   Frames are inspected, not assumed: a frame that is uniformly one colour is
   a blank render and is counted as such. */
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const srv=await new Promise(r=>{const s=http.createServer((q,res)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'/index.html':u);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});s.listen(0,'127.0.0.1',()=>r(s));});
const base=`http://127.0.0.1:${srv.address().port}/index.html`;
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});
await page.goto(base,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__fracture&&window.__fracture.snapshot().mode==='menu',null,{timeout:30000});
await page.click('#new-game-button');
await page.waitForSelector('#class-choice-grid .choice-card',{state:'visible'});
await page.click('#begin-adventure-button');
await page.waitForFunction(()=>window.__fracture.snapshot().mode==='playing',null,{timeout:30000});

// Route A: real-time rate at 1920x1080
await page.evaluate(()=>{window.__f=0;const t=()=>{window.__f++;requestAnimationFrame(t)};requestAnimationFrame(t)});
const t0=Date.now(); await page.waitForTimeout(6000);
const realtimeFps=await page.evaluate(()=>window.__f)/((Date.now()-t0)/1000);
console.log(`ROUTE A real-time render at 1920x1080: ${realtimeFps.toFixed(2)} fps`);

// Route B: deterministic offline render, time 30 frames incl. screenshot
fs.mkdirSync('/tmp/capframes',{recursive:true});
await page.evaluate(()=>{let t=performance.now();const step=1000/60;const cbs=[];
  window.requestAnimationFrame=cb=>{cbs.push(cb);return cbs.length};
  const realNow=performance.now.bind(performance); window.performance.now=()=>t;
  window.__step=()=>{t+=step;const due=cbs.splice(0,cbs.length);due.forEach(cb=>cb(t))};});
const N=30; const s0=Date.now(); let blank=0;
for(let i=0;i<N;i++){ await page.evaluate(()=>window.__step()); const buf=await page.screenshot({type:'jpeg',quality:80}); fs.writeFileSync(`/tmp/capframes/f${String(i).padStart(4,'0')}.jpg`,buf); if(buf.length<9000) blank++; }
const perFrame=(Date.now()-s0)/N;
console.log(`ROUTE B deterministic capture: ${perFrame.toFixed(0)} ms/frame, ${blank}/${N} suspiciously blank`);
console.log(`  -> a 60s 60fps trailer = 3600 frames = ${(3600*perFrame/60000).toFixed(1)} minutes of capture`);
console.log(`  -> a 30s 30fps reel    =  900 frames = ${(900*perFrame/60000).toFixed(1)} minutes of capture`);
await browser.close(); srv.close();
