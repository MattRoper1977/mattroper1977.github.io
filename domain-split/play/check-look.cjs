/* Additive visual-review checks. The existing check.cjs remains unchanged. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.PLAY_REVIEW_URL||'http://127.0.0.1:4173';
const out=path.resolve('reports/play-look-20261105');fs.mkdirSync(out,{recursive:true});
const checks=[];
function ratio(a,b){const l=c=>{const n=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return n[0]*.2126+n[1]*.7152+n[2]*.0722;};const x=l(a),y=l(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
(async()=>{
 const browser=await chromium.launch({channel:process.env.PLAY_BROWSER_CHANNEL||'chrome',headless:true});
 try{
  for(const width of [390,1280]){
   const height=width===390?844:800;
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage();
   await page.goto(base);await page.waitForSelector('#spot-status:not([hidden])',{state:'attached'});
   const data=await page.locator('#play-data').textContent().then(JSON.parse);
   assert.equal(await page.locator('#query').getAttribute('placeholder'),width===390?`Search ${data.catalogue} games`:'Search games');
   assert.equal(await page.locator('#result-count').innerText(),`${data.catalogue} games`);
   const spotlight=page.locator('[data-spot]:visible');assert.match(await spotlight.innerText(),/Apex Kick/);
   assert.equal(await page.locator('.intro-art svg text,.intro-art svg image').count(),0,'decorative art has no text or embedded product image');
   assert.notEqual(await page.locator('.intro-art svg g[transform]').first().evaluate(e=>getComputedStyle(e).transform),'none','calm mode preserves static artwork placement');
   assert((await page.locator('.skip').boundingBox()).y<0,'skip link remains offscreen until keyboard focus');
   assert.equal(await page.locator('.thumb-block:not(.failed)>.thumb-title:visible').count(),0,'no text over fallback artwork');
   assert(!/review build|debug overlay|developer preview/i.test(await page.locator('body').innerText()));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow');
   if(width===1280){
    const art=await spotlight.locator(':scope > .thumb').boundingBox();
    const usable=await spotlight.evaluate(e=>{const s=getComputedStyle(e);return e.getBoundingClientRect().height-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom)-parseFloat(s.borderTopWidth)-parseFloat(s.borderBottomWidth);});
    assert(art.height>=usable-2,'spotlight artwork fills its content height');
    assert.equal(await page.locator('.playlist-name').first().evaluate(e=>getComputedStyle(e).webkitLineClamp),'2');
   }
   const normal=await spotlight.locator('.play').evaluate(e=>{const s=getComputedStyle(e);return{s:s.color,b:s.backgroundColor};});assert(ratio(normal.s,normal.b)>=7,'normal CTA text contrast >=7:1');
   await page.screenshot({path:path.join(out,`${width}x${height}-home.png`)});
   if(width===390){await page.locator('#discovery-form').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${width}x${height}-search.png`)});}
   await page.locator('#spotlight').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${width}x${height}-spotlight.png`)});
   await page.locator('#filters-open').click();
   assert.equal(await page.locator('#calm-toggle').getAttribute('aria-pressed'),'true','system reduced motion defaults to calm');
   await page.locator('#contrast-toggle').click();assert.equal(await page.locator('html').getAttribute('data-contrast'),'high');
   await page.locator('#calm-toggle').click();assert.equal(await page.locator('html').getAttribute('data-calm'),'false');
   await page.locator('#calm-toggle').click();assert.equal(await page.locator('html').getAttribute('data-calm'),'true');
   await page.locator('#filters-close').click();
   const high=await spotlight.locator('.play').evaluate(e=>{const s=getComputedStyle(e);return{s:s.color,b:s.backgroundColor};});assert(ratio(high.s,high.b)>=7,'high-contrast CTA text >=7:1');
   await page.locator('#spotlight').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${width}x${height}-high-contrast.png`)});
   checks.push({width,height,phonePlaceholder:true,computedCount:data.catalogue,apexKickSpotlight:true,neutralTextFreeDecoration:true,fullHeightArt:width>=700,playlistClamped:width>=1050,calmToggle:true,contrastToggle:true,normalCTARatio:ratio(normal.s,normal.b),highCTARatio:ratio(high.s,high.b)});
   await context.close();
  }
  const forced=await browser.newContext({viewport:{width:390,height:844},forcedColors:'active'}),page=await forced.newPage();
  await page.goto(base);await page.waitForSelector('#spot-status:not([hidden])',{state:'attached'});
  assert.equal(await page.locator('html').getAttribute('data-contrast'),'high','forced-colours preference defaults to high contrast');
  assert.equal(await page.locator('#contrast-toggle').getAttribute('aria-pressed'),'true');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'forced-colours layout fits phone');
  checks.push({width:390,height:844,forcedColors:true,systemDefaultHighContrast:true,overflow:false});
  await forced.close();
 }finally{await browser.close();}
 fs.writeFileSync(path.join(out,'look-checks.json'),JSON.stringify({pass:true,checks},null,2)+'\n');console.log(JSON.stringify({pass:true,checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
