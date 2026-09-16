/* SW2 H/U: rendered source-backed data, layout and pupil search controls.
 * Runs within the existing UX2 B5 browser and keeps all B5 red proofs.
 * EDU-D3 (CX2 §5): proves the hero artwork by digest on every front door and width, and drives
 * the Try-a-lesson rotation (order, copy, routes, previews, controls, stop/pause rules, no-script card). */
'use strict';
const assert = require('node:assert/strict');
exports.verify = async ({page, origin, rules, record}) => {
  const rows = await (await page.request.get(origin+'/Lessons/resources.json')).json();
  const response = await page.request.get(origin+'/Lessons/assets/catalogue/display-titles.json');
  const titleMap = response.ok() ? await response.json() : null;
  const displayTitle = r => {const e=titleMap?.schema===1&&titleMap.entries?.[r.file||r.url];return e&&e.id===(r.id||'')&&e.originalTitle===r.title?e.displayTitle:r.title;};
  const report = {cases:[], previews:0, brokenImages:0, otherAudienceBodies:'checked separately by exact output comparison'};
  // EDU-TRY-LESSON-20260915: the bound feature manifest (schema 2), read once for every case below.
  const review=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'homepage-feature.json'),'utf8'));
  for(const width of [320,390,900,1280]) for(const route of ['/','/for/teachers/','/for/pupils/']) {
    if(width===320&&route!=='/')continue; // New narrow-screen coverage is for the changed homepage.
    await page.setViewportSize({width,height:900}); await page.goto(origin+route); await page.waitForLoadState('networkidle');
    const measure = async () => page.evaluate(() => ({
      overflow:[document.documentElement,...document.querySelectorAll('main *')].filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='inline'&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+1).filter(e=>{const s=getComputedStyle(e);return !(e.matches('#added-rail .acard p')&&s.textOverflow==='ellipsis'&&s.overflowX==='hidden'&&s.whiteSpace==='nowrap'&&e.getBoundingClientRect().height<=parseFloat(s.lineHeight)+1)}).map(e=>e.id||e.className||e.tagName),
      small:[...document.querySelectorAll('main a[href],main button,main summary,main input')].filter(e=>e.getClientRects().length&&!e.disabled).filter(e=>{const b=e.getBoundingClientRect();return b.width<44||b.height<44}).map(e=>e.textContent.trim().slice(0,45)),
      broken:[...document.images].filter(i=>i.getClientRects().length&&(!i.complete||!i.naturalWidth)).map(i=>i.src),
      // Search asset references, not encoded JPEG bytes: a real PDF preview's
      // base64 can contain "owl" by chance. Inline images are independently
      // required below to carry verified PDF provenance and decode correctly.
      owl:[...document.querySelectorAll('[src],[href]')].filter(e=>{
        const value=e.getAttribute('src')||e.getAttribute('href')||'';
        return !/^data:image\/jpeg;base64,/i.test(value)&&/owl/i.test(value);
      }).length
    }));
    assert.deepEqual(await measure(),{overflow:[],small:[],broken:[],owl:0},'H/U geometry, images and targets: '+route+' at '+width+' '+JSON.stringify(await measure()));
    // EDU-HERO-20260915: the artwork is one of the approved crops (source digest + served digest), decorative, and phones get the simplified crop.
    const heroManifest=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'education-hero.json'),'utf8'));
    const heroes=await page.locator('main img[data-hero-source]').evaluateAll(es=>es.map(e=>({src:e.currentSrc||e.src,source:e.dataset.heroSource,sha:e.dataset.heroSha,phone:e.dataset.heroPhoneSha||null,complete:e.complete,w:e.naturalWidth,h:e.naturalHeight,alt:e.alt,width:e.getAttribute('width'),height:e.getAttribute('height'),box:e.getBoundingClientRect().width})));
    assert.equal(heroes.length,{'/':1,'/for/teachers/':1,'/for/pupils/':0}[route],'Hero artwork count: '+route);
    for(const h of heroes){
      assert.equal(h.alt,'','Hero artwork is decorative (empty alt)');assert(h.complete&&h.w>0&&h.h>0,'Hero artwork decodes');assert(h.width&&h.height,'Hero artwork reserves its dimensions');
      const image=Object.values(heroManifest.images).find(i=>i.sourceSha256===h.source&&i.sha256===h.sha);assert(image,'Hero artwork is an approved crop: '+route);
      const expected=(width<768&&h.phone)?Object.values(heroManifest.images).find(i=>i.sha256===h.phone):image;assert(expected,'Phone crop is declared');
      assert(h.src.endsWith('/'+expected.published),'The served source is the declared crop for this width: '+h.src);
      const bytes=await(await page.request.get(origin+'/'+expected.published)).body();assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),expected.sha256,'Served hero bytes match the manifest');
      assert.equal(bytes.length,expected.bytes);assert(h.box>0&&h.box<=page.viewportSize().width,'Hero artwork fits the viewport');
      assert.equal(await page.locator('main img[data-hero-source]').evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&(hit===e||e.contains(hit)||hit.contains(e));}),true,'Nothing overlaps the artwork');
    }
    if(route==='/'){
      assert.equal(await page.locator('.fd-hero h1').textContent(),'Big on ideas. Light on prep.');
      assert.equal(await page.locator('.fd-hero > div > .fd-eyebrow').textContent(),'MADE BY A TEACHER. BUILT FOR REAL CLASSROOMS.');
      assert.equal(await page.locator('.fd-hero .fd-lead').textContent(),'Interactive lessons, practical resources and useful teaching tools—all in one place, ready to help you bring learning to life.');
      assert.equal(await page.locator('.fd-hero .fd-provenance').count(),0,'The hero eyebrow replaces duplicate nearby provenance');
      assert.equal(await page.locator('main form').count(),0,'Homepage retains one non-form search');
      assert.equal(await page.locator('[data-home-search] input').getAttribute('placeholder'),'Try Science, Humanities or PDF Studio');
      // EDU-TRY-LESSON-20260915: the rotation over the eligible EDU-Q1 lessons, bound by digest.
      assert.equal(review.schemaVersion,2,'The feature manifest is the bound schema');
      const features=page.locator('[data-featured-lesson]');
      assert.equal(await features.count(),2,'One responsive feature in each layout slot');
      assert.equal(await features.filter({visible:true}).count(),1,'Exactly one feature is visible');
      for(const f of review.features){const pack=rows.find(r=>r.id===f.packId);assert(pack&&pack.companionOf===f.lessonFile,'Feature retains the real companion target: '+f.packId);assert.equal(f.lessonRoute,'/Lessons/'+f.lessonFile);assert.equal(f.packRoute,'/Lessons/pack.html?id='+f.packId);}
      for(const feature of await features.all()) {
        const slides=feature.locator('[data-try-slide]');
        assert.equal(await slides.count(),review.features.length,'Every eligible lesson has a slide');
        for(let i=0;i<review.features.length;i++){const f=review.features[i];const slide=slides.nth(i);
          assert.equal(await slide.getAttribute('data-try-slide'),f.packId,'Slides keep the declared order');
          assert.equal((await slide.locator('h2').textContent()).trim(),f.displayTitle);
          assert.equal(await slide.getByRole('link',{name:'Try this lesson →',exact:true,includeHidden:true}).getAttribute('href'),f.lessonRoute);
          assert.equal(await slide.getByRole('link',{name:'Get the teaching pack →',exact:true,includeHidden:true}).getAttribute('href'),f.packRoute);
          const text=await slide.textContent();assert(text.includes(f.description)&&text.includes('Reference: '+f.reference)&&text.includes(f.subject+' · '+f.duration),'Slide copy is the bound copy: '+f.packId);
          assert.equal((await slide.locator('.fd-chip').textContent()).trim(),f.pathway);
          assert.equal(await slide.locator('img[data-preview-source]').getAttribute('data-preview-sha'),f.previews[0].sourceSha256,'Slide preview is the bound preview');}
        assert.equal(await feature.locator('[aria-live]').count(),0,'No live announcements');
        const hiddenFocusable=await slides.evaluateAll(nodes=>nodes.filter(n=>n.hidden).flatMap(n=>[...n.querySelectorAll('a,button,input,[tabindex]')]).filter(el=>el.offsetParent!==null).length);
        assert.equal(hiddenFocusable,0,'Nothing inside an inactive slide is reachable');
      }
      if(review.features.length>1){
        const live=features.filter({visible:true});
        assert.equal(await live.locator('[data-try-slide]:visible').count(),1,'One slide visible');
        assert.equal(await live.getAttribute('data-try-state'),'stopped','prefers-reduced-motion starts the rotation stopped');
        assert.equal((await live.locator('[data-try-toggle]').textContent()).trim(),'Play');
        assert.equal((await live.locator('[data-try-position]').textContent()).trim(),'1 of '+review.features.length,'Visible position');
        for(const control of ['[data-try-prev]','[data-try-toggle]','[data-try-next]']){const b=await live.locator(control).boundingBox();assert(b&&b.width>=44&&b.height>=44,'Rotation control is 44px: '+control);}
        await live.locator('[data-try-next]').click();
        assert.equal(await live.getAttribute('data-try-index'),'1','Next moves to the second lesson');
        assert.equal((await live.locator('[data-try-position]').textContent()).trim(),'2 of '+review.features.length);
        assert.equal(await live.locator('[data-try-slide]:visible').getAttribute('data-try-slide'),review.features[1].packId);
        assert.equal(await live.getAttribute('data-try-state'),'stopped','A manual selection leaves the rotation stopped');
        await live.locator('[data-try-prev]').click();assert.equal(await live.getAttribute('data-try-index'),'0');
        await page.keyboard.press('ArrowRight');assert.equal(await live.getAttribute('data-try-index'),'1','Arrow keys select while focus is inside');
        await live.locator('[data-try-toggle]').click();assert.equal(await live.getAttribute('data-try-state'),'playing','Explicit Play resumes');
        assert.equal((await live.locator('[data-try-toggle]').textContent()).trim(),'Pause');
        await live.locator('[data-try-slide]:visible a').first().focus();assert.equal(await live.getAttribute('data-try-state'),'stopped','Keyboard focus entering the rotation stops it');
        await live.locator('[data-try-toggle]').click();assert.equal(await live.getAttribute('data-try-state'),'playing');
        assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.closest('[data-try-lesson]')?document.activeElement.getAttribute('data-try-toggle')!==null:false),true,'Play keeps focus where the person put it');
        const before=await live.getAttribute('data-try-index');
        await page.mouse.move(5,5);await page.waitForTimeout(review.rotationSeconds*1000+600);
        assert.equal(await live.getAttribute('data-try-index'),String((Number(before)+1)%review.features.length),'The rotation advances once per '+review.rotationSeconds+' seconds while playing');
        await live.locator('[data-try-toggle]').click();assert.equal(await live.getAttribute('data-try-state'),'stopped');
      }
      const entrances=await page.locator('.fd-audience-entry a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
      assert.deepEqual(entrances,[record.audiences.teachers.route,record.audiences.pupils.route,record.audiences.parents.route],'Teachers, pupils and families have direct entrances');
      assert.equal(await page.locator('#audiences details summary').textContent(),'Working with schools and organisations');
      const subjects=await page.locator('[data-subject-tiles] a').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href'),icons:e.querySelectorAll('svg.fd-icon').length,height:e.getBoundingClientRect().height})));
      assert.deepEqual(subjects.map(s=>s.href.split('subject=')[1]),['science','humanities-re','art-studio','lifeskills'].filter(slug=>rows.some(r=>rules.cardOf(r)===slug)),'Homepage features the four actual subject groups');
      for(const s of subjects){assert.equal(s.icons,1,'Each featured subject has a vector icon');assert(s.height<=100,'Featured subjects remain compact');}
      const previews=await page.locator('main img[data-preview-source]').evaluateAll(es=>es.map(e=>({source:e.dataset.previewSource,sha:e.dataset.previewSha,complete:e.complete,width:e.naturalWidth})));
      for(const p of previews){assert(p.complete&&p.width>0,'Real preview decodes');const found=rows.some(r=>r.files?.some(f=>f.type==='pdf'&&f.path===p.source));assert(found,'Preview comes from a real PDF record');const bytes=await(await page.request.get(origin+'/Lessons/'+encodeURI(p.source))).body();assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'),p.sha,'Preview source has the reviewed PDF bytes');}
      assert.equal(await page.locator('main img:not([data-preview-source]):not([data-hero-source])').count(),0,'No unproven or invented homepage pictures');
      const sources=await page.locator('#added-rail .acard').evaluateAll(es=>es.map(e=>({file:e.dataset.resourcePath,title:e.querySelector('h3').textContent,desc:e.querySelector('p')?.textContent||'',interactive:!!e.querySelector('.fd-interactive')})));
      assert(sources.length>0&&sources.length<=3);for(const c of sources){const r=rows.find(r=>(r.file||r.url)===c.file);assert(r);assert.equal(c.title,displayTitle(r));assert.equal(c.desc,r.desc||r.description||'');assert.equal(c.interactive,/\.html(?:[?#]|$)/i.test(c.file));}
      require('node:fs').mkdirSync('audit-output/education-navigation/homepage-repair',{recursive:true});
      await page.screenshot({path:'audit-output/education-navigation/homepage-repair/home-'+width+'.png',fullPage:true});
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
  await page.goto(origin+'/');await page.waitForLoadState('networkidle');
  for(const f of review.features){
    await page.goto(origin+'/');await page.waitForLoadState('networkidle');
    const live=page.locator('[data-featured-lesson]:visible');
    while((await live.locator('[data-try-slide]:visible').getAttribute('data-try-slide'))!==f.packId) await live.locator('[data-try-next]').click();
    await live.locator('[data-try-slide]:visible').getByRole('link',{name:'Get the teaching pack →',exact:true}).click();
    await page.locator('#delivery').waitFor({state:'visible'});
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,f.packRoute,'The pack link opens the bound pack page');
    assert.equal((await page.locator('h1').first().textContent()).trim(),f.displayTitle,'The pack page is the bound pack');
    assert.equal(await page.locator('#delivery').getAttribute('href'),f.lessonRoute,'The pack page teaches the same lesson');
    report.cases.push({route:'featured lesson '+f.packId+' to its pack page',status:'PASS'});
  }
  const staticContext=await page.context().browser().newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  try {
    const staticPage=await staticContext.newPage();await staticPage.goto(origin+'/');
    assert.equal(await staticPage.locator('[data-featured-lesson]:visible').count(),1,'The verified feature works without JavaScript');
    assert.equal(await staticPage.locator('[data-featured-lesson]:visible [data-try-slide]:visible').count(),1,'Without JavaScript one linked card renders');
    assert.equal(await staticPage.locator('[data-featured-lesson]:visible [data-try-slide]:visible').getAttribute('data-try-slide'),review.features[0].packId,'The no-script card is the first eligible lesson');
    assert.equal(await staticPage.locator('[data-featured-lesson]:visible [data-try-controls]:visible, [data-featured-lesson]:visible [data-try-position]:visible').count(),0,'No rotation controls without the script');
    assert.equal(await staticPage.locator('[data-subject-tiles] a').count(),4,'Static subject browsing remains available');
    assert.equal(await staticPage.locator('.fd-audience-entry a').count(),3,'Static audience routes remain available');
    assert.equal(await staticPage.locator('main img[data-hero-source]').count(),1,'Hero artwork renders without the script');
    await staticPage.locator('[data-featured-lesson]:visible').getByRole('link',{name:'Try this lesson →',exact:true}).click();
    assert(await staticPage.getByRole('heading',{name:review.features[0].displayTitle,exact:true}).first().isVisible(),'Feature launches the actual lesson without JavaScript');
    report.cases.push({width:390,route:'/',javascript:false,status:'PASS'});
  } finally {await staticContext.close();}
  await page.setViewportSize({width:390,height:844});return report;
};
