/* Three candidate thumbnail stills, one per realm, driven through the game's
   own loadZone(). Every frame is inspected for size before it is kept. */
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const srv=await new Promise(r=>{const s=http.createServer((q,res)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'/index.html':u);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});s.listen(0,'127.0.0.1',()=>r(s));});
const base=`http://127.0.0.1:${srv.address().port}/index.html`;
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.goto(base,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__fracture&&window.__fracture.snapshot().mode==='menu',null,{timeout:30000});
await page.click('#new-game-button');
await page.waitForSelector('#class-choice-grid .choice-card',{state:'visible'});
await page.click('#begin-adventure-button');
await page.waitForFunction(()=>window.__fracture.snapshot().mode==='playing',null,{timeout:30000});
fs.mkdirSync(path.join(ROOT,'thumbs'),{recursive:true});
for(const z of [0,1,2]){
  await page.evaluate(i=>window.loadZone(i),z);
  await page.waitForTimeout(5000);
  const s=await page.evaluate(()=>window.__fracture.snapshot());
  const out=path.join(ROOT,'thumbs',`thumb-realm${z+1}.png`);
  await page.screenshot({path:out});
  const b=fs.readFileSync(out);
  console.log(`thumb-realm${z+1}.png  ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}  ${b.length} bytes  — ${s.realm} ${s.realmName}`);
}
await browser.close(); srv.close();
