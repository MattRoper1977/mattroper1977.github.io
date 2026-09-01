// Shared harness for TFR2 gates. Serves one directory on 127.0.0.1 and gives
// a Chromium context with coarse-pointer emulation and every off-page request
// blocked and counted.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

export function serve(dir){
  return new Promise((resolve)=>{
    const server=http.createServer((req,res)=>{
      const u=new URL(req.url,'http://127.0.0.1');
      let p=path.join(dir,decodeURIComponent(u.pathname));
      if(p.endsWith('/'))p+='index.html';
      if(!fs.existsSync(p)){res.statusCode=404;res.end('nf');return;}
      const ext=path.extname(p);
      res.setHeader('Content-Type',ext==='.html'?'text/html; charset=utf-8':ext==='.js'?'text/javascript':'application/octet-stream');
      res.setHeader('Cache-Control','no-store');
      fs.createReadStream(p).pipe(res);
    });
    server.listen(0,'127.0.0.1',()=>resolve({server,base:`http://127.0.0.1:${server.address().port}`}));
  });
}

export async function launch(opts={}){
  const args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
  if(opts.noWebGL)args.push('--disable-3d-apis');
  return chromium.launch({headless:true,args});
}

export async function phoneContext(browser,{width,height,coarse=true,reducedMotion=false,dpr=2}={}){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:coarse,hasTouch:coarse,reducedMotion:reducedMotion?'reduce':'no-preference'});
  return ctx;
}

// Block everything that is not the page itself; return a counter of failed/blocked requests.
export async function lockNetwork(page,allowedUrl){
  const failed=[];
  await page.route('**/*',(route)=>{
    const url=route.request().url();
    if(url===allowedUrl||url.startsWith(allowedUrl+'#')||url.startsWith(allowedUrl+'?'))return route.continue();
    failed.push(url);route.abort('blockedbyclient');
  });
  page.on('requestfailed',(r)=>{const u=r.url();if(!failed.includes(u))failed.push(u);});
  return failed;
}

export async function coarsePointer(page){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'pointer',value:'coarse'},{name:'hover',value:'none'},{name:'any-pointer',value:'coarse'}]});
  return cdp;
}

export async function waitForGame(page,{timeout=20000}={}){
  await page.waitForFunction(()=>{
    const s=document.querySelector('.mbm-splash');
    return (!s||s.getAttribute('data-mbm-splash-state')==='closed')&&document.querySelector('.lift-button')&&window.__MBM_TITAN_V4__&&window.__MBM_TITAN_V4__.ready;
  },{timeout});
}

export function box(page,sel){
  return page.evaluate((sel)=>{const el=document.querySelector(sel);if(!el)return null;const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom),display:cs.display,opacity:cs.opacity,visibility:cs.visibility,position:cs.position};},sel);
}

export function overlaps(a,b){if(!a||!b)return false;return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
