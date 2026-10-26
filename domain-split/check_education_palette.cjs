'use strict';
// Part T: actual rendered roles, not just the presence of custom properties.
// The route census must match the existing navigation gate, so omissions fail.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
// J93 (rulings uz-6 (h), vb-3 (e)): / and /main/ are the bound J93 homepage. Retired -> replaced:
//   the SW2 .fd-subject card role -> the role of each J93 card family (door, flagship, subject tile, teacher tool),
//     with the stamped counts of record (4 doors, 3 flagship cards, 4 tiles);
//   the onDark heading expectation for / and /main/ (r5's body has no data-sw2-frontdoor) -> the one J93 h1,
//     main h1#home-title, which sits on the body surface and takes the body ink.
// Added: the body surface on / and /main/ follows the four tints (pink, blue, light, highlumen) as well as cream
// and dark; expected values are the education palette's body surfaces (assets/education-palette.css), typed here.
const HOME_CARDS=['a.home-door-card','article.home-pathway-card[data-pathway-card]','a.home-subject-tile','.home-tool-card'];
const HOME_CARD_COUNTS={'a.home-door-card':4,'article.home-pathway-card[data-pathway-card]':3,'a.home-subject-tile':4};
const TINT_BODY={pink:'rgb(249, 232, 236)',blue:'rgb(231, 238, 247)',light:'rgb(247, 247, 244)',highlumen:'rgb(255, 255, 255)'};
const origin=new URL(process.env.MBM_EDUCATION_ORIGIN||'http://127.0.0.1:4173').origin;
const cases=[
  ['/','home',HOME_CARDS],['/main/','home alias',HOME_CARDS],
  ['/account/','account','.ma-panel'],['/members/','members','.ma-panel'],['/mailing-list/','updates','.ma-panel'],
  ['/privacy/','privacy','.pv-note'],['/stats/','statistics','.usage-card'],
  ['/owner/stats/','owner statistics',null,'Individual statistics require the existing service; the static console has no result card.'],
  ['/resources/','resources','.rx-cardx'],['/tools/','tools','.tcard'],
  ['/teach/','teacher workspace','.mbm-task-card'],['/education-hub/','education guidance','.mbm-start-card'],
  ['/for/teachers/','teachers','.fd-subject'],['/for/pupils/','pupils','.fd-subject'],
  ...['parents-carers','schools-semh','trusts','councils-organisations','partners'].map(s=>['/for/'+s+'/','audience '+s,'.ad-card']),
  ['/for/governors-trustees/','governors','.gv-card'],['/Lessons/','lessons','.scard'],
  ['/Lessons/primary/','primary','.primary-unit'],['/Matt-s-Apps-/','apps','.card'],
  ['/stats/on-this-device/','device statistics','.sx-card'],['/asdan/','ASDAN','.card'],['/uas/','UAS','.card'],
  ['/commission/','commission','.subject-card'],['/Lessons/Science_Teesside/','science catalogue','.card'],
  ['/Lessons/Humanities_Teesside/','humanities catalogue','.card'],
  ['/Lessons/Humanities_Teesside/David_Cover_Autumn1_W3-W7/','humanities packs','.lesson-card'],
  ['/Lessons/Science_Teesside/Teaching_Packs/','science packs','.lesson'],
  ['/Lessons/subject.html','subject chooser','#chooser a'],
];
const expectedRoutes=JSON.parse('['+fs.readFileSync(path.join(__dirname,'check_shared_navigation.cjs'),'utf8').match(/const routes = \[([\s\S]*?)\];/)[1].replaceAll("'",'"')+']');
assert.deepEqual(cases.map(c=>c[0]).sort(),expectedRoutes.sort(),'Complete existing route census');
function snapshot(){
  const style=getComputedStyle(document.body);
  return {bg:style.backgroundColor,ink:style.color,card:style.getPropertyValue('--edu-card').trim(),
    primary:getComputedStyle(document.documentElement).getPropertyValue('--mbm-primary').trim(),
    width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    links:[...document.querySelectorAll('link[rel~="stylesheet"]')].filter(l=>new URL(l.href).pathname==='/assets/mbm-tokens.css').length,
    variant:document.querySelector('.mbm-unified-header').dataset.mbmVariant};
}
function check(row,theme){
  const dark=theme==='dark';
  assert.equal(row.links,1,'One token link');assert(row.primary,'Canonical primary must resolve');
  assert.equal(row.bg,dark?'rgb(8, 20, 34)':'rgb(246, 241, 231)','Rendered body background');
  assert.equal(row.ink,dark?'rgb(243, 247, 250)':'rgb(22, 29, 61)','Rendered body ink');
  assert(row.scrollWidth<=row.width+1,'No page overflow');
}
async function run(){
 const browser=await chromium.launch();const rows=[],requests=[],errors=[],appsComposition=[],tints=[];
 try{
  for(const width of [390,900,1280]) for(const theme of ['cream','dark']){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await context.newPage();
   page.on('request',r=>{if(r.resourceType()==='font')requests.push({url:r.url(),route:page.url()})});
   page.on('pageerror',e=>errors.push({route:page.url(),error:e.message}));
   for(const [route,type,card,notApplicable] of cases){
    assert.equal((await page.goto(origin+route)).status(),200,route);
    await page.waitForLoadState('networkidle');
    await page.evaluate(t=>{for(const e of [document.documentElement,document.body])t==='cream'?e.removeAttribute('data-theme'):e.setAttribute('data-theme',t)},theme);
    const row={route,type,theme,...await page.evaluate(snapshot)};check(row,theme);
    const h=page.locator('h1').first();
    if(await h.count()){row.heading=await h.evaluate(e=>({text:e.textContent.trim(),colour:getComputedStyle(e).color}));
     // Part R places Resources' heading on the body surface; every other role is unchanged.
     const sw2=await page.locator('body[data-sw2-frontdoor],main[data-sw2-apps-hub]').count();
     const onDark=!sw2&&['/account/','/members/','/mailing-list/','/privacy/','/tools/','/teach/','/education-hub/','/for/teachers/','/for/pupils/','/Matt-s-Apps-/','/stats/on-this-device/','/asdan/','/uas/','/commission/','/Lessons/Science_Teesside/','/Lessons/Humanities_Teesside/'].includes(route);
     assert.equal(row.heading.colour,onDark?'rgb(255, 254, 250)':row.ink,'Matched primary heading role '+route);
     // J93: the homepage h1 is the masthead descriptor on the body surface (no dark hero band).
     if(['/','/main/'].includes(route)){
      assert.equal(await page.locator('h1').count(),1,'One h1 on the J93 homepage '+route);
      assert.equal(await page.locator('main h1#home-title').count(),1,'The h1 is the J93 masthead (main h1#home-title) '+route);
      assert.equal(row.heading.colour,row.ink,'The J93 masthead heading takes the body ink '+route);
     }
    }
    else assert.equal(route,'/stats/','Missing primary heading outside the compact statistics block');
    if(card){
     // A route names one card selector, or (J93 homepage) one per card family; each is held to the same role.
     row.cardRoles=[];
     for(const selector of [].concat(card)){
      if(HOME_CARD_COUNTS[selector]&&['/','/main/'].includes(route))assert.equal(await page.locator(selector).count(),HOME_CARD_COUNTS[selector],'J93 card count '+selector+' '+route);
      const target=page.locator(selector+':visible').first();await target.waitFor({state:'visible'});
      const role=await target.evaluate(e=>{const s=getComputedStyle(e);return{background:s.backgroundColor,radius:s.borderRadius,shadow:s.boxShadow}});
      row.cardRoles.push({selector,...role});
      const label=typeof card==='string'?route:route+' '+selector;
      assert.equal(role.background,theme==='dark'?'rgb(17, 34, 55)':'rgb(255, 255, 255)','Card fill '+label);
      assert.equal(role.radius,'12px','Card radius '+label);assert.notEqual(role.shadow,'none','Card shadow '+label);
     }
     row.cardRole=row.cardRoles[0];
    }else{assert(notApplicable);row.cardNotApplicable=notApplicable}
    const nav=page.locator('.mbm-unified-nav');
    const hub=['/Lessons/','/resources/','/Matt-s-Apps-/','/tools/'].includes(route);
    // NAV-2: the public row is complete on every shared-header surface;
    // the adult/pupil variant continues to govern Saved and the menu separately.
    row.hubLinkStyles=await require('./check_education_hub_links.cjs').assertPlainLinks(page,hub?1:0);
    assert.deepEqual(await nav.locator('a').allTextContents(),['Lessons','Resources','Apps & tools','Teacher tools'],'Actual complete public navigation '+route);
    assert.equal(await page.locator('.mbm-unified-saved').count(),row.variant==='adult'?1:0,'Saved ownership '+route);
    assert.equal(await nav.locator('.mbm-unified-about').count(),0,'The public row contains only the four agreed destinations at every width');
    assert.equal(await page.locator('footer .mbm-chrome-signoff').count(),1,'One actual shared footer');
    assert.equal(await page.locator('footer img[src*="micro_mark"],footer svg.mono').count(),0,'Retired footer marks');
    rows.push(row);
   }
   // J93: the body surface of / and /main/ follows each of the four tints (measured once per width).
   if(theme==='cream')for(const route of ['/','/main/'])for(const [tint,bg] of Object.entries(TINT_BODY)){
    assert.equal((await page.goto(origin+route)).status(),200,route);await page.waitForLoadState('networkidle');
    await page.evaluate(t=>{for(const e of [document.documentElement,document.body])e.setAttribute('data-theme',t)},tint);
    const s=await page.evaluate(snapshot);
    assert.equal(s.links,1,'One token link '+route+' '+tint);
    assert.equal(s.bg,bg,'Rendered body background follows the '+tint+' theme '+route);
    tints.push({route,width,tint,bg:s.bg});
   }
   appsComposition.push(await require('./sw2/check_apps_palette.cjs').verify({page,context,origin,width,theme}));
   // A real missing stylesheet and a visible defect must each turn the gate red.
   await page.goto(origin+'/');await page.waitForLoadState('networkidle');
   await page.evaluate(t=>{for(const e of [document.documentElement,document.body])t==='cream'?e.removeAttribute('data-theme'):e.setAttribute('data-theme',t)},theme);
   check(await page.evaluate(snapshot),theme);
   await page.locator('link[href="/assets/mbm-tokens.css"]').evaluate(e=>e.remove());
   await assert.rejects(async()=>check(await page.evaluate(snapshot),theme),/One token link/);
   await page.reload();await page.waitForLoadState('networkidle');
   await page.evaluate(t=>{for(const e of [document.documentElement,document.body])t==='cream'?e.removeAttribute('data-theme'):e.setAttribute('data-theme',t)},theme);
   const planted=await page.addStyleTag({content:'body[data-mbm-palette="education"]{background:#ff00ff!important}'});
   await assert.rejects(async()=>check(await page.evaluate(snapshot),theme),/Rendered body background/);
   await planted.evaluate(e=>e.remove());check(await page.evaluate(snapshot),theme);
   await context.close();
  }
  assert.deepEqual(errors,[],'No page errors');assert.deepEqual(requests.filter(r=>new URL(r.url).origin!==origin),[],'No third-party fonts');
  fs.mkdirSync('audit-output/education-navigation',{recursive:true});
  fs.writeFileSync('audit-output/education-navigation/part-t-palette.json',JSON.stringify({status:'PASS',rows,tints,appsComposition,fontRequests:requests,errors,controls:'unlink / visible repaint / restore at each width and theme'},null,2));
  assert.equal(tints.length,24,'J93: four tints x two homepage routes x three widths');
  console.log('PASS Part T: '+rows.length+' complete route/width/theme cases with rendered body/card roles, actual variants, font requests and negative controls; J93 homepage tints '+tints.length+'.');
 }finally{await browser.close()}
}
module.exports={run};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
