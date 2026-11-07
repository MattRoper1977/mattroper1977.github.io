'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const contrastSource=fs.readFileSync(path.join(__dirname,'../tools/sw2/check_contrast_census.cjs'),'utf8');
const contrastStart=contrastSource.indexOf('const MEASURE =');
const contrastEnd=contrastSource.indexOf('\n(async () => {');
assert(contrastStart>=0 && contrastEnd>contrastStart,'Existing contrast instrument is available');
// Hub tile census extends the same composed-surface instrument used above.
// Original resource thresholds and acceptance checks remain unchanged.
let tileSource = contrastSource.slice(contrastStart, contrastEnd);
for (const needle of ['const failures = [];', 'if (!visible(el)) continue;',
                      'const need = large ? 3 : 4.5;', 'return { nodes, failures, unmeasured, deferred };']) {
  assert(tileSource.includes(needle), 'Tile extension requires the current instrument: ' + needle);
}
tileSource = tileSource
  .replace('const failures = [];', 'const failures = []; const measurements = [];')
  .replace('if (!visible(el)) continue;', 'if (!visible(el) || !el.closest("[data-mbm-tile]")) continue;')
  .replace('const need = large ? 3 : 4.5;', 'const need = 7;')
  .replace('if (r + 0.005 < need) {', 'measurements.push({selector:sel(el),fg:cs.color,bg:bg.colour,ratio:r,size}); if (r + 0.005 < need) {')
  .replace('return { nodes, failures, unmeasured, deferred };', 'return { nodes, failures, unmeasured, deferred, measurements };');
const measureTiles = Function(tileSource + ';return MEASURE')();

const origin=process.env.MBM_EDUCATION_ORIGIN||'http://127.0.0.1:4173';
const routes=['/','/main/',...Object.values(require('../data/audience-homepages.json').audiences).map(a=>a.route),'/education-hub/','/teach/','/stats/','/stats/on-this-device/','/members/','/uas/','/evidence-binder/moderator-pro/','/privacy/','/mailing-list/','/thanks/'];
(async()=>{const browser=await chromium.launch(),rows=[];let planted=false;
try{for(const route of routes)for(const theme of ['cream','light','dark','highlumen'])for(const width of [360,1280]){
 const page=await browser.newPage({viewport:{width,height:640},reducedMotion:'reduce'});
 await page.goto(origin+route,{waitUntil:'networkidle'});
 await page.evaluate(t=>{for(const e of [document.documentElement,document.body])t==='cream'?e.removeAttribute('data-theme'):e.setAttribute('data-theme',t)},theme);
 const cards=await page.locator('[data-mbm-tile]').count();
 if(!cards){assert.equal(route,'/thanks/','Every existing card surface is annotated');rows.push({route,theme,width,cards,plain:true});await page.close();continue;}
 const m=await page.evaluate(measureTiles,[null,null]);
 const smallText=m.measurements.filter(x=>x.size<18);
 const worst=m.measurements.sort((a,b)=>a.ratio-b.ratio)[0];
 const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,first:document.querySelector('[data-mbm-tile]')?.getBoundingClientRect().top}));
 rows.push({route,theme,width,cards,nodes:m.nodes,worst,smallText,failures:m.failures,unmeasured:m.unmeasured,deferred:m.deferred,layout});
 if(!planted&&m.nodes){const bad=await page.evaluate(measureTiles,['html body [data-mbm-tile][data-mbm-tile][data-mbm-tile] *',null]);assert(bad.failures.length,'White tile text must fail');await page.locator('head > style').last().evaluate(e=>e.remove());planted=true;}
 console.log(route,theme,width,m.nodes, m.failures.length,m.unmeasured.length,m.deferred.length);await page.close();
}
fs.mkdirSync('audit-output/hub-tiles',{recursive:true});fs.writeFileSync('audit-output/hub-tiles/contrast.json',JSON.stringify({rows,planted},null,2));
const bad=rows.filter(r=>!r.plain&&(!r.nodes||r.smallText.length||r.failures.length||r.unmeasured.length||r.deferred.length||r.layout.overflow));
console.log(JSON.stringify({states:rows.length,planted,failures:bad},null,2));assert.equal(bad.length,0,'All tile text is measured at 7:1 and fits both widths');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
