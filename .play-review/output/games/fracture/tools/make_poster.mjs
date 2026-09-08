/* Captures a real in-game frame for the homepage/shelf poster. A still is a
   frame-quality question, not a frame-rate one, so software rasterisation is
   survivable here in a way 60fps video capture is not. Every frame is
   inspected before it is kept. */
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server = await new Promise(r=>{const s=http.createServer((q,res)=>{const u=decodeURIComponent(q.url.split('?')[0]);const f=path.join(ROOT,u==='/'?'/index.html':u);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});s.listen(0,'127.0.0.1',()=>r(s));});
const base=`http://127.0.0.1:${server.address().port}/index.html`;
const browser=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1200,height:630}});
await page.goto(base,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__fracture&&window.__fracture.snapshot().mode==='menu',null,{timeout:20000});
await page.click('#new-game-button');
await page.waitForSelector('#class-choice-grid .choice-card',{state:'visible'});
await page.click('#begin-adventure-button');
await page.waitForFunction(()=>window.__fracture.snapshot().mode==='playing',null,{timeout:20000});
await page.waitForTimeout(6000);            /* let the world settle and the HUD populate */
const snap=await page.evaluate(()=>window.__fracture.snapshot());
await page.screenshot({path:path.join(ROOT,'poster.png')});
const b=fs.readFileSync(path.join(ROOT,'poster.png'));
console.log(`poster.png ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}, ${b.length} bytes`);
console.log('captured state:',JSON.stringify({realm:snap.realmName,mode:snap.mode,hp:snap.hero.hp,effects:snap.activeEffects}));
await browser.close(); server.close();
