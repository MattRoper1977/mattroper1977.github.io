/* SW2 H/U: rendered source-backed data, layout and pupil search controls.
 * Runs within the existing UX2 B5 browser and keeps all B5 red proofs.
 * EDU-D3 (CX2 §5): proves the hero artwork by digest on the teacher front door at every width.
 * J93 (rulings uz-6 (h), vb-3 (e)): the homepage / is the bound J93 draft of record
 * (domain-split/home/home.html via home_slots.py). Each retired homepage assertion is replaced
 * by the J93 element that took its place, never just deleted:
 *   hero data-hero-source / data-hero-sha      -> the four door cards (record routes, labels, bylines)
 *   data-try-slide / data-featured-lesson      -> the three flagship cards (registry rows, hub rules,
 *                                                 9 badges, lesson links, pathway switch, no-script)
 *   the legacy h1 / eyebrow / lead / provenance -> the one J93 h1 and the masthead credit
 *   home search input / previews / added rail   -> header search to /resources/#rxSearch, the one
 *                                                 approved emblem, 0 What's new
 * The teacher and pupil branches are unchanged. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
// J93: the records the homepage is bound from, read from the repo (never retyped here).
const PATHWAYS = ['BUILD', 'GROW', 'LAUNCH'];
const DOOR_KEYS = ['pupils', 'teachers', 'parents', 'schools']; // home_slots.DOOR_KEYS
const HOME_DRAFT = fs.readFileSync(path.join(__dirname, 'home/home.html'), 'utf8');
const CHROME_HEADER = fs.readFileSync(path.join(__dirname, '..', 'tools/chrome/header.html'), 'utf8');
const EMBLEM = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets/brand/approved-mark-provenance.json'), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// G1 (gates review F1): the flagship of record and its spec fallback, pinned in the fixture (never taken from the page).
const FLAGSHIP_OF_RECORD = JSON.parse(fs.readFileSync(path.join(__dirname, 'ux2/appendix-a-site.json'), 'utf8')).homeFlagship;
const squash = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
exports.verify = async ({page, origin, rules, record}) => {
  const rows = await (await page.request.get(origin+'/Lessons/resources.json')).json();
  const response = await page.request.get(origin+'/Lessons/assets/catalogue/display-titles.json');
  const titleMap = response.ok() ? await response.json() : null;
  const displayTitle = r => {const e=titleMap?.schema===1&&titleMap.entries?.[r.file||r.url];return e&&e.id===(r.id||'')&&e.originalTitle===r.title?e.displayTitle:r.title;};
  const report = {cases:[], previews:0, brokenImages:0, otherAudienceBodies:'checked separately by exact output comparison'};
  // J93: the draft's typed owner words (masthead, door and pathway bylines, credit), parsed by the browser.
  await page.goto(origin+'/'); await page.waitForLoadState('networkidle');
  const draft = await page.evaluate(([tpl, header]) => {
    const d = new DOMParser().parseFromString(tpl, 'text/html'), t = e => e ? e.textContent.replace(/\s+/g, ' ').trim() : null;
    const s = header.indexOf('<!-- MBM-CHROME-FRAGMENT: published-education -->'), e = header.indexOf('<!-- /MBM-CHROME-FRAGMENT: published-education -->');
    const frag = s >= 0 && e > s ? new DOMParser().parseFromString(header.slice(s, e), 'text/html').querySelectorAll('strong') : [];
    return {masthead: t(d.querySelector('h1#home-title')), doorBylines: [...d.querySelectorAll('.home-door-byline')].map(t),
      pathwayBylines: [...d.querySelectorAll('.home-pathway-byline')].map(t), credit: frag.length === 1 ? t(frag[0]) : null};
  }, [HOME_DRAFT, CHROME_HEADER]);
  assert(draft.masthead && draft.credit && draft.doorBylines.length === 4 && draft.pathwayBylines.length === 3, 'MEASUREMENT INVALID: the J93 draft or the chrome credit could not be read');
  // J93: what the homepage's flagship strip must show, from the Lessons hub's own rules (hub.js, as home_hub_counts.cjs runs it).
  const flagshipView = await page.locator('main article.home-pathway-card[data-pathway-card]').evaluateAll(es => es.map(e => ({
    week: e.querySelector('.home-pathway-week')?.textContent.trim(), link: e.querySelector('a.home-card-link')?.getAttribute('href')})));
  const weekLabel = flagshipView[0]?.week, flagshipSlug = (flagshipView[0]?.link || '').split('subject=')[1];
  assert(weekLabel && flagshipSlug, 'J93 flagship cards are present (week label and subject hub link)');
  await page.goto(origin+'/Lessons/subject.html?subject='+encodeURIComponent(flagshipSlug)); await page.waitForLoadState('networkidle');
  const hub = await page.evaluate(async ({slugs, flagshipSlug, weekLabel, pathways, specs}) => {
    const H = window.MBM_HUB; if (!H) return null;
    const state = await H.loadAll(), cards = H.cardsFromRows(state.rows), card = q => cards.find(c => c.slug === H.slugForQuery(q));
    const registry = new Set((await (await fetch('resources.json')).json()).map(r => r.file || r.url));
    const entries = (state.order && state.order.entries) || {};
    const fc = card(flagshipSlug);
    return {terms: H.HALF_TERMS.slice(), counts: Object.fromEntries(slugs.map(q => [q, card(q) ? H.distinctLessons(card(q).rows) : null])),
      flagship: pathways.map(t => (fc ? fc.rows : []).filter(H.isLesson).filter(r => registry.has(r._path) && String(r._tier) === t).flatMap(r =>
        ((entries[r._path] && entries[r._path].weeks) || []).filter(w => w && w.label === weekLabel).map(w => ({file: r._path, title: H.displayTitle(r), desc: r.desc == null ? null : String(r.desc), term: w.term, week: w.week})))),
      // G1: how each week of record resolves on the hub, by term and week number (never by the page's label).
      pageSlug: H.slugForQuery(flagshipSlug), recordSlugs: specs.map(s => H.slugForQuery(s.subject)),
      ofRecord: specs.map(s => pathways.map(t => (card(s.subject) ? card(s.subject).rows : []).filter(H.isLesson).filter(r => registry.has(r._path) && String(r._tier) === t).flatMap(r =>
        ((entries[r._path] && entries[r._path].weeks) || []).filter(w => w && w.term === s.term && w.week === s.week).map(w => ({file: r._path, label: w.label})))))};
  }, {slugs: ['science','humanities-re','art-studio','lifeskills'], flagshipSlug, weekLabel, pathways: PATHWAYS, specs: [FLAGSHIP_OF_RECORD.ofRecord, FLAGSHIP_OF_RECORD.fallback]});
  assert(hub, 'MEASUREMENT INVALID: the Lessons hub (window.MBM_HUB) did not load');
  assert.deepEqual(hub.flagship.map(f => f.length), [1, 1, 1], 'The flagship week resolves to exactly one registry lesson per pathway on the hub');
  const flagship = hub.flagship.map(f => f[0]);
  assert.equal(new Set(flagship.map(f => f.term + ':' + f.week)).size, 1, 'The three flagship lessons are one week of the lesson order');
  // G1: the homepage flagship is the week of record (Science, Autumn 2 Week 6) whenever that week resolves on the hub to
  // one registry lesson per pathway under one label; only otherwise the spec fallback (Humanities & RE, Autumn 2 Week 1).
  const resolves = weeks => weeks.every(p => p.length === 1) && new Set(weeks.map(p => p[0].label)).size === 1;
  const due = resolves(hub.ofRecord[0]) ? 0 : resolves(hub.ofRecord[1]) ? 1 : -1;
  assert(due >= 0, 'Neither the flagship of record nor its spec fallback resolves on the Lessons hub');
  const spec = due === 0 ? FLAGSHIP_OF_RECORD.ofRecord : FLAGSHIP_OF_RECORD.fallback;
  assert.equal(hub.pageSlug, hub.recordSlugs[due], 'The homepage flagship subject is the subject of record (' + spec.subject + ')');
  assert.deepEqual(flagship.map(f => f.term + ':' + f.week), PATHWAYS.map(() => spec.term + ':' + spec.week), 'The homepage flagship week is the week of record (' + spec.term + ' Week ' + spec.week + ')');
  assert.equal(weekLabel, hub.ofRecord[due][0][0].label, 'The homepage flagship week label is the hub label of the week of record');
  assert.deepEqual(flagship.map(f => f.file), hub.ofRecord[due].map(p => p[0].file), 'The three flagship lessons are the registry lessons of the week of record');
  for (const f of flagship) { const r = rows.find(r => (r.file || r.url) === f.file); assert(r, 'Flagship lesson is a registry row'); f.row = r; f.href = '/Lessons/' + encodeURI(f.file); f.served = (await page.request.get(origin + f.href)).ok(); }
  for(const width of [320,390,900,1280]) for(const route of ['/','/for/teachers/','/for/pupils/']) {
    if(width===320&&route!=='/')continue; // New narrow-screen coverage is for the changed homepage.
    await page.setViewportSize({width,height:900}); await page.goto(origin+route); await page.waitForLoadState('networkidle');
    // A visually hidden element (absolute, 1px box, clipped to nothing, e.g. the card separator .fd-sep) paints
    // nothing, so its scroll width is not overflow anyone can see; everything else is still measured.
    const measure = async () => page.evaluate(() => ({
      overflow:[document.documentElement,...document.querySelectorAll('main *')].filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='inline'&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+1).filter(e=>{const s=getComputedStyle(e);return !(e.matches('#added-rail .acard p')&&s.textOverflow==='ellipsis'&&s.overflowX==='hidden'&&s.whiteSpace==='nowrap'&&e.getBoundingClientRect().height<=parseFloat(s.lineHeight)+1)}).filter(e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return !(s.position==='absolute'&&s.overflowX==='hidden'&&s.clipPath==='inset(50%)'&&b.width<=1&&b.height<=1)}).map(e=>e.id||e.className||e.tagName),
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
    // J93: the homepage hero is retired; its place is the four door cards, asserted in the '/' branch below.
    assert.equal(heroes.length,{'/':0,'/for/teachers/':1,'/for/pupils/':0}[route],'Hero artwork count: '+route);
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
      // J93 (legacy h1, eyebrow, lead, provenance -> the one J93 h1 and the masthead credit).
      assert.equal(await page.locator('h1').count(),1,'The homepage has exactly one h1');
      assert.equal(await page.locator('main .home-masthead h1#home-title.home-descriptor').count(),1,'The one h1 is the J93 masthead descriptor');
      assert.equal(squash(await page.locator('main h1#home-title').textContent()),draft.masthead,'The h1 is the masthead string of the draft of record');
      assert.equal(squash(await page.locator('head meta[name="description"]').getAttribute('content')),draft.masthead,'The description is the masthead string');
      assert.equal(await page.locator('main .home-masthead [data-slot="brand.credit"]').count(),1,'The masthead carries the credit once (no duplicate nearby provenance)');
      assert.equal(squash(await page.locator('main .home-masthead .home-brand-credit strong').textContent()),draft.credit,'The masthead credit is the chrome header credit');
      // J93 (home search input -> the header search control; still no in-page form).
      assert.equal(await page.locator('main form').count(),0,'Homepage has no in-page form');
      assert.equal(await page.locator('main input').count(),0,'Homepage search is the header control, not an in-page input');
      assert.deepEqual(await page.locator('[data-mbm-navigation="education"] a.mbm-unified-search').evaluateAll(es=>es.map(e=>e.getAttribute('href'))),['/resources/#rxSearch'],'The header search control targets /resources/#rxSearch');
      // J93 (hero data-hero-source / data-hero-sha -> the four door cards, from the record by key).
      const doors=await page.locator('main #doors a.home-door-card').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();
        return {href:e.getAttribute('href'),label:e.querySelector('h3')?.textContent.replace(/\s+/g,' ').trim(),byline:e.querySelector('.home-door-byline')?.textContent.replace(/\s+/g,' ').trim(),icons:e.querySelectorAll('.home-door-icon svg').length,width:b.width};}));
      assert.equal(await page.locator('main a.home-door-card').count(),4,'Exactly four door cards');
      assert.deepEqual(doors.map(d=>d.href),DOOR_KEYS.map(k=>record.audiences[k].route),'The door cards are the record routes, in key order');
      assert.deepEqual(doors.map(d=>d.label),DOOR_KEYS.map(k=>squash(record.audiences[k].label)),'The door cards carry the record labels');
      assert.deepEqual(doors.map(d=>d.byline),draft.doorBylines,'The door bylines are the owner words of the draft of record');
      for(const d of doors){assert.equal(d.icons,1,'Each door card has one vector icon');assert(d.width>0&&d.width<=page.viewportSize().width,'Door card fits the viewport');}
      const doorsClear=await page.locator('main a.home-door-card').evaluateAll(es=>es.map(e=>{e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return !!hit&&(hit===e||e.contains(hit));}));
      assert.deepEqual(doorsClear,[true,true,true,true],'Nothing overlaps a door card');
      for(const d of doors) assert((await page.request.get(origin+d.href)).ok(),'Door route is served: '+d.href);
      // J93 (data-try-slide / data-featured-lesson -> the three flagship cards).
      const cards=await page.locator('main #pathways article.home-pathway-card[data-pathway-card]').evaluateAll(es=>es.map(e=>{const t=s=>{const n=e.querySelector(s);return n?n.textContent.replace(/\s+/g,' ').trim():null;};
        return {key:e.getAttribute('data-pathway-card'),chip:t('.home-pathway-badge'),week:t('.home-pathway-week'),byline:t('.home-pathway-byline'),title:t('h3.home-unit-title'),outcome:t('.home-unit-outcome'),
          link:e.querySelector('a.home-card-link')?.getAttribute('href'),linkName:t('a.home-card-link [data-slot="flagship.subject.name"]'),
          badges:[...e.querySelectorAll('ul.home-pack-badges > li')].map(li=>({cls:li.className,fixed:li.getAttribute('data-fixed'),href:li.querySelector('a')?.getAttribute('href')||null,ext:li.querySelector('[data-derive="ext"]')?.textContent.trim(),label:li.querySelector('[data-derive="label"]')?.textContent.trim()}))};}));
      assert.deepEqual(cards.map(c=>c.key),PATHWAYS,'Three flagship cards, BUILD, GROW, LAUNCH in order');
      assert.deepEqual(cards.map(c=>c.chip),PATHWAYS,'Each flagship card names its pathway');
      assert.deepEqual(cards.map(c=>c.byline),draft.pathwayBylines,'The pathway bylines are the owner words of the draft of record');
      const kicker=await page.locator('main #pathways .home-kicker').evaluate(e=>({name:e.querySelector('[data-slot="flagship.subject.name"]')?.textContent.trim(),week:e.querySelector('[data-slot="flagship.flagshipWeek"]')?.textContent.trim()}));
      const hubRoute='/Lessons/subject.html?subject='+flagshipSlug;
      const tileName=await page.locator('main a.home-subject-tile[href="'+hubRoute+'"] h3').textContent();
      assert.deepEqual(kicker,{name:tileName.trim(),week:weekLabel},'The flagship kicker names the flagship subject hub and its week');
      for(let i=0;i<3;i++){const c=cards[i],f=flagship[i],r=f.row;
        assert.equal(rules.tierOf(r),c.key,'Flagship lesson is on its pathway (hub tierOf): '+c.key);
        assert.equal(rules.cardOf(r),flagshipSlug,'Flagship lesson is on the flagship subject hub (hub cardOf): '+c.key);
        assert.equal(c.title,squash(f.title),'Flagship title is the hub display title: '+c.key);assert.equal(c.title,squash(displayTitle(r)),'Flagship title follows the display-titles rule: '+c.key);
        assert.equal(c.outcome,squash(r.desc),'Flagship outcome is the registry row description: '+c.key);
        assert.equal(c.week,weekLabel,'Each flagship card shows the one flagship week');
        assert.equal(c.link,hubRoute,'The card link is the flagship subject hub');assert.equal(c.linkName,tileName.trim());
        // vb-3 (a): a lesson missing from the tree links the subject hub instead.
        const lessonHref=f.served?f.href:hubRoute;
        assert.equal(c.badges.length,9,'Each flagship card has 9 badges (the lesson + 8 pack members): '+c.key);
        const [lesson,...members]=c.badges;
        assert.deepEqual([lesson.fixed,lesson.href,lesson.ext,lesson.label],['true',lessonHref,'HTML','Interactive Lesson'],'The first badge is the fixed lesson badge and links the lesson: '+c.key);
        assert(lesson.cls.split(' ').includes('home-format-html'));
        const code=f.file.split('/').pop().replace(/\.[^.]+$/,''),folder=f.file.split('/').slice(0,-1).join('/');
        const names=members.map(m=>code+'_'+String(m.label).replace(/ /g,'_')+'.'+String(m.ext).toLowerCase());
        assert.deepEqual(names,[...names].sort(),'Pack badges are in file-name order: '+c.key);
        for(let k=0;k<members.length;k++){const m=members[k];
          assert(m.fixed===null&&m.href===null,'A pack badge is a label, not a link');assert(m.cls.split(' ').includes('home-format-'+String(m.ext).toLowerCase()),'Badge format class follows its extension');
          assert(!/\.(jpe?g|png|gif|svg|webp)$/i.test(names[k])&&names[k]!=='approved-mark.jpg','No image is a pack badge');
          assert((await page.request.get(origin+'/Lessons/'+encodeURI(folder+'/'+names[k]))).ok(),'Pack badge is a served member of the lesson folder: '+c.key+' '+k);}
        assert((await page.request.get(origin+lessonHref)).ok(),'Flagship lesson link resolves: '+c.key);}
      // The pathway switch (replaces the rotation controls): revealed by the script, 44px, filters without motion or announcements.
      const sw=page.locator('main #pathways [data-pathway-switch]');
      assert.equal(await sw.count(),1);assert(await sw.isVisible(),'The script reveals the pathway switch');
      assert.deepEqual(await sw.locator('[data-pathway-btn]').evaluateAll(es=>es.map(e=>e.getAttribute('data-pathway-btn'))),['ALL',...PATHWAYS]);
      for(const k of ['ALL',...PATHWAYS]){const b=await sw.locator('[data-pathway-btn="'+k+'"]').boundingBox();assert(b&&b.width>=44&&b.height>=44,'Pathway switch control is 44px: '+k);}
      const shown=async()=>page.locator('main article.home-pathway-card[data-pathway-card]:visible').evaluateAll(es=>es.map(e=>e.getAttribute('data-pathway-card')));
      const pressed=async()=>sw.locator('[data-pathway-btn]').evaluateAll(es=>es.filter(e=>e.getAttribute('aria-pressed')==='true').map(e=>e.getAttribute('data-pathway-btn')));
      assert.deepEqual([await shown(),await pressed()],[PATHWAYS,['ALL']],'All three cards show and All is pressed on load');
      for(const k of PATHWAYS){await sw.locator('[data-pathway-btn="'+k+'"]').click();
        assert.deepEqual([await shown(),await pressed()],[[k],[k]],'The switch shows only the chosen pathway: '+k);
        assert.equal(await page.locator('main article.home-pathway-card[hidden]').evaluateAll(ns=>ns.flatMap(n=>[...n.querySelectorAll('a,button,input,[tabindex]')]).filter(el=>el.offsetParent!==null).length),0,'Nothing inside a hidden card is reachable');}
      await sw.locator('[data-pathway-btn="ALL"]').focus();await page.keyboard.press('Enter');
      assert.deepEqual([await shown(),await pressed()],[PATHWAYS,['ALL']],'The keyboard selects All again');
      assert.equal(await page.locator('main #pathways [aria-live]').count(),0,'No live announcements');
      // Subject tiles (rewritten): the four groups, each with its icon, the hub's own count and the hub's six half-terms.
      const subjects=await page.locator('main a.home-subject-tile').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href'),icons:e.querySelectorAll('.home-subject-icon svg').length,width:e.getBoundingClientRect().width,count:e.querySelector('.home-subject-count strong')?.textContent.trim(),terms:[...e.querySelectorAll('ul.home-halfterm-strip > li')].map(li=>li.textContent.trim())})));
      assert.deepEqual(subjects.map(s=>s.href.split('subject=')[1]),['science','humanities-re','art-studio','lifeskills'].filter(slug=>rows.some(r=>rules.cardOf(r)===slug)),'Homepage features the four actual subject groups');
      for(const s of subjects){const slug=s.href.split('subject=')[1];assert.equal(s.icons,1,'Each featured subject has a vector icon');assert(s.width<=page.viewportSize().width,'Subject tile fits the viewport');
        assert.equal(s.count,String(hub.counts[slug]),'Tile count is the hub distinctLessons: '+slug);assert.deepEqual(s.terms,hub.terms,'Tile half-terms are the hub HALF_TERMS: '+slug);}
      // J93 (previews / "no unproven pictures"): the one picture is the approved emblem at its provenance bytes.
      const imgs=await page.locator('main img').evaluateAll(es=>es.map(e=>({src:e.getAttribute('src'),alt:e.getAttribute('alt'),complete:e.complete,w:e.naturalWidth})));
      assert.deepEqual(imgs.map(i=>[i.src,i.alt]),[['/assets/brand/'+EMBLEM.file,'']],'The one homepage picture is the approved emblem, decorative');
      assert(imgs[0].complete&&imgs[0].w>0,'The emblem decodes');
      assert.equal(sha256(await(await page.request.get(origin+'/assets/brand/'+EMBLEM.file)).body()),EMBLEM.sha256,'Served emblem bytes match its provenance record');
      // J93 (added-this-half-term rail -> What's new omitted, uz-6 (f)); the flagship rows above carry the title/description rule.
      assert.deepEqual([await page.locator('#whats-new').count(),await page.locator('#added-rail, .home-update-item').count()],[0,0],"No What's new section and no added rail");
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
  // J93 (featured lesson -> its pack page): each flagship card's lesson badge opens its lesson, and the card link opens its hub.
  const hubRoute='/Lessons/subject.html?subject='+flagshipSlug;
  for(let i=0;i<3;i++){const f=flagship[i],lessonHref=f.served?f.href:hubRoute;
    await page.goto(origin+'/');await page.waitForLoadState('networkidle');
    const card=page.locator('main article.home-pathway-card[data-pathway-card="'+PATHWAYS[i]+'"]');
    const [lessonNav]=await Promise.all([page.waitForNavigation(),card.locator('li[data-fixed] a').click()]);
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,new URL(origin+lessonHref).pathname+new URL(origin+lessonHref).search,'The lesson badge opens the bound lesson: '+PATHWAYS[i]);
    assert(lessonNav&&lessonNav.ok()&&/text\/html/.test(lessonNav.headers()['content-type']||''),'The bound lesson page is served: '+PATHWAYS[i]);
    await page.goto(origin+'/');await page.waitForLoadState('networkidle');
    const [hubNav]=await Promise.all([page.waitForNavigation(),card.locator('a.home-card-link').click()]);
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,hubRoute,'The card link opens the flagship subject hub: '+PATHWAYS[i]);
    assert(hubNav&&hubNav.ok(),'The flagship subject hub is served');
    report.cases.push({route:'flagship '+PATHWAYS[i]+' to its lesson and hub',status:'PASS'});
  }
  const staticContext=await page.context().browser().newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  try {
    const staticPage=await staticContext.newPage();await staticPage.goto(origin+'/');
    assert.deepEqual(await staticPage.locator('main article.home-pathway-card[data-pathway-card]:visible').evaluateAll(es=>es.map(e=>e.getAttribute('data-pathway-card'))),PATHWAYS,'The three flagship cards render without JavaScript');
    assert.deepEqual(await staticPage.locator('main article.home-pathway-card').evaluateAll(es=>es.map(e=>e.querySelectorAll('ul.home-pack-badges > li').length)),[9,9,9],'Without JavaScript every card keeps its 9 badges');
    assert.equal(await staticPage.locator('main [data-pathway-switch]:visible').count(),0,'No pathway switch without the script');
    assert.equal(await staticPage.locator('main a.home-subject-tile').count(),4,'Static subject browsing remains available');
    assert.deepEqual(await staticPage.locator('main a.home-door-card').evaluateAll(es=>es.map(e=>e.getAttribute('href'))),DOOR_KEYS.map(k=>record.audiences[k].route),'Static door cards remain available');
    assert.equal(await staticPage.locator('main img[data-hero-source]').count(),0,'No hero artwork on the J93 homepage');
    assert.equal(await staticPage.locator('main img.home-emblem').count(),1,'The emblem renders without the script');
    const [staticNav]=await Promise.all([staticPage.waitForNavigation(),staticPage.locator('main article.home-pathway-card[data-pathway-card="BUILD"] li[data-fixed] a').click()]);
    const first=flagship[0].served?flagship[0].href:hubRoute;
    assert(staticNav&&staticNav.ok()&&new URL(staticPage.url()).pathname===new URL(origin+first).pathname,'The flagship lesson launches without JavaScript');
    report.cases.push({width:390,route:'/',javascript:false,status:'PASS'});
  } finally {await staticContext.close();}
  report.home={doors:4,cards:PATHWAYS.length,badges:[9,9,9],counts:Object.values(hub.counts),flagshipWeek:flagship[0].term+':'+flagship[0].week};
  await page.setViewportSize({width:390,height:844});return report;
};
