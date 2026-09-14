'use strict';
// The exact Apps #99 publication, composed with this Site candidate's real CSS.
// This fixture is authoring evidence only; it is never a published route.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'apps-published.html'));
const sha='d235dab94b856c16268d0815901b89cddc9d6646c95e5ba4529303fb9e16c1c1';
assert.equal(crypto.createHash('sha256').update(html).digest('hex'),sha,'Exact released Apps HTML fixture');
const luminance=c=>{const a=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*a[0]+.7152*a[1]+.0722*a[2]};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
exports.verify=async({page,context,origin,width,theme})=>{
 const route=origin+'/Matt-s-Apps-/';
 await context.route(route,r=>r.fulfill({status:200,contentType:'text/html',body:html}));
 try{
  assert.equal((await page.goto(route)).status(),200);
  await page.waitForLoadState('networkidle');
  await page.evaluate(t=>{for(const e of [document.documentElement,document.body])t==='cream'?e.removeAttribute('data-theme'):e.setAttribute('data-theme',t)},theme);
  const measure=async()=>page.evaluate(()=>{
   const hero=document.querySelector('main[data-sw2-apps-hub] .hero'),s=getComputedStyle(hero);
   return {background:s.backgroundColor,image:s.backgroundImage,text:[...hero.querySelectorAll('h1,.lead,.apps-total,.apps-breadcrumb,.count')].map(e=>{
    const t=getComputedStyle(e);let p=e,bg='rgba(0, 0, 0, 0)';
    while(p){bg=getComputedStyle(p).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')break;p=p.parentElement}
    return {text:e.textContent.trim(),ink:t.color,background:bg,visible:e.getBoundingClientRect().height>0&&t.visibility==='visible'&&Number(t.opacity)>0};
   })};
  });
  const check=async()=>{const r=await measure();assert.equal(r.image,'none','SW2 Apps hero cannot retain the legacy dark gradient');assert.equal(r.background,theme==='dark'?'rgb(8, 20, 34)':'rgb(246, 241, 231)','SW2 Apps hero uses the current reading surface');assert.equal(r.text.length,5,'Non-vacuous complete hero text census');for(const t of r.text){assert(t.text&&t.visible,'Visible Apps hero text');t.contrast=contrast(t.ink,t.background);assert(t.contrast>=4.5,'Apps hero text contrast: '+JSON.stringify(t))}return r};
  const result=await check();
  await page.screenshot({path:'audit-output/education-navigation/apps-sw2-'+width+'-'+theme+'.png',animations:'disabled'});
  const defect=await page.addStyleTag({content:'body main[data-sw2-apps-hub] .hero{background:linear-gradient(115deg,#161d3d,#194a52)!important}'});
  await assert.rejects(check,/legacy dark gradient/,'The observed published regression must be detected');
  await defect.evaluate(e=>e.remove());await check();
  return {width,theme,appsHTML:sha,...result,control:'legacy gradient rejected; restored PASS'};
 }finally{await context.unroute(route)}
};
