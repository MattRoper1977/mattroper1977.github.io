'use strict';
// J93 (rulings uz-6 (h), vb-3 (e)): on / and /main/ the card line icons are the J93 subject-tile icons
// (#subjects a.home-subject-tile .home-subject-icon svg, exactly 4) in place of the SW2 .fd-symbol icons.
const assert=require('node:assert/strict'),fs=require('node:fs');
// Redesign Phase 1 (merged plan 3.2, Matt's go-ahead 22 November 2026): the public row is five links,
// Studios is back in it and is current on the Studios hub, and Help joins it. This replaces D4's three.
// The row shows from 960px; below that the same five destinations are in the Menu and the row is not drawn.
const expected=[['/Lessons/','Lessons'],['/resources/','Packs'],['/tools/','Tools'],['/Matt-s-Apps-/','Studios'],['/Lessons/help/','Help']];
const ROW_FROM=960;
const routes=['/Lessons/','/resources/','/tools/','/Matt-s-Apps-/','/','/main/'];
const rowShown=page=>page.evaluate(min=>innerWidth>=min,ROW_FROM);
const rowHidden=async(page,label)=>{
  assert.equal(await page.locator('nav[data-mbm-hub-links]').evaluate(e=>getComputedStyle(e).display),'none','Below '+ROW_FROM+'px the row is not drawn: '+label);
  // A lesson page may point its own Lessons links back at its subject list, so the path is what is compared.
  const menu=await page.locator('.mbm-unified-panel .mbm-menu-group').first().evaluate(e=>[...e.querySelectorAll('a')].map(a=>new URL(a.href).pathname+new URL(a.href).search));
  const pupil=await page.locator('.mbm-unified-panel a[href^="/for/"]').count()===1;
  for(const [href] of expected) if(!(pupil&&['/tools/','/Matt-s-Apps-/'].includes(href))) assert(menu.some(item=>item.split('?')[0]===href),'The Menu carries '+href+' when the row is not drawn: '+label);
};
const slugs={'/Lessons/':'lessons','/resources/':'resources','/Matt-s-Apps-/':'apps','/tools/':'tools','/':'home','/main/':'main'};
exports.assertPublicRow=async(page,route)=>{
  const rows=await page.locator('nav[data-mbm-hub-links]').evaluateAll(es=>es.map(e=>({
    links:[...e.querySelectorAll('a')].map(a=>[new URL(a.href).pathname,a.textContent.trim()]),
    current:[...e.querySelectorAll('[aria-current="page"]')].map(a=>new URL(a.href).pathname),
    boxes:[...e.querySelectorAll('a')].map(a=>{const r=a.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}),
    scroll:document.documentElement.scrollWidth>innerWidth+1
  })));
  const current=expected.some(([href])=>href===route)?[route]:[];
  assert.equal(rows.length,1,'One public quick-link row: '+route);
  assert.deepEqual(rows[0].links,expected,'Exact shared destination/label/order: '+route);
  assert.deepEqual(rows[0].current,current,'Only the current hub is highlighted: '+route);
  assert(!rows[0].scroll,'No sideways scrolling: '+route);
  assert.equal(await page.locator('.collection-nav').count(),0,'No legacy hub grid in the DOM: '+route);
  if(!await rowShown(page)){await rowHidden(page,route);return rows[0];}
  assert(rows[0].boxes.every(b=>b.w>=44&&b.h>=44),'Every quick link meets 44px: '+route);
  {const ws=rows[0].boxes.map(b=>b.w),ys=rows[0].boxes.map(b=>b.y);assert(Math.max(...ws)-Math.min(...ws)<=1&&Math.max(...ys)-Math.min(...ys)<=1,'Quick links share one row at equal widths (evenly spaced): '+route);}
  assert.equal(await page.locator('.collection-nav').count(),0,'No legacy hub grid in the DOM: '+route);
  await exports.assertPlainLinks(page,current.length);
  return rows[0];
};
exports.assertPlainLinks=async(page,activeCount=1)=>{
  const styles=await page.locator('nav[data-mbm-hub-links] a').evaluateAll(es=>es.map(e=>{
    const s=getComputedStyle(e);return {active:e.getAttribute('aria-current')==='page',background:s.backgroundColor,image:s.backgroundImage,
      borders:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],shadow:s.boxShadow,decoration:s.textDecorationLine,colour:s.color};
  }));
  assert.equal(styles.length,expected.length,'Every public link is styled (one per shared destination)');
  assert(styles.every(s=>s.background==='rgba(0, 0, 0, 0)'&&s.image==='none'&&s.borders.every(b=>parseFloat(b)===0)&&s.shadow==='none'),'Plain text navigation: no filled or boxed buttons');
  assert.equal(styles.filter(s=>s.active).length,activeCount,'Only the current hub is active; homepage has no false active hub');
  if(activeCount)assert(styles.find(s=>s.active).decoration.includes('underline'),'Current hub has the agreed underline');
  assert(styles.every(s=>s.colour===styles[0].colour),'Active link retains the shared theme ink');
  return styles;
};
// Transition proof (redesign Phase 1). The Lessons and Studios sites publish their own copy of the
// header markup and load the shared styles and script from this site. Between this site going live
// and those two republishing, their pages carry the OLDER markup under the NEW shared files. These
// two fixtures are the consumer pages exactly as they were before this change (same bytes, same
// digests as the fixtures this check pinned until now). They must still give a working one-row header.
const legacyFixtures=[
  {route:'/Lessons/',file:'legacy-header-lessons.html',sha256:'536f4038b0ce45f8c2f159444cadca308f9ffa9f9dac652d55d579c233a67e4b'},
  {route:'/Matt-s-Apps-/',file:'legacy-header-apps.html',sha256:'bbfefa423f70ba6437fd68536a74e3fe3ba8d7fd653ef2bf0cfa0835819a0726'},
];
exports.verifyLegacyHeader=async({page,origin,javaScriptEnabled})=>{
  const path=require('node:path'),evidence=[];
  for(const item of legacyFixtures){
    const url=origin+item.route,body=fs.readFileSync(path.join(__dirname,'sw2',item.file));
    assert.equal(require('node:crypto').createHash('sha256').update(body).digest('hex'),item.sha256,'Exact pre-change consumer header fixture: '+item.file);
    assert(body.includes('mbm-menu-display')&&!body.includes('mbm-unified-display'),'The fixture carries the older header markup: '+item.file);
    const handler=r=>r.fulfill({status:200,contentType:'text/html',body});
    await page.route(url,handler);
    try{
      for(const width of [320,390,ROW_FROM,1280]){
        await page.setViewportSize({width,height:900});
        await page.goto(url);await page.waitForLoadState('networkidle');
        const label=item.route+' older markup at '+width;
        assert.equal(await page.locator('header.mbm-unified-header').count(),1,'One header: '+label);
        const shape=await page.evaluate(()=>{const h=document.querySelector('header.mbm-unified-header'),bar=h.querySelector('.mbm-unified-bar');
          const shown=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
          const mids=[...bar.children].filter(e=>shown(e)&&getComputedStyle(e).position!=='absolute').map(e=>{const r=e.getBoundingClientRect();return Math.round(r.top+r.height/2)});
          const small=[...h.querySelectorAll('a[href],button,summary')].filter(shown).map(e=>{const r=e.getBoundingClientRect();return {text:(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,30),w:Math.round(r.width),h:Math.round(r.height)}}).filter(t=>t.w<44||t.h<44);
          return {height:Math.round(h.getBoundingClientRect().height),spread:Math.max(...mids)-Math.min(...mids),small,scroll:document.documentElement.scrollWidth,inner:innerWidth,tagline:[...h.querySelectorAll('.mbm-unified-brand small')].filter(shown).length}});
        assert(shape.scroll<=shape.inner+1,'No sideways scrolling: '+label+' '+JSON.stringify(shape));
        assert(shape.height<=66&&shape.spread<=2,'One header row: '+label+' '+JSON.stringify(shape));
        assert.equal(shape.tagline,0,'No second line under the wordmark: '+label);
        assert.deepEqual(shape.small,[],'Header controls meet 44px: '+label);
        const summary=page.locator('.mbm-unified-menu > summary'),panel=page.locator('.mbm-unified-panel');
        await summary.click();assert(await panel.isVisible(),'Menu opens: '+label);
        assert(await panel.getByRole('link',{name:'Lessons',exact:true}).isVisible(),'Menu carries Lessons: '+label);
        const short=await panel.locator('a').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height).filter(h=>h>0&&h<48));
        assert.deepEqual(short,[],'Every Menu row is at least 48px: '+label);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No sideways scrolling with the Menu open: '+label);
        if(javaScriptEnabled){
          await page.locator('.mbm-menu-display > summary').click();
          const blue=page.locator('.mbm-menu-display [data-mbm-theme-slot] button[data-t="blue"]');
          await blue.scrollIntoViewIfNeeded();await blue.click();
          assert.equal(await page.locator('html').getAttribute('data-theme'),'blue','Reading background still changes: '+label);
          assert.equal((await blue.innerText()).trim().replace(/^✓\s*/,''),'Blue','The swatch carries its word: '+label);
          await page.locator('.mbm-menu-display [data-mbm-theme-slot] button[data-t="cream"]').click();
          assert.equal(await page.locator('html').getAttribute('data-theme'),null,'Cream restores the default: '+label);
          await summary.press('Escape');
        }
        evidence.push({route:item.route,width,javaScriptEnabled,status:'PASS',...shape});
      }
    }finally{await page.unroute(url,handler);}
  }
  fs.mkdirSync('audit-output/home-play-discovery/section26',{recursive:true});
  fs.writeFileSync(`audit-output/home-play-discovery/section26/legacy-header-${javaScriptEnabled?'js':'no-js'}.json`,JSON.stringify(evidence,null,2));
  await page.setViewportSize({width:390,height:844});
};
exports.verify=async({page,origin,javaScriptEnabled,consumerFixtures=false})=>{
  const evidence=[];
  const overrides=[];
  const extraOwnerFixtures=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'sw2/nav-expanded-owner-fixtures.json'),'utf8'));
  const ownerFixtures=[
    {route:'/Lessons/',file:'nav-lessons-published.html',sha256:'cea5fb3440c7db5b546390c9a802f7ddb1396fc626e272d9a5a12ba75cbf2ab4'},
    {route:'/Matt-s-Apps-/',file:'nav-apps-published.html',sha256:'09f91c412f3865674b82816e0aede36fedc3c14fce713fc4e677af8b735d90b4'},
    ...extraOwnerFixtures,
  ];
  if(consumerFixtures) for(const item of ownerFixtures){
    const url=origin+item.route,body=fs.readFileSync(require('node:path').join(__dirname,'sw2',item.file));
    assert.equal(require('node:crypto').createHash('sha256').update(body).digest('hex'),item.sha256,'Exact consumer header fixture (header and footer as an independently built page carries them): '+item.file);
    const handler=r=>r.fulfill({status:200,contentType:'text/html',body});
    await page.route(url,handler);overrides.push([url,handler]);
  }
  fs.mkdirSync('audit-output/home-play-discovery/section26',{recursive:true});
  for(const width of [390,900,ROW_FROM,1280]){
    let geometry;
    for(const route of [...routes,...(consumerFixtures?extraOwnerFixtures.map(item=>item.route):[])]){
      const current=expected.some(([href])=>href===route)?[route]:[];
      await page.setViewportSize({width,height:900});
      await page.goto(origin+route);await page.waitForLoadState('networkidle');
      const read=()=>page.locator('nav[data-mbm-hub-links]').evaluateAll(es=>es.map(e=>({
        links:[...e.querySelectorAll('a')].map(a=>[new URL(a.href).pathname,a.textContent.trim()]),
        current:[...e.querySelectorAll('[aria-current="page"]')].map(a=>new URL(a.href).pathname),
        boxes:[...e.querySelectorAll('a')].map(a=>{const r=a.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}),
        scroll:document.documentElement.scrollWidth>innerWidth+1
      })));
      const check=async()=>{
        const rows=await read();assert.equal(rows.length,1,'One public quick-link row');
        assert.deepEqual(rows[0].links,expected,'Exact shared destination/label/order');
        assert.deepEqual(rows[0].current,current,'Exactly the current hub is highlighted, if on a hub');
        assert(!rows[0].scroll,'No sideways scrolling');
        assert.equal(await page.locator('.collection-nav').count(),0,'No legacy hub grid in the DOM');
        if(!await rowShown(page)){await rowHidden(page,route);return rows[0];}
        assert(rows[0].boxes.every(b=>b.w>=44&&b.h>=44),'Every quick link meets 44px');
        await exports.assertPlainLinks(page,current.length);
        return rows[0];
      };
      const state=await check();
      const shape=state.boxes.map(b=>[b.x,b.y,b.w,b.h].map(n=>Math.round(n)));
      if(geometry)assert.deepEqual(shape,geometry,'Homepage and hubs have identical row position and spacing');else geometry=shape;
      assert.equal(await page.locator('nav.collection-nav').count(),0,'No duplicated legacy strip');
      const themeStyles=[];
      if(javaScriptEnabled){
        const savedThemes=await page.evaluate(()=>[document.documentElement,document.body].map(e=>e.getAttribute('data-theme')));
        for(const theme of ['cream','dark','pink','blue','light','highlumen']){
          await page.evaluate(t=>{for(const e of [document.documentElement,document.body])t==='cream'?e.removeAttribute('data-theme'):e.setAttribute('data-theme',t)},theme);
          await check();themeStyles.push({theme,styles:await exports.assertPlainLinks(page,current.length),status:'PASS'});
        }
        await page.evaluate(values=>[document.documentElement,document.body].forEach((e,i)=>values[i]===null?e.removeAttribute('data-theme'):e.setAttribute('data-theme',values[i])),savedThemes);
        await check();
        const selector=route==='/Lessons/'?'#scards .icon svg.fd-icon':route==='/resources/'?'#pillars svg.fd-icon':route==='/tools/'?'.ci svg.fd-icon':route==='/Matt-s-Apps-/'?'#groups .ci svg.fd-icon':['/','/main/'].includes(route)?'#subjects a.home-subject-tile .home-subject-icon svg':null;
        // A consumer fixture carries the header and footer only, so the card icons of a route it
        // stands in for are measured in the pass that loads the built page itself.
        if(selector&&!(consumerFixtures&&ownerFixtures.some(item=>item.route===route))){
        await page.locator(selector).first().waitFor({state:'visible'});
        assert((await page.locator(selector).count())>0,'Visible line icons');
        // J93: the SW2 tile icons (.fd-symbol) are replaced by the J93 subject-tile icons, one per tile.
        if(['/','/main/'].includes(route))assert.equal(await page.locator(selector).count(),4,'J93: one line icon per subject tile');
        const dims=await page.locator(selector).evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
        assert(dims.every(b=>b.w>=24&&b.h>=24),'Readable card icon size');
        }
        if(width===1280&&route==='/resources/'){
          const last=page.locator('nav[data-mbm-hub-links] a').last();
          const prior=await last.getAttribute('href');await last.evaluate(e=>e.setAttribute('href','/missing-quick-link/'));
          await assert.rejects(check,/Exact shared destination/,'Wrong destination is detected');
          await last.evaluate((e,v)=>e.setAttribute('href',v),prior);await check();
          const active=page.locator('nav[data-mbm-hub-links] [aria-current="page"]');
          const oldStyle=await active.getAttribute('style');
          await active.evaluate(e=>e.style.setProperty('background','#161d3d','important'));
          await assert.rejects(check,/Plain text navigation/,'Filled active button is detected');
          await active.evaluate((e,v)=>v===null?e.removeAttribute('style'):e.setAttribute('style',v),oldStyle);await check();
          await page.locator('nav[data-mbm-hub-links]').evaluate(e=>{const clone=e.cloneNode(true);clone.removeAttribute('data-mbm-hub-links');clone.className='collection-nav';clone.dataset.nav1Control='legacy';e.after(clone)});
          await assert.rejects(check,/No legacy hub grid/,'Legacy duplicate grid is detected');
          await page.locator('[data-nav1-control="legacy"]').evaluate(e=>e.remove());await check();
        }
        await page.screenshot({path:`audit-output/home-play-discovery/section26/${consumerFixtures?'owners':'pinned'}-${width}-${slugs[route]||route.replace(/[^a-z0-9]+/gi,'-')}.png`,fullPage:false});
      }
      evidence.push({width,route,javaScriptEnabled,consumerFixtures,status:'PASS',boxes:state.boxes,themeStyles});
    }
  }
  await page.setViewportSize({width:390,height:844});
  for(const [url,handler] of overrides)await page.unroute(url,handler);
  fs.writeFileSync(`audit-output/home-play-discovery/section26/links-${consumerFixtures?'owners':'pinned'}-${javaScriptEnabled?'js':'no-js'}.json`,JSON.stringify(evidence,null,2));
};
