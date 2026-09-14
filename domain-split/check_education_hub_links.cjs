'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const expected=[['/Lessons/','Lessons'],['/resources/','Resources'],['/Matt-s-Apps-/','Apps & tools'],['/tools/','Teacher tools']];
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
    for(const [route] of expected.slice(0,3)){
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
        assert.deepEqual(rows[0].current,[route],'Exactly the current hub is highlighted');
        assert(!rows[0].scroll,'No sideways scrolling');
        assert(rows[0].boxes.every(b=>b.w>=44&&b.h>=44),'Every quick link meets 44px');
        return rows[0];
      };
      const state=await check();
      const shape=state.boxes.map(b=>[b.x,b.y,b.w,b.h].map(n=>Math.round(n)));
      if(geometry)assert.deepEqual(shape,geometry,'Three hubs have identical row position and spacing');else geometry=shape;
      assert.equal(await page.locator('nav.collection-nav').count(),0,'No duplicated legacy strip');
      if(javaScriptEnabled){
        const selector=route==='/Lessons/'?'#scards .icon svg.fd-icon':route==='/resources/'?'#pillars svg.fd-icon':'#groups .ci svg.fd-icon';
        await page.locator(selector).first().waitFor({state:'visible'});
        assert((await page.locator(selector).count())>0,'Visible line icons');
        const dims=await page.locator(selector).evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
        assert(dims.every(b=>b.w>=24&&b.h>=24),'Readable card icon size');
        if(width===390&&route==='/resources/'){
          const last=page.locator('nav[data-mbm-hub-links] a').last();
          const prior=await last.getAttribute('href');await last.evaluate(e=>e.setAttribute('href','/missing-quick-link/'));
          await assert.rejects(check,/Exact shared destination/,'Wrong destination is detected');
          await last.evaluate((e,v)=>e.setAttribute('href',v),prior);await check();
        }
        await page.screenshot({path:`audit-output/home-play-discovery/section26/${consumerFixtures?'owners':'pinned'}-${width}-${route.includes('Lessons')?'lessons':route.includes('resources')?'resources':'apps'}.png`,fullPage:false});
      }
      evidence.push({width,route,javaScriptEnabled,consumerFixtures,status:'PASS',boxes:state.boxes});
    }
  }
  await page.setViewportSize({width:390,height:844});
  for(const [url,handler] of overrides)await page.unroute(url,handler);
  fs.writeFileSync(`audit-output/home-play-discovery/section26/links-${consumerFixtures?'owners':'pinned'}-${javaScriptEnabled?'js':'no-js'}.json`,JSON.stringify(evidence,null,2));
};
