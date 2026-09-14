/* SW2 H/U: rendered source-backed data, layout and pupil search controls.
 * Runs within the existing UX2 B5 browser and keeps all B5 red proofs. */
'use strict';
const assert = require('node:assert/strict');
exports.verify = async ({page, origin, rules, record}) => {
  const rows = await (await page.request.get(origin+'/Lessons/resources.json')).json();
  const report = {cases:[], previews:0, brokenImages:0, otherAudienceBodies:'checked separately by exact output comparison'};
  for(const width of [390,900,1280]) for(const route of ['/','/for/teachers/','/for/pupils/']) {
    await page.setViewportSize({width,height:900}); await page.goto(origin+route); await page.waitForLoadState('networkidle');
    const measure = async () => page.evaluate(() => ({
      overflow:[document.documentElement,...document.querySelectorAll('main *')].filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='inline'&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+1).filter(e=>{const s=getComputedStyle(e);return !(e.matches('#added-rail .acard p')&&s.textOverflow==='ellipsis'&&s.overflowX==='hidden'&&s.whiteSpace==='nowrap'&&e.getBoundingClientRect().height<=parseFloat(s.lineHeight)+1)}).map(e=>e.id||e.className||e.tagName),
      small:[...document.querySelectorAll('main a[href],main button,main summary,main input')].filter(e=>e.getClientRects().length&&!e.disabled).filter(e=>{const b=e.getBoundingClientRect();return b.width<44||b.height<44}).map(e=>e.textContent.trim().slice(0,45)),
      broken:[...document.images].filter(i=>i.getClientRects().length&&(!i.complete||!i.naturalWidth)).map(i=>i.src),
      owl:[...document.querySelectorAll('[src],[href]')].filter(e=>/owl/i.test(e.getAttribute('src')||e.getAttribute('href')||'')).length
    }));
    assert.deepEqual(await measure(),{overflow:[],small:[],broken:[],owl:0},'H/U geometry, images and targets: '+route+' at '+width+' '+JSON.stringify(await measure()));
    if(route==='/'){
      assert.equal(await page.locator('main form').count(),0,'Homepage retains one non-form search');
      assert.equal(await page.locator('[data-home-search] input').getAttribute('placeholder'),'Try Science, Humanities or PDF Studio');
      const cards=await page.locator('[data-pack-card]').evaluateAll(es=>es.map(e=>({hidden:e.hidden,halfTerm:e.dataset.packHalfTerm,head:e.querySelector('[data-pack-heading]').textContent,tiers:[...e.querySelectorAll('[data-pack-pathways] .fd-chip')].map(x=>x.textContent),formats:e.querySelector('[data-pack-formats]').textContent,href:e.querySelector('[data-pack-link]').getAttribute('href')})));
      const packs=rows.filter(r=>r.kind==='pack'&&r.companionOf&&r.files?.length);
      assert(packs.length,'Pack census is non-vacuous');
      for(const c of cards){assert.equal(c.hidden,false);const group=packs.filter(r=>r.halfTerm===c.halfTerm&&c.head===r.subject+' · '+c.halfTerm);assert(group.length,'Pack heading identifies real records');assert.deepEqual(c.tiers,['BUILD','GROW','LAUNCH'].filter(p=>group.some(r=>rules.tierOf(r)===p)));const formats=[['pptx','PowerPoint'],['docx','Word'],['pdf','PDF']].filter(([ext])=>group.some(r=>r.files.some(f=>f.type===ext))).map(([,label])=>label).join(' · ');assert.equal(c.formats,formats);const u=new URL(c.href,origin);assert.equal(u.pathname,'/resources/');assert.equal(u.searchParams.get('halfTerm'),c.halfTerm);assert.equal(u.searchParams.get('type'),'pack');}
      const subjects=await page.locator('[data-subject-tiles] a').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href'),icons:e.querySelectorAll('svg.fd-icon').length,height:e.getBoundingClientRect().height})));
      assert.deepEqual(subjects.map(s=>s.href.split('subject=')[1]),['science','humanities-re','art-studio','lifeskills'].filter(slug=>rows.some(r=>rules.cardOf(r)===slug)),'Homepage features the four actual subject groups');
      for(const s of subjects){assert.equal(s.icons,1,'Each featured subject has a vector icon');assert(s.height<=100,'Featured subjects remain compact');}
      const previews=await page.locator('main img[data-preview-source]').evaluateAll(es=>es.map(e=>({source:e.dataset.previewSource,sha:e.dataset.previewSha,complete:e.complete,width:e.naturalWidth})));
      for(const p of previews){assert(p.complete&&p.width>0,'Real preview decodes');const found=rows.some(r=>r.files?.some(f=>f.type==='pdf'&&f.path===p.source));assert(found,'Preview comes from a real PDF record');const bytes=await(await page.request.get(origin+'/Lessons/'+encodeURI(p.source))).body();assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),p.sha,'Preview source has the reviewed PDF bytes');}
      assert.equal(await page.locator('main img:not([data-preview-source])').count(),0,'No unproven or invented homepage pictures');
      const sources=await page.locator('#added-rail .acard').evaluateAll(es=>es.map(e=>({file:e.dataset.resourcePath,title:e.querySelector('h3').textContent,desc:e.querySelector('p')?.textContent||'',interactive:!!e.querySelector('.fd-interactive')})));
      assert(sources.length>0&&sources.length<=3);for(const c of sources){const r=rows.find(r=>(r.file||r.url)===c.file);assert(r);assert.equal(c.title,r.title);assert.equal(c.desc,r.desc||r.description||'');assert.equal(c.interactive,/\.html(?:[?#]|$)/i.test(c.file));}
      require('node:fs').mkdirSync('audit-output/homepage-repair',{recursive:true});
      await page.screenshot({path:'audit-output/homepage-repair/home-'+width+'.png',fullPage:true});
    }
    if(route==='/for/pupils/'){
      assert.equal(await page.locator('main input').getAttribute('placeholder'),'Type the name your teacher gave you');
      assert.equal(await page.locator('main .fd-chip,a[href*="/account/"],a[href*="ko-fi"]').count(),0);
      const data=await(await page.request.get(origin+'/data/domain-catalogue.json')).json();assert(data.pupils.length);
      await page.locator('#pupils-q').fill(data.pupils[0].title);await page.getByRole('button',{name:'Find it',exact:true}).click();
      assert(await page.locator('#pupils-results .result:visible').count());
      assert.deepEqual(await measure(),{overflow:[],small:[],broken:[],owl:0},'Pupil search results keep 44px and fit');
      await page.locator('#pupils-q').fill('sw2-no-such-activity-zzqx');await page.getByRole('button',{name:'Find it',exact:true}).click();assert.equal(await page.locator('#pupils-results .result').count(),0);assert.match(await page.locator('#pupils-status').innerText(),/No matches/);
      assert.deepEqual(await measure(),{overflow:[],small:[],broken:[],owl:0},'Pupil empty state fits');
    }
    if(route==='/for/teachers/'){
      const text=await page.locator('#teacher-note').innerText();assert(text.includes(record.audiences.teachers.noteTitle));assert(text.includes(record.audiences.teachers.note));
      assert.equal(await page.locator('.fd-shortcut').filter({has:page.getByRole('heading',{name:'Saved lessons',exact:true})}).getAttribute('href'),'/Lessons/?view=saved');
    }
    report.cases.push({width,route,status:'PASS'});
  }
  await page.setViewportSize({width:390,height:844});return report;
};
