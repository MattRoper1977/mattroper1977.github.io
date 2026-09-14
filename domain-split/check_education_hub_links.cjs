'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const expected=[['/Lessons/','Lessons'],['/resources/','Resources'],['/Matt-s-Apps-/','Apps & tools'],['/tools/','Teacher tools']];
const routes=[...expected.map(([route])=>route),'/','/main/'];
const slugs={'/Lessons/':'lessons','/resources/':'resources','/Matt-s-Apps-/':'apps','/tools/':'tools','/':'home','/main/':'main'};
exports.assertPlainLinks=async(page,activeCount=1)=>{
  const styles=await page.locator('nav[data-mbm-hub-links] a').evaluateAll(es=>es.map(e=>{
    const s=getComputedStyle(e);return {active:e.getAttribute('aria-current')==='page',background:s.backgroundColor,image:s.backgroundImage,
      borders:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth],shadow:s.boxShadow,decoration:s.textDecorationLine,colour:s.color};
  }));
  assert.equal(styles.length,4,'Four styled public links');
  assert(styles.every(s=>s.background==='rgba(0, 0, 0, 0)'&&s.image==='none'&&s.borders.every(b=>parseFloat(b)===0)&&s.shadow==='none'),'Plain text navigation: no filled or boxed buttons');
  assert.equal(styles.filter(s=>s.active).length,activeCount,'Only the current hub is active; homepage has no false active hub');
  if(activeCount)assert(styles.find(s=>s.active).decoration.includes('underline'),'Current hub has the agreed underline');
  assert(styles.every(s=>s.colour===styles[0].colour),'Active link retains the shared theme ink');
  return styles;
};
exports.verify=async({page,origin,javaScriptEnabled,consumerFixtures=false})=>{
  const evidence=[];
  const overrides=[];
  if(consumerFixtures) for(const [route,name] of [['/Lessons/','lessons'],['/Matt-s-Apps-/','apps']]){
    const url=origin+route,body=fs.readFileSync(require('node:path').join(__dirname,'sw2',`nav-${name}-published.html`));
    const digests={lessons:'1a9937571efdbc7656486b949a7fd127bd160cb213b4ad3ba206e699c78b5a86',apps:'a2d5dedca49c9fa867c6ac2aabec83d877f1f9e4fe59bf79f2c75b771b6806bb'};
    assert.equal(require('node:crypto').createHash('sha256').update(body).digest('hex'),digests[name],'Exact independently built consumer candidate');
    const handler=r=>r.fulfill({status:200,contentType:'text/html',body});
    await page.route(url,handler);overrides.push([url,handler]);
  }
  fs.mkdirSync('audit-output/home-play-discovery/section26',{recursive:true});
  for(const width of [390,900,1280]){
    let geometry;
    for(const route of routes){
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
        assert(rows[0].boxes.every(b=>b.w>=44&&b.h>=44),'Every quick link meets 44px');
        assert.equal(await page.locator('.collection-nav').count(),0,'No legacy hub grid in the DOM');
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
        const selector=route==='/Lessons/'?'#scards .icon svg.fd-icon':route==='/resources/'?'#pillars svg.fd-icon':route==='/tools/'?'.ci svg.fd-icon':route==='/Matt-s-Apps-/'?'#groups .ci svg.fd-icon':'.fd-symbol svg.fd-icon';
        await page.locator(selector).first().waitFor({state:'visible'});
        assert((await page.locator(selector).count())>0,'Visible line icons');
        const dims=await page.locator(selector).evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
        assert(dims.every(b=>b.w>=24&&b.h>=24),'Readable card icon size');
        if(width===390&&route==='/resources/'){
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
        await page.screenshot({path:`audit-output/home-play-discovery/section26/${consumerFixtures?'owners':'pinned'}-${width}-${slugs[route]}.png`,fullPage:false});
      }
      evidence.push({width,route,javaScriptEnabled,consumerFixtures,status:'PASS',boxes:state.boxes,themeStyles});
    }
  }
  await page.setViewportSize({width:390,height:844});
  for(const [url,handler] of overrides)await page.unroute(url,handler);
  fs.writeFileSync(`audit-output/home-play-discovery/section26/links-${consumerFixtures?'owners':'pinned'}-${javaScriptEnabled?'js':'no-js'}.json`,JSON.stringify(evidence,null,2));
};
