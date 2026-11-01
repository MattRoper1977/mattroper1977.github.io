/* Repository browser acceptance for the Play overlay. Every check records its
 * actual scope; route-start sampling is not a full playthrough of 69 engines.
 * UX2 C4 (2026-09-08): re-pinned to the one-DOM shelf — a server-rendered
 * "All games" grid (every catalogue game exactly once, series collapsed), a
 * static Featured card, lanes rendered from the inline data, a Filters drawer
 * and a game sheet. Counts are derived from play-discovery.json, never typed;
 * TX play shelf navigation v1 (2026-10-21): the grid became one scroll-snapped
 * shelf per category (Classroom first, holding the classroom games AND the
 * activities), Featured became a Spotlight of every featured row with a Next
 * control, the lanes were retired, chips are categories plus Keyboard/Touch,
 * and cards carry Play only -- the sheet now opens from ?game= and Surprise me.
 * the grid-coverage limb carries its own planted-defect control so a green
 * here is a proof, not a vacancy. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.env.PLAY_REVIEW_URL||'http://127.0.0.1:4173',out=path.resolve('.play-review/qa'),root=path.resolve('.play-review/output');fs.mkdirSync(out,{recursive:true});
const data=JSON.parse(fs.readFileSync(path.join(root,'games/data/play-discovery.json'))),build=JSON.parse(fs.readFileSync(path.join(root,'build-report.json')));
const preserved=JSON.parse(fs.readFileSync('reports/play-upgrade/preservation.json')),baselineHashes=new Map(preserved.payloads.map(p=>[p.path,p.published_sha256]));
// Re-derive approved source revisions from the actual checkouts before accepting HTTP bytes.
const selectedRevisions=JSON.parse(require('node:child_process').execFileSync('python3',['domain-split/play/source_revisions.py','--output',root],{encoding:'utf8'}));
for(const [route,revision] of Object.entries(selectedRevisions))baselineHashes.set(route,revision.published_sha256);
const report={date:new Date().toISOString(),checks:[],sourceRevisions:selectedRevisions,routes:[],limitations:['Route coverage proves initial rendered state and available input surface, not completion of every game.','Source-supported control labels do not certify physical gamepad, real-device performance or two-device local pairing.'],errors:[]};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let currentPage=null;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
// Populations, derived from the data the page was built from.
const catalogue=data.games.filter(g=>g.group==='games'),activities=data.games.filter(g=>g.group!=='games');
// AK10-AB: the Spotlight is the one spotlight row, then every featured row, in manifest order.
const spotRows=[...catalogue.filter(g=>g.spotlight),...catalogue.filter(g=>g.featured&&!g.spotlight)];
const routesOf=rows=>new Set(rows.map(g=>g.route));
const normalizeWord=v=>String(v).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const seriesLeads=new Set(catalogue.filter(g=>g.editions&&g.editions.find(id=>catalogue.some(c=>c.id===id))===g.id).map(g=>g.id));
const expectedCards=catalogue.filter(g=>!g.editions||seriesLeads.has(g.id)).length;
const genreCount=name=>catalogue.filter(g=>g.genre===name).length;
const EMBER='game-emberwild',emberwild=catalogue.find(g=>g.id===EMBER);assert(emberwild,'Emberwild is the fixture game');
// The grid must list every catalogue href exactly once — as a card's Play or as a
// collapsed edition's Play inside its lead card — and nothing that is not a catalogue game.
function coverage(hrefs,routes){const seen=new Map();for(const h of hrefs)seen.set(h,(seen.get(h)||0)+1);const twice=[...seen].filter(([,n])=>n>1).map(([h])=>h),missing=[...routes].filter(r=>!seen.has(r)),extra=[...seen.keys()].filter(h=>!routes.has(h));assert(!twice.length&&!missing.length&&!extra.length,'grid coverage: twice='+JSON.stringify(twice)+' missing='+JSON.stringify(missing)+' extra='+JSON.stringify(extra));return seen.size;}
function coverageControl(hrefs){// Planted defect: drop one game from a scratch copy of the data; the limb must bite.
 const dropped=new Set(routesOf(catalogue));dropped.delete(emberwild.route);let bit=false;try{coverage(hrefs,dropped);}catch(_){bit=true;}assert(bit,'coverage control did not bite when a game was dropped from the data');
 const doubled=[...hrefs,emberwild.route];let bit2=false;try{coverage(doubled,routesOf(catalogue));}catch(_){bit2=true;}assert(bit2,'coverage control did not bite when a card was duplicated');return{droppedGameRefused:true,duplicateCardRefused:true};}
async function test(name,fn){try{report.checks.push({name,pass:true,evidence:await fn()});}catch(e){report.checks.push({name,pass:false,error:e.stack});if(currentPage&&!currentPage.isClosed()){await currentPage.screenshot({path:path.join(out,name+'-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,name+'-failure.txt'),await currentPage.locator('body').innerText().catch(()=>''));}}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
async function overflow(page){const proof=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,culprits:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>document.documentElement.clientWidth+1&&e.getClientRects().length&&!e.closest('.shelf-track,.chip-row')).slice(0,8).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right}))}));assert(proof.scroll<=proof.width+1,'Horizontal overflow '+JSON.stringify(proof));}
function visible(page){return page.locator('#game-grid [data-card]:visible');}
async function visibleGames(page){return page.evaluate(()=>[...document.querySelectorAll('#game-grid [data-card]')].filter(e=>!e.hidden).reduce((n,e)=>n+e.dataset.games.split(' ').length,0));}
async function gridHrefs(page){return page.evaluate(()=>[...document.querySelectorAll('#game-grid [data-card] a[data-play][href]')].map(a=>a.getAttribute('href')));}
async function noMedia(requests){assert(!requests.some(u=>/\.(mp4|webm)(\?|$)/.test(u)),'Video requested before selection');assert(!requests.some(u=>/supabase|google-analytics|goatcounter|ko-fi|kofi/i.test(u)),'Unexpected tracking or support widget');}
function firstParty(requests){const foreign=requests.filter(u=>!u.startsWith(base+'/')&&!u.startsWith('data:'));assert.equal(foreign.length,0,'Requests left the review origin: '+JSON.stringify(foreign.slice(0,5)));assert(!requests.some(u=>/madebymatt\.uk/.test(u)),'A load reached madebymatt.uk');return requests.length;}
async function targets(page,scope){// Every visible interactive control inside `scope` is at least 44x44.
 const small=await page.evaluate(sel=>{const root=sel?document.querySelector(sel):document;return[...root.querySelectorAll('a[href],button,input,select,summary')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return{t:e.tagName,id:e.id,cls:String(e.className).slice(0,30),text:(e.textContent||'').trim().slice(0,24),w:Math.round(r.width),h:Math.round(r.height)};}).filter(x=>x.w<43.5||x.h<43.5);},scope);assert.equal(small.length,0,'Targets under 44px in '+(scope||'page')+': '+JSON.stringify(small.slice(0,8)));}
async function ready(page){await page.waitForSelector('#spot-status:not([hidden])',{state:'attached'});}
async function settledShelfCapture(page,file){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 // TX-3 "zero overlaps": heading vs its track, cards vs each other inside a track,
 // every card inside its track's height, adjacent shelves, and the spotlight vs the shelves.
 const geometry=await page.locator('#game-grid [data-shelf]').evaluateAll(shelves=>shelves.filter(e=>e.getClientRects().length).map(e=>{const track=e.querySelector('.shelf-track'),r=track.getBoundingClientRect(),heading=e.querySelector('.shelf-head').getBoundingClientRect();const kids=[...track.children].filter(c=>c.getClientRects().length).map(c=>c.getBoundingClientRect());let overlaps=0;for(let i=1;i<kids.length;i++){const a=kids[i-1],b=kids[i];if(a.right>b.left+1&&a.left<b.right-1&&a.bottom>b.top+1&&a.top<b.bottom-1)overlaps++;}return{id:e.id,headingTop:heading.top,headingBottom:heading.bottom,trackTop:r.top,trackBottom:r.bottom,shelfTop:e.getBoundingClientRect().top,shelfBottom:e.getBoundingClientRect().bottom,tileBottom:Math.max(...kids.map(t=>t.bottom)),cardOverlaps:overlaps};}));
 for(let i=0;i<geometry.length;i++){const g=geometry[i];assert(g.headingBottom<=g.trackTop+1,'Shelf heading overlaps its cards: '+g.id);assert(g.tileBottom<=g.trackBottom+1,'Cards escape shelf vertically: '+g.id);assert.equal(g.cardOverlaps,0,'Cards overlap inside shelf: '+g.id);if(i)assert(geometry[i-1].shelfBottom<=g.shelfTop+1,'Adjacent shelves overlap: '+g.id);}
 const spot=await page.evaluate(()=>{const s=document.querySelector('#spotlight'),g=document.querySelector('#game-grid');if(!s||!s.getClientRects().length)return null;return{spotBottom:s.getBoundingClientRect().bottom,gridTop:g.getBoundingClientRect().top};});
 if(spot)assert(spot.spotBottom<=spot.gridTop+1,'Spotlight overlaps the shelves');
 fs.writeFileSync(path.join(out,file+'-geometry.json'),JSON.stringify({shelves:geometry,spotlight:spot},null,2));
 await page.screenshot({path:path.join(out,file+'.png'),fullPage:false});
 return geometry.length;
}
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.PLAY_BROWSER_CHANNEL||'chrome',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});report.browser=browser.version();
await test('payloads-catalogue-and-initial-dependencies',async()=>{for(const p of build.payloads){assert.equal(p.published_sha256,baselineHashes.get(p.path),'Game payload changed from approved baseline: '+p.route);const r=await fetch(base+'/'+encodeURI(p.path));assert.equal(r.status,200,p.route);assert.equal(sha(Buffer.from(await r.arrayBuffer())),p.published_sha256,p.route);}assert.equal(build.counts.game_payloads,69);assert.equal(build.counts.missing_initial_load_refs,0);assert.equal(build.counts.external_initial_load_refs,0);assert.equal(data.games.length,69);assert.equal(catalogue.length,data.counts.games);assert.equal(activities.length,data.counts.activities+data.counts.staff);return {payloads:69,byteMatches:69,initialMissing:0,initialExternal:0,counts:data.counts};});
await test('reviewed-discovery-and-real-screen-bindings',async()=>{
 const review=JSON.parse(fs.readFileSync('domain-split/play/discovery-review.json')),screens=JSON.parse(fs.readFileSync('domain-split/play/screens/manifest.json'));
 const key=r=>decodeURIComponent(r).replace(/index\.html$/,'').replace(/\/$/,'');
 const omitted=JSON.parse(fs.readFileSync(path.join(root,'play-discovery-report.json'))).omitted_discovery,expectedOmissions=[];
 let reviewedRoutes=0,realScreens=0;
 for(const [route,facts] of Object.entries(review.routes)){const g=data.games.find(g=>key(g.route)===key(route));assert(g);const payload=build.payloads.find(p=>key(p.route)===key(route));
  if(facts.published_sha256!==payload.published_sha256){assert(!g.moods?.length);assert(!Object.keys(g.details||{}).length);expectedOmissions.push({route:g.route,kind:'selection',reason:'Different approved game revision'});continue;}
  assert.deepEqual(g.moods,facts.moods);assert.deepEqual(g.details,facts.details||{});reviewedRoutes++;
 }
 for(const screen of screens.screens){const g=data.games.find(g=>key(g.route)===key(screen.route)),payload=build.payloads.find(p=>key(p.route)===key(screen.route));assert(g);
  if(screen.published_sha256!==payload.published_sha256){assert.equal(g.image||'','');expectedOmissions.push({route:g.route,kind:'screen',reason:'Different approved game revision'});continue;}
  assert.equal(g.image,'/assets/play/screens/'+screen.file);const response=await fetch(base+g.image);assert.equal(response.status,200);assert.equal(sha(Buffer.from(await response.arrayBuffer())),screen.sha256);realScreens++;
 }
 const order=rows=>rows.map(x=>JSON.stringify(x)).sort();assert.deepEqual(order(omitted),order(expectedOmissions),'Every omitted optional asset must be reported');
 if(process.env.PLAY_REQUIRE_COMPLETE_DISCOVERY==='1')assert.equal(omitted.length,0,'Release-source review requires complete image and selection coverage');
 assert(!data.games.some(g=>g.image&&g.image.endsWith('.svg')),'illustrated covers cannot stand in for game captures');
 return{reviewedRoutes,realScreens,byteBound:true,omittedDiscovery:omitted,completeDiscovery:omitted.length===0};
});
await test('static-shelf-one-dom-vocabulary-and-one-count',async()=>{const html=await (await fetch(base+'/')).text();for(const word of ['In-game screenshot','Cover artwork','Ver.'])assert.equal((html.match(new RegExp(word.replace('.','\\.'),'g'))||[]).length,0,'retired vocabulary present: '+word);for(const old of ['games and activities','catalogue games ·','large-number','Choose your next adventure','Recently updated'])assert(!html.includes(old),'old shelf copy present: '+old);
 const countStatements=html.match(/<p id="result-count"[^>]*>([^<]*)<\/p>/g)||[];assert.equal(countStatements.length,1,'exactly one count statement');assert.equal(countStatements[0].replace(/<[^>]+>/g,''),catalogue.length+' games','count statement is derived from the catalogue');
 const cardIds=[...html.matchAll(/data-card="([^"]+)"/g)].map(m=>m[1]);assert.equal(cardIds.length,new Set(cardIds).size,'duplicate data-card ids');assert.equal(cardIds.length,expectedCards,'grid cards = leads + singles');
 const featuredRows=catalogue.filter(g=>g.featured);assert(featuredRows.length,'the manifest carries a featured flag');assert.equal(catalogue.filter(g=>g.spotlight).length,1,'the manifest flags exactly one spotlight row');const featured=spotRows[0];assert.deepEqual([...html.matchAll(/data-spot="([^"]+)"/g)].map(m=>m[1]),spotRows.map(g=>g.id),'Spotlight is the spotlight row, then every featured:true row, in manifest order');assert.equal((html.match(/data-feature="/g)||[]).length,0,'the single Featured card is retired');
 const gridHtml=html.slice(html.indexOf('id="game-grid"'));for(const retired of ['data-info=','data-watch=','<video','lane-track','see-all'])assert(!gridHtml.slice(0,gridHtml.indexOf('</main>')).includes(retired),'cards carry Play only; found '+retired);
 const shelfNames=[...html.matchAll(/data-shelf="([^"]+)"/g)].map(m=>m[1]);const genres=[...new Set(catalogue.map(g=>g.genre))];assert.equal(shelfNames[0],'Classroom','Classroom shelf first');assert.deepEqual([...shelfNames].sort(),[...new Set(['Classroom',...genres])].sort(),'one shelf per existing category, none invented');
 for(const g of catalogue.filter(x=>x.editions)){const n=new Set(g.editions).size;assert(html.includes('>'+n+' editions<'),'editions chip for '+g.series+' shows '+n);}
 for(const literal of ['Pick a game. <span>Make it yours.</span>','YOUR NEXT GAME STARTS HERE.','placeholder="Search games"','>Filters<','>All games<','>For your classroom<','Classroom games, whole-class quizzes and a staff training activity.','Every game, A to Z','Privacy and saved progress','Report a problem','Made by Matt Education ↗','Made by Matt Play','Optional usage statistics — off until you allow it.','Read what is counted.','>Allow<','>Keep off<','usage-client.js','>Editions<','>Your progress<','id="dialog-saves"','>Transfer saves<','>Favourite<','>Share<'])assert(html.includes(literal),'copy missing: '+literal);
 assert(!/<(a|button)[\s>][^>]*>(?:(?!<\/(a|button)>).)*<(a|button)[\s>]/s.test(html.replace(/<script[\s\S]*?<\/script>/g,'')),'nested interactive elements');
 return{cards:cardIds.length,featured:featured.route,spotlight:spotRows.length,shelves:shelfNames,countStatement:countStatements[0].replace(/<[^>]+>/g,''),retiredVocabulary:0};});
await test('launch-pages-200-metadata-schema-and-layout',async()=>{
 const unesc=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'");
 const smRes=await fetch(base+'/sitemap.xml');assert.equal(smRes.status,200,'sitemap.xml returns 200');
 const smXml=await smRes.text(),locs=[...smXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 assert.equal(locs.length,75+catalogue.length,'sitemap count increases by catalogue game count');
 assert.equal(locs.length,new Set(locs).size,'no duplicate sitemap URLs');
 let sciencePages=0;
 for(const g of catalogue){
  assert(g.launchRoute&&g.launchRoute.startsWith('/play/')&&g.launchRoute.endsWith('/'),'valid launchRoute for '+g.id);
  const fullUrl='https://www.madebymatt-play.uk'+g.launchRoute;
  assert(locs.includes(fullUrl),'sitemap includes '+fullUrl);
  const res=await fetch(base+g.launchRoute);assert.equal(res.status,200,'launch page 200: '+g.launchRoute);
  const html=await res.text(),shown=g.displayTitle||g.title;
  const tMatch=html.match(/<title>([^<]+)<\/title>/);assert(tMatch&&unesc(tMatch[1]).trim()===shown+' · Made by Matt Play','title on '+g.launchRoute);
  const dMatch=html.match(/<meta name="description" content="([^"]+)">/);assert(dMatch&&unesc(dMatch[1]).trim().length>0,'meta description on '+g.launchRoute);
  assert(html.includes('<link rel="canonical" href="'+fullUrl+'">'),'canonical URL on '+g.launchRoute);
  const poster=(g.media&&g.media.poster)||g.image||'';
  if(process.env.PLAY_REQUIRE_COMPLETE_DISCOVERY==='1')assert(poster,'complete discovery requires Job 1 poster on '+g.launchRoute);
  if(poster){
   assert(html.includes('<meta property="og:image" content="https://www.madebymatt-play.uk'+poster+'">'),'og:image poster on '+g.launchRoute);
   assert(html.includes('<meta property="og:image:width" content="640">')&&html.includes('<meta property="og:image:height" content="360">'),'640x360 og:image dimensions on '+g.launchRoute);
  }
  const ldMatch=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);assert(ldMatch,'JSON-LD present on '+g.launchRoute);
  const ld=JSON.parse(ldMatch[1]);
  assert.equal(ld['@context'],'https://schema.org');assert.equal(ld['@type'],'VideoGame');assert.equal(ld.name,shown);
  assert.equal(ld.description,unesc(dMatch[1]));assert(ld.genre,'genre in JSON-LD');assert(ld.playMode,'playMode in JSON-LD');
  assert.equal(ld.isAccessibleForFree,true);assert.equal(ld.inLanguage,'en-GB');
  for(const secId of ['guide-and-modes','controls','works-offline','badges'])assert(html.includes('id="'+secId+'"'),'missing #'+secId+' on '+g.launchRoute);
  if(g.scienceGame){sciencePages++;assert(html.includes('id="evidence-export"'),'science launch page carries #evidence-export: '+g.launchRoute);}
  else assert(!html.includes('id="evidence-export"'),'non-science launch page omits #evidence-export: '+g.launchRoute);
 }
 assert(sciencePages>0,'science launch pages verified');
 const sciSample=catalogue.find(g=>g.scienceGame),stdSample=catalogue.find(g=>!g.scienceGame);
 for(const sample of [sciSample,stdSample]){
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:width<700?844:900},reducedMotion:'reduce'}),p=await ctx.newPage();
   const reqs=[],errs=[];p.on('request',r=>reqs.push(r.url()));p.on('pageerror',e=>errs.push(e.message));
   const resp=await p.goto(base+sample.launchRoute,{waitUntil:'networkidle'});assert.equal(resp.status(),200);
   await overflow(p);await targets(p,null);firstParty(reqs);await noMedia(reqs);assert.equal(errs.length,0,'pageerrors on '+sample.launchRoute);
   await ctx.close();
  }
 }
 return{launchPages:catalogue.length,sciencePages,sitemapUrls:locs.length};
});
for(const width of [320,390,768,1280,1440]){
 const ctx=await browser.newContext({viewport:{width,height:width<700?844:900},isMobile:width<700,hasTouch:width<700,reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(10000);currentPage=page;const requests=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>report.errors.push({width,message:e.message}));
 await test(width+'-layout-navigation-and-first-load',async()=>{await page.goto(base);await ready(page);await overflow(page);
  assert.equal(await page.locator('#intro-title').innerText(),'Pick a game. Make it yours.');
  // PLAY-P1 part B: the decorative masthead motif is an inline SVG byte-bound to hero-art.json
  // (no request for hero-art.webp, no <img>, visible at every width including phones, overlapping nothing).
  const heroRecord=JSON.parse(fs.readFileSync('domain-split/play/hero-art.json')),heroFileBytes=fs.readFileSync(path.join('domain-split/play',path.basename(heroRecord.file)));
  assert.equal(sha(heroFileBytes),heroRecord.sha256,'recorded hero motif sha256 matches source file');assert.equal(heroFileBytes.length,heroRecord.bytes,'recorded hero motif byte length matches source file');
  const art=page.locator('.intro-art');assert.equal(await art.count(),1,'one hero artwork in the markup');
  const artFacts=await art.evaluate(i=>{const svg=i.querySelector('svg'),sr=svg?svg.getBoundingClientRect().toJSON():null;return{tag:i.tagName,visible:!!i.offsetParent&&getComputedStyle(i).display!=='none',ariaHidden:i.getAttribute('aria-hidden'),imgs:i.querySelectorAll('img').length,svgs:i.querySelectorAll('svg').length,viewBox:svg?svg.getAttribute('viewBox'):null,sha:i.dataset.heroSha,bytes:Number(i.dataset.heroBytes),box:i.getBoundingClientRect().toJSON(),svgBox:sr};});
  assert.equal(artFacts.tag,'DIV','inline motif container');assert.equal(artFacts.ariaHidden,'true','hero motif is decorative');assert.equal(artFacts.imgs,0,'hero motif makes no <img> request');assert.equal(artFacts.svgs,1,'hero motif inlines one <svg>');assert.equal(artFacts.sha,heroRecord.sha256);assert.equal(artFacts.bytes,heroRecord.bytes);assert.equal(artFacts.viewBox,`0 0 ${heroRecord.width} ${heroRecord.height}`);
  assert(!requests.some(u=>/hero-art/i.test(u)),'no request for retired hero-art asset');
  const retiredHero=await page.request.get(base+'/assets/play/hero-art.webp');assert.equal(retiredHero.status(),404,'retired hero-art.webp is not served');
  assert(artFacts.visible&&artFacts.svgBox&&artFacts.svgBox.width>0&&artFacts.svgBox.height>0,'hero motif shows and renders at every width');
  assert(artFacts.box.left>=-1&&artFacts.box.right<=width+1,'hero motif fits the viewport');
  assert(artFacts.box.width>=160,'hero motif renders at a useful size');
  {const overlaps=await page.evaluate(box=>[...document.querySelectorAll('#intro-title,.intro .eyebrow,.intro .lede,#discovery-form,.mood-tools,.mood-note,header,.browse-sidebar')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.left<box.right&&r.right>box.left&&r.top<box.bottom&&r.bottom>box.top;}).map(e=>e.id||e.className||e.tagName),artFacts.box);
   assert.deepEqual(overlaps,[],'hero motif overlaps nothing');}
  if(width===1280){
   const posters=await page.evaluate(async()=>{const cards=[...document.querySelectorAll('#game-grid .game-card')];const imgs=cards.map(c=>c.querySelector('.thumb img')).filter(Boolean);for(const img of imgs){img.loading='eager';if(!img.complete)await img.decode().catch(()=>{});}return{cards:cards.length,blocks:document.querySelectorAll('#game-grid .game-card .thumb-block').length,imgs:imgs.length,bad:imgs.filter(i=>!i.complete||i.naturalWidth!==640||i.naturalHeight!==360).map(i=>({src:i.getAttribute('src'),w:i.naturalWidth,h:i.naturalHeight}))};});
   assert.equal(posters.blocks,0,'every card carries a poster rather than a fallback block');assert.equal(posters.imgs,expectedCards+activities.length,'every shelf card has a poster img');assert.deepEqual(posters.bad,[],'every card poster decodes at 640x360');
  }
  assert.equal(await page.locator('.intro .lede').innerText(),'Race, explore, build or work out your next move. Find your favourite or try something unexpected—play straight in your browser.');
  const navigation=page.locator('.collection-links');
  await navigation.locator('[data-collection=favourites]').click();assert.equal(await visibleGames(page),0,'new browser favourites empty');assert.equal(await navigation.locator('[aria-current=page]').getAttribute('data-collection'),'favourites');
  await navigation.locator('[data-collection=recent]').click();assert.equal(await visibleGames(page),0,'new browser recent list empty');assert.equal(await navigation.locator('[aria-current=page]').getAttribute('data-collection'),'recent');
  await navigation.locator('[data-collection=""]').click();assert.equal(await visibleGames(page),catalogue.length,'All games restores the complete catalogue');assert(await page.locator('#all-games-title').evaluate(e=>e===document.activeElement),'collection navigation moves focus to results');
  await page.evaluate(()=>scrollTo(0,0));
  const tokenResponse=await page.request.get(base+'/assets/mbm-tokens.css');assert.equal(tokenResponse.status(),200,'Composed Play tokens must resolve locally');
  assert.equal(sha(Buffer.from(await tokenResponse.body())),sha(fs.readFileSync('assets/mbm-tokens.css')),'Token bytes match the pinned Site source');
  assert.equal(await page.locator('link[rel=stylesheet][href="/assets/mbm-tokens.css"]').count(),1,'One origin-local token link');
  const header=page.locator('header[data-mbm-chrome="play"]');assert.equal(await header.getAttribute('data-theme'),'dark');
  assert.equal(await header.locator('.brand strong').innerText(),'Play');
  // D-4: the Play tagline sits INSIDE the brand lock-up, exactly once in the header,
  // mirroring the education header rule, and again once in the footer. Its contrast is
  // measured against its own painted background rather than assumed from the token.
  assert.equal(await header.locator('.brand .brand-tagline').innerText(),'Play • Explore • Escape','Play tagline under the lock-up');
  assert.equal(await header.locator('.brand-tagline').count(),1,'exactly one header tagline');
  assert.equal(await page.locator('footer .footer-motto').innerText(),'Play • Explore • Escape','footer carries the Play tagline');
  assert.equal(await page.getByText('Learn • Build • Explore').count(),0,'the education motto has left the Play surface');
  const taglineInk=await header.locator('.brand-tagline').evaluate(e=>{
    const lum=c=>{const[r,g,b]=c.match(/\d+(\.\d+)?/g).slice(0,3).map(v=>{v=v/255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b};
    let bg=getComputedStyle(e).backgroundColor,node=e;
    while(node&&(bg==='rgba(0, 0, 0, 0)'||bg==='transparent')){node=node.parentElement;if(!node)break;bg=getComputedStyle(node).backgroundColor}
    const a=lum(getComputedStyle(e).color),b=lum(bg);
    return {ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05),size:parseFloat(getComputedStyle(e).fontSize),weight:getComputedStyle(e).fontWeight};});
  assert(taglineInk.ratio>=4.5,'Play tagline contrast '+taglineInk.ratio.toFixed(2)+':1 is below AA for its '+taglineInk.size+'px weight '+taglineInk.weight);
  assert(await header.locator('.brand img').evaluate(e=>e.complete&&e.naturalWidth>0));
  const tokenStyle=await header.evaluate(e=>({ink:getComputedStyle(e).getPropertyValue('--text').trim(),token:getComputedStyle(e).getPropertyValue('--mbm-primary').trim()}));assert.equal(tokenStyle.ink,tokenStyle.token,'Header adopts dark token ink');
  await targets(page,'header');await page.locator('#search-jump').click();assert(await page.locator('#query').evaluate(e=>e===document.activeElement));
  assert.equal(await visible(page).count(),expectedCards);const hrefs=await gridHrefs(page);const covered=coverage(hrefs,routesOf(catalogue));const control=coverageControl(hrefs);assert.equal(await page.locator('#classroom [data-activity] a[data-play]').count(),activities.length,'every activity on the Classroom shelf');const all=await page.evaluate(()=>new Set([...document.querySelectorAll('a[data-play][href]')].map(a=>a.getAttribute('href'))).size);assert.equal(all,data.games.length,'every route reachable by href');await noMedia(requests);const total=firstParty(requests);
  // TX (d): one shelf per category, Classroom first, card counts derived; TX (e): Updated badges derived.
  const shelves=await page.evaluate(()=>[...document.querySelectorAll('#game-grid [data-shelf]')].map(s=>({name:s.dataset.shelf,count:s.querySelector('[data-shelf-count]').textContent,cards:s.querySelectorAll('[data-card]').length,activities:s.querySelectorAll('[data-activity]').length,snap:getComputedStyle(s.querySelector('.shelf-track')).scrollSnapType})));
  assert.equal(shelves[0].name,'Classroom');assert.equal(shelves[0].activities,activities.length);
  for(const sh of shelves){const n=genreCount(sh.name);assert.equal(sh.count,n+(n===1?' game':' games')+(sh.activities?' · '+sh.activities+' activities':''),'shelf count derived: '+sh.name);assert.match(sh.snap,/x mandatory/,'shelf scroll-snaps: '+sh.name);}
  assert.equal(shelves.reduce((t,sh)=>t+sh.cards,0),expectedCards,'every lead card on exactly one shelf');
  for(const g of catalogue.filter(g=>g.updated&&(!g.editions||seriesLeads.has(g.id)))){const[y,m,d]=g.updated.date.split('-').map(Number);assert.match(await page.locator('#game-grid [data-card="'+g.id+'"] .card-meta').innerText(),new RegExp('Updated '+d+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]+' '+y),'Updated badge derived for '+g.id);}
  assert.equal(await page.locator('.lane').count(),0,'lanes retired: no game appears twice on the shelves');
  assert.equal(await page.locator('.az-list').count(),0,'the A to Z fallback stays inside noscript when JavaScript runs');
  const lanes=shelves;
  await page.evaluate(()=>scrollTo(0,0));await settledShelfCapture(page,width+'-home');await page.locator('#all-games-title').scrollIntoViewIfNeeded();await settledShelfCapture(page,width+'-browse');await page.locator('.menu summary').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.menu').getAttribute('open'),null);assert(await page.locator('.menu summary').evaluate(e=>e===document.activeElement));return{viewport:{width,height:width<700?844:900},noOverflow:true,cards:expectedCards,catalogueHrefsCoveredOnce:covered,coverageControl:control,classroomRows:activities.length,routesReachable:all,requests:total,thirdParty:0,initialMediaRequests:0,lanes};});

 // TX (a) and (g): the Spotlight shows one featured game at a time, moves only on Next, never
 // plays video, and on a phone stacks its picture above its words while the chips scroll sideways.
 await test(width+'-tx-spotlight-next-and-mobile-layout',async()=>{await page.goto(base);await ready(page);
  const featuredRows=spotRows,n=featuredRows.length;const shown=()=>page.locator('#spotlight [data-spot]:visible').evaluateAll(e=>e.map(x=>x.dataset.spot));
  assert.deepEqual(await shown(),[featuredRows[0].id],'one spotlight game at a time, the spotlight row first');assert.equal(await page.locator('#spot-status').innerText(),'1 of '+n);
  await pause(2500);assert.deepEqual(await shown(),[featuredRows[0].id],'nothing advances on its own (reduced motion set)');
  const next=page.locator('#spot-next');const box=await next.boundingBox();assert(box.width>=43.5&&box.height>=43.5,'Next is a 44px target');
  const order=[];for(let i=0;i<n;i++){order.push((await shown())[0]);await next.click();assert(await next.evaluate(e=>e===document.activeElement),'focus stays on Next');}
  assert.deepEqual(order,featuredRows.map(g=>g.id),'Next walks the spotlight row, then every featured row in manifest order');assert.deepEqual(await shown(),[featuredRows[0].id],'and wraps');
  assert.equal(await page.locator('#spotlight video, #game-grid video').count(),0,'no video on the spotlight or the shelves');
  assert(await page.locator('#spotlight [data-spot]:visible a[data-play]').evaluate(a=>a.href.length>0),'the spotlight game has a Play link');
  const layout=await page.evaluate(()=>{const card=[...document.querySelectorAll('#spotlight [data-spot]')].find(e=>!e.hidden),t=card.querySelector('.thumb').getBoundingClientRect(),b=card.querySelector('.feature-body').getBoundingClientRect(),row=document.querySelector('.chip-row'),cs=getComputedStyle(row);return{stacked:t.bottom<=b.top+1,thumbW:t.width,cardW:card.getBoundingClientRect().width,chipsScroll:cs.overflowX,chipsWrap:cs.flexWrap,chipOverflow:row.scrollWidth>row.clientWidth};});
  if(width<700){assert(layout.stacked,'the spotlight stacks on a phone');assert.equal(layout.chipsWrap,'nowrap','chips stay on one row on a phone');assert.match(layout.chipsScroll,/auto|scroll/,'and scroll sideways');}
  await overflow(page);return{spotlight:n,order:true,noAutoplay:true,layout};});
 // FIN1 D+E. The footer mark and both tagline instances, measured rather than
 // assumed, at every width under reduced motion and -- at the phone widths the
 // order names -- at 200% text as well. Contrast is read from the PAINTED colours
 // and the first ancestor that actually paints, for the same reason the header
 // check already is: the masthead redefines --text, so the token is not what the
 // eye gets. The ratios are returned into the report, so the evidence is a number
 // in the record and not a claim in a commit message.
 await test(width+'-footer-mark-and-tagline-accessibility',async()=>{
  await page.goto(base);await ready(page);
  const ink=async sel=>page.locator(sel).evaluate(e=>{
   const lum=c=>{const[r,g,b]=c.match(/\d+(\.\d+)?/g).slice(0,3).map(v=>{v=v/255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b};
   let bg=getComputedStyle(e).backgroundColor,node=e;
   while(node&&(bg==='rgba(0, 0, 0, 0)'||bg==='transparent')){node=node.parentElement;if(!node)break;bg=getComputedStyle(node).backgroundColor}
   const cs=getComputedStyle(e),a=lum(cs.color),b=lum(bg),r=e.getBoundingClientRect();
   return {ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05),px:parseFloat(cs.fontSize),weight:cs.fontWeight,
    w:r.width,h:r.height,clipped:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1};});
  // The mark itself: one instance, decorative, actually decoded, and carrying its
  // own box in the markup. A footer that grows when a late JPEG arrives is a
  // layout shift whatever the picture looks like, so the width and height
  // attributes are asserted, not just the rendered size.
  const mark=page.locator('footer .footer-mark');
  assert.equal(await mark.count(),1,'exactly one footer mark');
  assert.equal(await mark.getAttribute('alt'),'','the footer mark is decorative: the link around it is named by the words beside it');
  // Scroll to it first. The mark is lazy and the footer is far below the fold on a
  // 69-game shelf, so whether it had decoded by now depended on where the previous
  // test left the viewport -- a passing assertion that measured luck.
  await mark.scrollIntoViewIfNeeded();
  await mark.evaluate(e=>e.complete?null:new Promise(r=>{e.addEventListener('load',r,{once:true});e.addEventListener('error',r,{once:true});}));
  assert(await mark.evaluate(e=>e.complete&&e.naturalWidth>0),'the footer mark decoded');
  const markBox=await mark.evaluate(e=>{const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),attrW:e.getAttribute('width'),attrH:e.getAttribute('height'),src:e.getAttribute('src')};});
  assert(markBox.attrW&&markBox.attrH,'the footer mark declares its box in the markup, so nothing shifts when it decodes');
  assert(markBox.w>=24&&markBox.h>=24,'footer mark '+markBox.w+'x'+markBox.h+' is under the 24x24 WCAG 2.2 minimum');
  const headerMarkSrc=await page.locator('header .brand img').getAttribute('src');
  assert.equal(markBox.src,headerMarkSrc,'the footer carries the SAME approved mark bytes as the header, not a second asset');
  const homeLink=page.locator('footer a.footer-brand');
  assert.equal(await homeLink.count(),1,'one footer home link');
  assert.equal((await homeLink.innerText()).trim(),'Made by Matt Play','the footer home link is named by its words, not by the image');
  assert.equal(await homeLink.getAttribute('href'),'/','the footer mark returns to the Play home');
  // The shelf's own floor is 44px, and targets() enforces it on every visible
  // control. Asserted HERE too, because the 24x24 criterion alone passed a link
  // measured at 208x32 that the estate's gate then rejected.
  const linkBox=await homeLink.evaluate(e=>{const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),tap:parseFloat(getComputedStyle(e).minHeight)};});
  assert(linkBox.h>=44,'footer home link '+linkBox.w+'x'+linkBox.h+' is under this shelf 44px tap floor');
  const focusRing=await homeLink.evaluate(e=>{e.focus();const cs=getComputedStyle(e);return {focused:e===document.activeElement,width:cs.outlineWidth,style:cs.outlineStyle};});
  assert(focusRing.focused&&focusRing.style!=='none'&&parseFloat(focusRing.width)>=2,'the footer home link shows a focus ring: '+JSON.stringify(focusRing));
  // Both tagline instances. 200% text is exercised at the phone widths, where the
  // lock-up has the least room; the reflow assertion there is the document one,
  // which is the criterion (no horizontal scrolling), not a per-element rule.
  const contrast={};
  for(const scale of (width<700?[100,200]:[100])){
   await page.evaluate(s=>{document.documentElement.style.fontSize=s+'%'},scale);
   await page.waitForTimeout(120);
   for(const [name,sel] of [['header','header .brand-tagline'],['footer','footer .footer-motto']]){
    const m=await ink(sel);
    assert(m.ratio>=4.5,name+' tagline contrast '+m.ratio.toFixed(2)+':1 is below AA at '+scale+'% text ('+m.px+'px weight '+m.weight+')');
    assert(!m.clipped&&m.w>0&&m.h>0,name+' tagline is clipped or collapsed at '+scale+'% text: '+JSON.stringify(m));
    contrast[name+'@'+scale]=Number(m.ratio.toFixed(2));
   }
   const reflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert(reflow.scroll<=reflow.client+1,'horizontal scrolling at '+scale+'% text: '+JSON.stringify(reflow));
  }
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  return {mark:markBox,link:linkBox,focusRing,contrast,reducedMotion:true};});
 await test(width+'-search-chips-drawer-empty-reset',async()=>{await page.goto(base+'?q=Emberwild');await ready(page);assert.equal(await page.locator('#query').inputValue(),'Emberwild');assert.equal(await visible(page).count(),1);assert.match(await visible(page).innerText(),/Emberwild/);assert.equal(await page.locator('#result-count').innerText(),'1 of '+catalogue.length+' games');assert(await page.locator('#lanes').isHidden(),'lanes hide while filtering');
  await page.locator('#query').fill('qzx nonexistent');assert.equal(await visible(page).count(),0);assert(await page.locator('#empty-state').isVisible());await page.locator('#empty-reset').click();assert.equal(await visible(page).count(),expectedCards);assert.equal(await page.locator('#result-count').innerText(),catalogue.length+' games');assert(await page.locator('#lanes').isVisible());
  assert.equal(await page.locator('input[type=search]').count(),1,'one search field');assert.equal(await page.locator('main select:visible').count(),0,'no stacked selects on the page');
  // TX (c): chips are the catalogue's own categories (shelf order) plus Keyboard/Touch on declared controls only.
  const shelfOrder=await page.locator('#game-grid [data-shelf]').evaluateAll(e=>e.map(x=>x.dataset.shelf));
  const chips=await page.locator('.chip-button').allTextContents();assert.deepEqual(chips,['All',...shelfOrder,'Keyboard','Touch'],'category and input chips');
  for(const name of ['Strategy','Classroom']){const chip=page.locator('[data-chip="genre"][data-genre="'+name+'"]');await chip.click();assert.equal(await chip.getAttribute('aria-pressed'),'true');assert.equal(await visibleGames(page),genreCount(name),'category chip '+name);assert.equal(new URL(page.url()).searchParams.get('genre'),name);
   assert.equal(await page.locator('#game-grid [data-shelf]:visible').evaluateAll(e=>e.map(x=>x.dataset.shelf)).then(v=>v.join()),name,'only that shelf shows');
   assert.equal(await page.locator('#game-grid [data-activity]:visible').count(),name==='Classroom'?activities.length:0,'activities follow the Classroom chip only');
   await chip.click();assert.equal(await chip.getAttribute('aria-pressed'),'false','pressing again clears the chip');assert.equal(await visibleGames(page),catalogue.length);}
  for(const [v,label] of [['keyboard','Keyboard'],['touch','Touch']]){const chip=page.locator('[data-chip="control"][data-control="'+v+'"]');assert.equal(await chip.innerText(),label);await chip.click();assert.equal(await page.locator('#result-count').innerText(),catalogue.filter(g=>g.controls.includes(v)).length+' of '+catalogue.length+' games',label+' chip counts declared controls only');await page.locator('[data-chip="all"]').click();assert.equal(await page.locator('[data-chip="all"]').getAttribute('aria-pressed'),'true');}
  // TX (b): search covers title, category and the one-line description.
  await page.locator('#query').fill('Creative');assert(await visibleGames(page)>=genreCount('Creative'),'search matches the category word');
  const lined=catalogue.find(g=>g.line&&g.line!==g.genre&&(!g.editions||seriesLeads.has(g.id))),word=lined.line.split(/\s+/).filter(w=>w.length>6).find(w=>!normalizeWord(lined.title).includes(normalizeWord(w)));
  if(word){await page.locator('#query').fill(word.replace(/[^\p{L}\p{N}-]/gu,''));assert(await page.locator('#game-grid [data-card="'+lined.id+'"]').isVisible(),'search matches the one-line description');}
  await page.locator('#query').fill('');
  const genre='Sport';await page.locator('#filters-open').click();await page.locator('#genre').selectOption(genre);await page.keyboard.press('Escape');assert.equal(await visibleGames(page),genreCount(genre));assert.equal(new URL(page.url()).searchParams.get('genre'),genre);
  await page.locator('#filters-open').click();await page.locator('#filters-reset').click();await page.keyboard.press('Escape');assert.equal(await visibleGames(page),catalogue.length);assert.equal(new URL(page.url()).searchParams.get('genre'),null);
  const opener=page.locator('#filters-open');await opener.click();assert(await page.locator('#filters').isVisible());assert(await page.locator('#filters-close').evaluate(e=>e===document.activeElement),'drawer opens on its close control');for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('#filters')),'Focus escaped the drawer');}
  await page.locator('#control').selectOption('unknown');const unknown=catalogue.filter(g=>!g.controls.length).length;assert.equal(await visibleGames(page),unknown);await page.locator('#mode').selectOption('local');const local=catalogue.filter(g=>!g.controls.length&&g.modes.includes('local')).length;assert.equal(await visibleGames(page),local);await page.locator('#filters-reset').click();assert.equal(await visibleGames(page),catalogue.length);await page.keyboard.press('Escape');assert(!await page.locator('#filters').isVisible());assert(await opener.evaluate(e=>e===document.activeElement),'closing the drawer returns focus to Filters');
  // TX (d): a shelf whose cards overflow gets 44px previous/next controls that move its own track only.
  const step=await page.evaluate(async()=>{const s=[...document.querySelectorAll('#game-grid [data-shelf]')].find(x=>!x.querySelector('.shelf-nav').hidden);if(!s)return null;const t=s.querySelector('.shelf-track'),[prev,next]=s.querySelectorAll('[data-shelf-step]');t.scrollLeft=0;await new Promise(r=>setTimeout(r,200));const before=t.scrollLeft,wasPrev=prev.disabled;next.click();await new Promise(r=>setTimeout(r,400));const r1=next.getBoundingClientRect();return{shelf:s.dataset.shelf,before,after:t.scrollLeft,prevDisabledAtStart:wasPrev,prevEnabledAfter:!prev.disabled,w:r1.width,h:r1.height,page:document.documentElement.scrollLeft};});
  if(step){assert(step.after>step.before,'Next scrolls the shelf: '+JSON.stringify(step));assert(step.prevDisabledAtStart&&step.prevEnabledAfter,'Previous is disabled at the start and enabled after Next');assert(step.w>=43.5&&step.h>=43.5,'shelf controls are 44px');assert.equal(step.page,0,'the page itself does not scroll sideways');}
  await page.locator('[data-collection=""]').click();return{genreChip:genre,genreCount:genreCount(genre),unknownControlCount:unknown,localUnverifiedCount:local,shelfStep:step};});
 await test(width+'-favourites-recent-persistence-save-safety',async()=>{await page.goto(base);await ready(page);await page.evaluate(()=>localStorage.setItem('apexkick.v1','PLAY-QA-SENTINEL'));await page.locator('#query').fill('Emberwild');const heart=page.locator('#game-grid [data-favourite="'+EMBER+'"]');await heart.click();assert.equal(await heart.getAttribute('aria-pressed'),'true','Favourite toggled from the card');assert(!await page.locator('#game-dialog').isVisible(),'the card heart opens nothing');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_play_favourites_v1'))),[EMBER],'Favourite storage');assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).sort()),['apexkick.v1','mbm_play_favourites_v1'],'no new storage keys');
  await page.reload();await ready(page);await page.locator('#query').fill('Emberwild');assert.equal(await heart.getAttribute('aria-pressed'),'true','favourite persists');await page.locator('.collection-links [data-collection=favourites]').click();assert.equal(await visibleGames(page),1);assert.equal(new URL(page.url()).searchParams.get('list'),'favourites');assert(await page.locator('#clear-favourites').isVisible());assert.equal(await page.locator('#game-grid [data-activity]:visible').count(),0,'activities are not part of a list');
  await heart.click();assert.equal(await visible(page).count(),0);assert(await page.locator('#empty-state').isVisible());await page.locator('#empty-reset').click();
  await page.locator('#query').fill('Emberwild');const play=page.locator('#game-grid a[data-play="'+EMBER+'"]');await play.click();await page.waitForURL('**/emberwild/');await page.goBack();await page.waitForSelector('#query');await ready(page);assert.equal(await page.locator('#query').inputValue(),'Emberwild');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_play_recently_opened_v1'))),[EMBER],'recent key unchanged');assert(await page.evaluate(()=>sessionStorage.getItem('mbm_play_browse_position_v1')!==null),'position key unchanged');
  await page.locator('#query').fill('');await page.locator('.collection-links [data-collection=recent]').click();assert.equal(await visibleGames(page),1,'Recently played renders from the recent key');assert.match(await page.locator('#list-note').innerText(),/not saved games/);await page.locator('#clear-recent-list').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_play_recently_opened_v1'))),[]);
  await page.locator('[data-collection=""]').click();await page.locator('#query').fill('Emberwild');await heart.click();await page.locator('.collection-links [data-collection=favourites]').click();await page.locator('#clear-favourites').click();assert.equal(await visible(page).count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('apexkick.v1')),'PLAY-QA-SENTINEL');assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>!['apexkick.v1','mbm_splash_last'].includes(k)).sort()),['mbm_play_favourites_v1','mbm_play_recently_opened_v1'],'only the shelf keys (plus the sentinel and the game-owned splash key)');await page.locator('#empty-reset').click();return{persistence:true,recentFromOpen:true,recentList:true,resetPreservedGameSave:true,keys:['mbm_play_favourites_v1','mbm_play_recently_opened_v1','mbm_play_browse_position_v1']};});
 await test(width+'-reviewed-moods-surprise-and-card-lists',async()=>{
  await page.goto(base+'?mood=Together&genre=Sport');await ready(page);
  const eligible=catalogue.filter(g=>(g.moods||[]).includes('Together')&&g.genre==='Sport');assert(eligible.length>1);
  const ids=await visible(page).locator('.card-actions a[data-play]').evaluateAll(es=>es.map(e=>e.dataset.play));assert.deepEqual(new Set(ids),new Set(eligible.map(g=>g.id)));
  await page.locator('#surprise').click();const picked=new URL(page.url()).searchParams.get('game');assert(eligible.some(g=>g.id===picked),'Surprise chose outside active mood/genre');assert.equal(await page.locator('#dialog-play').getAttribute('href'),eligible.find(g=>g.id===picked).route);assert.match(await page.locator('#dialog-players').innerText(),/device|network/i);await page.keyboard.press('Escape');assert(await page.locator('#surprise').evaluate(e=>e===document.activeElement),'Surprise opener regains focus');
  await page.locator('#query').fill('nonexistent qzx');await page.locator('#surprise').click();assert(!await page.locator('#game-dialog').isVisible());assert.match(await page.locator('#surprise-status').innerText(),/No games match/);assert(await page.locator('#empty-reset').evaluate(e=>e===document.activeElement));await page.locator('#empty-reset').click();
  await page.locator('#query').fill('Emberwild');const heart=page.locator('#game-grid [data-favourite="'+EMBER+'"]');if(await heart.getAttribute('aria-pressed')==='true')await heart.click();await heart.click();assert.equal(await heart.getAttribute('aria-pressed'),'true');assert(!await page.locator('#game-dialog').isVisible(),'card favourite does not open details or launch');
  await page.locator('.collection-links [data-collection=favourites]').click();await page.locator('#game-grid [data-favourite="'+EMBER+'"]').click();assert(await page.evaluate(()=>document.activeElement!==document.body&&document.activeElement.getClientRects().length>0),'removing a favourite leaves visible focus');
  await page.evaluate(id=>{localStorage.setItem('apexkick.v1','PLAY-QA-SENTINEL');localStorage.setItem('mbm_play_recently_opened_v1',JSON.stringify([id]));},EMBER);await page.goto(base+'?list=recent');await ready(page);assert.match(await page.locator('#list-note').innerText(),/not saved games/);await page.locator('#game-grid [data-remove-recent="'+EMBER+'"]').click();assert(await page.locator('#empty-state').isVisible());assert(await page.locator('#empty-reset').evaluate(e=>e===document.activeElement));assert.equal(await page.evaluate(()=>localStorage.getItem('apexkick.v1')),'PLAY-QA-SENTINEL');
  await page.evaluate(id=>localStorage.setItem('mbm_play_recently_opened_v1',JSON.stringify([id])),EMBER);await page.reload();await ready(page);await page.locator('#clear-recent-list').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_play_recently_opened_v1'))),[]);assert.equal(await page.evaluate(()=>localStorage.getItem('apexkick.v1')),'PLAY-QA-SENTINEL');
  await page.goto(base+'?mood=Calm&q=Lumina');await ready(page);await page.locator('#surprise').click();assert.match(await page.locator('#dialog-accessibility').innerText(),/Reduced motion/);assert.match(await page.locator('#dialog-saves').innerText(),/auto-saves/);await page.screenshot({path:path.join(out,width+'-discovery-details.png')});await page.keyboard.press('Escape');
  const lighthouse=catalogue.find(g=>g.route.includes('/The_Last_Lighthouse_'));
  await page.goto(base+'?game='+lighthouse.id);await ready(page);
  const lighthouseImage=page.locator('#dialog-media img');await lighthouseImage.evaluate(img=>img.decode());
  assert.equal(await lighthouseImage.evaluate(img=>getComputedStyle(img).objectPosition),'50% 0%','Tall title capture keeps its heading visible');
  await page.screenshot({path:path.join(out,width+'-lighthouse-details.png')});await page.keyboard.press('Escape');
  return{combinedMoodGenre:true,surpriseEligibleOnly:true,emptySurprise:true,directCardFavourite:true,removeRecentFocus:true,clearRecentFromList:true,saveSentinelPreserved:true};
 });
 await test(width+'-series-cards-expose-each-edition-once',async()=>{
  // PLAY-D1 (#378, 1b4634c) made a filtered series card launch its matching edition:
  //   play.js:109  "A series card must launch a matching edition, not its unfiltered lead."
  // The static edition list is built as every edition EXCEPT the lead (build.py:69), so a
  // repointed Play anchor used to duplicate that edition and drop the lead's own link. play.js
  // now derives the list from card.ids minus whoever the Play anchor holds, so in EVERY filter
  // state a card's distinct hrefs must equal its full edition set, and no card may repeat an href.
  const readCards=()=>page.locator('#game-grid .game-card[data-card]').evaluateAll(ns=>ns.map(c=>({
    id:c.dataset.card,ids:(c.dataset.games||'').split(' ').filter(Boolean),
    hrefs:[...c.querySelectorAll('a[data-play]')].map(a=>new URL(a.href).pathname)})));
  const routeOf=new Map(data.games.map(g=>[g.id,new URL(g.route,base).pathname]));
  const shape=c=>[...new Set(c.hrefs)].sort();
  const check=(cards,label)=>{for(const c of cards){
    assert.equal(c.hrefs.length,new Set(c.hrefs).size,label+': duplicate href on card '+c.id);
    assert.deepEqual(shape(c),c.ids.map(i=>routeOf.get(i)).sort(),label+': edition hrefs differ on card '+c.id);}};
  await page.goto(base);await ready(page);
  const before=await readCards();check(before,'unfiltered');
  const series=before.filter(c=>c.ids.length>1);assert(series.length>0,'no multi-edition series card to exercise');
  const chipKeys=await page.locator('.chip-button[data-chip="genre"],.chip-button[data-chip="control"]').evaluateAll(es=>es.map(e=>e.dataset.chip==='genre'?'[data-chip="genre"][data-genre="'+e.dataset.genre+'"]':'[data-chip="control"][data-control="'+e.dataset.control+'"]'));
  for(const sel of chipKeys){await page.locator(sel).click();check(await readCards(),'chip '+sel);await page.locator('[data-chip="all"]').click();}
  for(const mood of ['Calm','Fast','Thinky','Together']){await page.goto(base+'?mood='+mood);await ready(page);check(await readCards(),'mood '+mood);}
  await page.goto(base);await ready(page);
  const after=await readCards();
  assert.deepEqual(after.map(shape),before.map(shape),'distinct href set changed across filtering');
  return {cards:before.length,seriesCards:series.length,chipsExercised:chipKeys.length,moodsExercised:4,duplicateHrefs:0};});
 await test(width+'-sheet-focus-deep-link-and-return',async()=>{await page.goto(base+'?q=Emberwild&game='+EMBER);await ready(page);const trigger=page.locator('#game-grid a[data-play="'+EMBER+'"]');assert(await page.locator('#game-dialog').isVisible(),'?game= opens the sheet');assert(await page.locator('#dialog-close').evaluate(e=>e===document.activeElement),'sheet opens on its close control');assert.equal(new URL(page.url()).searchParams.get('game'),EMBER,'deep link kept');for(let i=0;i<16;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>!!document.activeElement.closest('#game-dialog')),'Focus escaped dialog');}
  assert.equal(await page.locator('#dialog-title').innerText(),emberwild.displayTitle||emberwild.title);assert.equal(await page.locator('#dialog-play').innerText(),'Play '+(emberwild.displayTitle||emberwild.title)+' →');const chips=await page.locator('#dialog-support .chip').allTextContents();const expected=[['controls','touch','Touch'],['controls','keyboard','Keyboard'],['controls','gamepad','Gamepad'],['modes','single','1 player'],['modes','local','Local / same-network options']].filter(([f,v])=>emberwild[f].includes(v)).map(x=>x[2]);assert.deepEqual(chips,expected.length?expected:['Not yet verified']);assert.equal(await page.locator('#dialog-watch').isVisible(),Boolean(emberwild.media.video),'Watch gameplay only with media');assert.match(await page.locator('#dialog-description').innerText(),new RegExp('^'+emberwild.description.slice(0,20).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  await page.keyboard.press('Escape');assert(!await page.locator('#game-dialog').isVisible());assert(await trigger.evaluate(e=>e===document.activeElement),'closing returns focus to the card Play link');assert.equal(new URL(page.url()).searchParams.get('game'),null,'deep link cleared on close');
  const footerReport=await page.locator('footer a[href^="mailto:"]').getAttribute('href');assert.match(footerReport,/^mailto:contactmadebymatt@gmail.com/);assert.equal(await page.locator('footer a[href^="mailto:"]').innerText(),'Report a problem');assert.equal(await page.locator('#game-dialog a[href^="mailto:"]').count(),0,'report link lives in the footer, not the sheet');
  await page.goto(base+'?q=Emberwild&game='+EMBER);await ready(page);await page.locator('#dialog-play').click();await page.waitForURL('**/emberwild/');await page.goBack();await page.waitForSelector('#query');await ready(page);assert.equal(await page.locator('#query').inputValue(),'Emberwild');assert(!await page.locator('#game-dialog').isVisible(),'Back reopened the sheet');assert.equal(new URL(page.url()).searchParams.get('game'),null);
  await page.goto(base+'?game='+EMBER);await ready(page);assert(await page.locator('#game-dialog').isVisible(),'?game= deep link opens the sheet');assert.equal(await page.locator('#dialog-title').innerText(),emberwild.displayTitle||emberwild.title);await page.keyboard.press('Escape');
  const series=catalogue.find(g=>g.editions&&seriesLeads.has(g.id));await page.goto(base+'?game='+series.id);await ready(page);assert(await page.locator('#dialog-editions').isVisible(),'Editions row for a series');const editionLinks=await page.locator('#dialog-editions a[data-play]').evaluateAll(a=>a.map(x=>x.getAttribute('href')));assert.deepEqual(editionLinks,series.editions.map(id=>data.games.find(g=>g.id===id).route),'every edition has its own Play link');assert.equal(await page.locator('#dialog-editions h3').innerText(),'Editions');assert.match(await page.locator('#game-dialog .progress').innerText(),/Your progress\s+Save support has not yet been verified for this game\. Favourites and recent launches do not store game progress\.\s+Transfer saves/);assert.equal(await page.locator('#game-dialog .progress a').getAttribute('href'),'/game-saves/');const chapter=catalogue.find(g=>g.chapter);await page.keyboard.press('Escape');await page.goto(base+'?game='+chapter.id);await ready(page);assert.match(await page.locator('#dialog-description').innerText(),new RegExp(' New chapter: '+chapter.chapter.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.$'));await page.keyboard.press('Escape');return{focusTrap:true,escapeFocusReturn:true,deepLink:true,backToResults:true,editions:series.series,chapter:chapter.chapter,reportInFooter:true};});
 await test(width+'-keyboard-warning-and-unverified',async()=>{await page.goto(base);await ready(page);const coarse=await page.evaluate(()=>matchMedia('(hover: none) and (pointer: coarse)').matches);const needs=catalogue.find(g=>g.controls.length&&!g.controls.includes('touch')&&(!g.editions||seriesLeads.has(g.id)));const unverified=catalogue.find(g=>!g.controls.length&&(!g.editions||seriesLeads.has(g.id)));
  const chip=page.locator('#game-grid [data-card="'+needs.id+'"] [data-needs-keyboard]');assert.equal(await chip.count(),1,'card carries the warning element for verified non-touch controls');assert.equal(await chip.isVisible(),coarse,'warning shown only on a coarse pointer');assert.equal(await page.locator('#game-grid [data-card="'+unverified.id+'"] [data-needs-keyboard]').count(),0,'unverified card carries nothing');
  await page.goto(base+'?game='+needs.id);await ready(page);assert.equal(await page.locator('#dialog-keyboard').isVisible(),coarse);assert(await page.locator('#dialog-play').isVisible(),'Play never blocked');assert.equal(await page.locator('#dialog-play').getAttribute('href'),needs.route);await page.keyboard.press('Escape');
  await page.goto(base+'?game='+unverified.id);await ready(page);assert.deepEqual(await page.locator('#dialog-support .chip').allTextContents(),['Not yet verified']);assert(!await page.locator('#dialog-keyboard').isVisible());assert(await page.locator('#dialog-play').isVisible());await page.keyboard.press('Escape');return{coarsePointer:coarse,needsKeyboard:needs.id,unverified:unverified.id};});
 if(width===390)await test('390-targets-44px-closed-drawer-sheet',async()=>{await page.goto(base);await ready(page);await targets(page,null);await page.locator('#filters-open').click();await targets(page,'#filters');await page.keyboard.press('Escape');await targets(page,'#spotlight');await targets(page,'#game-grid');await page.goto(base+'?game='+EMBER);await ready(page);await targets(page,'#game-dialog');await page.keyboard.press('Escape');const series=catalogue.find(g=>g.editions&&seriesLeads.has(g.id));await page.goto(base+'?game='+series.id);await ready(page);await targets(page,'#game-dialog');await page.keyboard.press('Escape');return{closed:true,drawerOpen:true,sheetOpen:true,sheetWithEditions:true};});
 await test(width+'-orientation-and-text-enlargement',async()=>{await page.goto(base);await ready(page);await page.setViewportSize({width:width<700?844:900,height:width});await overflow(page);await page.setViewportSize({width,height:900});await page.addStyleTag({content:':root{font-size:200%!important}'});assert((await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)))>=32,'Text enlargement did not apply');await overflow(page);const collectionFits=await page.locator('.browse-sidebar').evaluate(e=>e.scrollWidth<=e.clientWidth+1&&[...e.querySelectorAll('.collection-links a')].every(a=>a.scrollWidth<=a.clientWidth+1));assert(collectionFits,'Collection labels must fit at 200% text size');await page.screenshot({path:path.join(out,width+'-text-200.png')});return{landscapeNoOverflow:true,text200NoOverflow:true,collectionLabelsFit:true};});
 await ctx.close();
}
await test('essential-links-with-javascript-disabled',async()=>{const ctx=await browser.newContext({javaScriptEnabled:false}),page=await ctx.newPage();await page.goto(base);const hrefs=await gridHrefs(page);const covered=coverage(hrefs,routesOf(catalogue));assert.equal(await page.locator('#classroom [data-activity] a[data-play]').count(),activities.length);const azLinks=await page.locator('.az-list a[href]').evaluateAll(a=>a.map(x=>x.getAttribute('href')));assert.deepEqual([...azLinks].sort(),data.games.map(g=>g.route).sort(),'the noscript A to Z lists every game and activity once');const distinct=await page.evaluate(()=>new Set([...document.querySelectorAll('a[data-play][href]')].map(a=>a.getAttribute('href'))).size);assert.equal(distinct,data.games.length,'every Play href present without JavaScript');const anchors=await page.locator('a[data-play][href]').count();await page.locator('.menu summary').click();assert(await page.getByRole('navigation',{name:'Main menu'}).isVisible());assert.match(await page.locator('#all-games .notice').innerText(),/direct Play links work/);assert(await page.locator('#spotlight [data-spot]').first().isVisible(),'spotlight readable without JavaScript');assert.equal(await page.locator('.shelf-nav:visible').count(),0,'inert shelf controls stay hidden without JavaScript');await ctx.close();return{directHrefs:distinct,noscriptList:azLinks.length,gridCatalogueHrefsOnce:covered,classroomRows:activities.length,playAnchors:anchors,nativeMenu:true};});
await test('unavailable-storage-missing-media-and-failure-fallback',async()=>{const ctx=await browser.newContext(),page=await ctx.newPage();await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('blocked','SecurityError');}});});await page.route(/\.(png|jpg|webp|svg)(\?.*)?$/,r=>r.abort());await page.goto(base);await ready(page);await page.locator('#query').fill('Emberwild');await page.locator('#game-grid [data-favourite="'+EMBER+'"]').click();assert.match(await page.locator('#storage-status').innerText(),/unavailable/);await pause(300);assert.match(await page.locator('#game-grid [data-card="'+EMBER+'"] .thumb').innerText(),new RegExp((emberwild.displayTitle||emberwild.title).slice(0,6)),'a failed card image falls back to the titled colour block');await page.goto(base+'?game='+EMBER);await ready(page);await pause(300);assert.match(await page.locator('#dialog-media').innerText(),/Image unavailable/);assert(await page.locator('#dialog-play').isVisible());await page.keyboard.press('Escape');assert(await page.locator('#game-grid .play').filter({visible:true}).first().isVisible());await ctx.close();return{browsing:true,inMemoryFavourite:true,gameLinks:true,imageFallback:true};});
await test('all-69-rendered-start-surfaces',async()=>{for(const g of data.games){const ctx=await browser.newContext({viewport:{width:1280,height:720},reducedMotion:'reduce'}),page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));try{const response=await page.goto(base+g.route,{waitUntil:'load',timeout:20000});await pause(4000);const surface=await page.evaluate(()=>({title:document.title,canvas:[...document.querySelectorAll('canvas')].filter(e=>e.getBoundingClientRect().width>20&&e.getBoundingClientRect().height>20).length,controls:[...document.querySelectorAll('button,input,select,a[href]')].filter(e=>e.getBoundingClientRect().width>0).length,text:document.body.innerText.slice(0,1100)}));const ready=response.status()===200&&(surface.canvas>0||surface.controls>0);report.routes.push({id:g.id,route:g.route,status:response.status(),ready,surface,errors,depth:'Initial load and rendered input surface; not a completed game'});// The Lighthouse first-visit primer focuses its bottom button. Dismiss it
// through the ordinary player control so the capture identifies the game.
if(g.route.includes('/The_Last_Lighthouse_')){
 await page.getByRole('button',{name:'TAKE THE WATCH',exact:true}).click();
 await page.setViewportSize({width:1280,height:1000});
 await page.locator('#startScreen h1').waitFor({state:'visible'});
 await page.locator('#startScreen h1').scrollIntoViewIfNeeded();
 await pause(250);
 report.routes[report.routes.length-1].captureAction='Dismissed first-visit primer with Take the watch; captured title screen at 1280x1000.';
}
await page.screenshot({path:path.join(out,'route-'+g.id+'.jpg'),quality:65});}catch(e){report.routes.push({id:g.id,route:g.route,ready:false,error:e.message});}await ctx.close();}assert(report.routes.every(r=>r.ready),'Some initial game surfaces did not render');return{routes:69,rendered:report.routes.filter(r=>r.ready).length,runtimeErrors:report.routes.filter(r=>r.errors?.length).map(r=>({route:r.route,errors:r.errors}))};});
await test('accepted-preview-playback-seeking-pause-close',async()=>{const media=data.games.filter(g=>g.media.video);if(!media.length)return{status:'not-run-no-accepted-media',count:0};const proofs=[];for(const width of [390,1280]){const ctx=await browser.newContext({viewport:{width,height:844}}),page=await ctx.newPage();const requests=[];page.on('request',r=>requests.push(r.url()));await page.goto(base);await noMedia(requests);for(const g of media){await page.goto(base+'?game='+g.id);await page.locator('#dialog-watch').click();const v=page.locator('#game-dialog video');await page.waitForFunction(()=>{const v=document.querySelector('#game-dialog video');return v&&!v.paused&&v.currentTime>.5;});const state=await v.evaluate(v=>({duration:v.duration,time:v.currentTime,ready:v.readyState}));assert(state.duration>=12&&state.duration<=25);await v.evaluate(v=>v.currentTime=v.duration/2);await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.currentTime>v.duration/2-.5;});await v.evaluate(v=>v.pause());const paused=await v.evaluate(v=>v.currentTime);await pause(200);assert.equal(await v.evaluate(v=>v.currentTime),paused);assert.equal(await page.locator('video').count(),1);await page.locator('#dialog-close').click();assert.equal(await page.locator('video').count(),0);proofs.push({title:g.title,width,...state,seeking:true,paused:true,closedAndStopped:true});}await ctx.close();}return{count:media.length,proofs};});
await browser.close();report.pass=report.checks.every(c=>c.pass);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.map(c=>({name:c.name,pass:c.pass,error:c.error?.split('\n')[0]})),routes:report.routes.length},null,2));
// Reporting only; the exit code below is unchanged. The JSON above already names
// every failure, but it lands two thousand lines into the job log, the Actions
// logs API returns only a job's tail, and the artifact host is unreachable from
// the agent container -- so a red here could not be read at all without opening
// a browser. An annotation per failure is readable from the check-run API, and
// the step summary survives the artifact.
const failed=report.checks.filter(c=>!c.pass);
for(const c of failed)console.log('::error title=Play review::'+c.name+' — '+String(c.error||'').split('\n')[0]);
if(process.env.GITHUB_STEP_SUMMARY){try{fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
 '## Play review\n\n'+(failed.length?failed.map(c=>'- **'+c.name+'** — '+String(c.error||'').split('\n')[0]).join('\n'):'All '+report.checks.length+' checks passed.')+'\n');}catch(_){}}
if(!report.pass)process.exitCode=1;})();
