#!/usr/bin/env node
/* Recapture the reviewed game screens for routes whose published bytes changed.
 *
 *   PLAY_REVIEW_URL=http://127.0.0.1:4173 node tools/capture_play_screens.cjs --output <built games dir> --routes=/a/,/b/
 *
 * A screen in domain-split/play/screens is byte-bound to the payload it was captured from
 * (screens/manifest.json: sha256 of the JPEG, published_sha256 of the payload). When a
 * payload changes, the screen is captured again from the served built route rather than
 * re-bound: 1280x720, fresh context, ?splash=skip so the game's own first screen is what
 * is shown, three seconds of settle, JPEG quality 82. The manifest entry keeps its file
 * name and caption and takes the new digests. Nothing is captured for a route that has no
 * manifest entry. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const arg=n=>{const h=process.argv.find(v=>v.startsWith(`--${n}=`));return h?h.slice(n.length+3):null;};
const base=process.env.PLAY_REVIEW_URL||'http://127.0.0.1:4173';
const built=path.resolve(arg('output')||'.play-review/output/games');
const routes=(arg('routes')||'').split(',').filter(Boolean);
const dir=path.resolve(__dirname,'..','domain-split','play','screens');
const manifestPath=path.join(dir,'manifest.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const key=r=>decodeURIComponent(r).replace(/\/index\.html$/,'').replace(/\/$/,'')||'/';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const done=[];
 for(const route of routes){
  const entry=manifest.screens.find(s=>key(s.route)===key(route));
  if(!entry){console.log(`skip ${route}: no manifest entry`);continue;}
  const payload=path.join(built,route.replace(/^\//,''),route.endsWith('/')?'index.html':'');
  const published=sha(fs.readFileSync(payload));
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await context.newPage();
  await page.goto(base+encodeURI(route)+(route.includes('?')?'&':'?')+'splash=skip',{waitUntil:'load',timeout:60000});
  await page.waitForTimeout(3000);
  const jpeg=await page.screenshot({type:'jpeg',quality:82,fullPage:false});
  await context.close();
  fs.writeFileSync(path.join(dir,entry.file),jpeg);
  entry.sha256=sha(jpeg);entry.published_sha256=published;entry.status='reviewed';
  done.push({route,file:entry.file,bytes:jpeg.length,sha256:entry.sha256,published_sha256:published});
  console.log(JSON.stringify(done[done.length-1]));
 }
 await browser.close();
 fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 console.log(`${done.length} screen(s) recaptured; manifest rewritten`);
})().catch(e=>{console.error(e);process.exit(1);});
