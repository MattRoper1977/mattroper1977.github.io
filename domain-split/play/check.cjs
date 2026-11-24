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
 * PLAY-D2 front page (2026-11-21): re-pinned to the gated D2 page. Each old limb
 * keeps an equivalent here, derived from the same data plus discovery-moods.json:
 *   Spotlight + Next        -> Pick a game: this week's pack (ISO week) + Today's pick,
 *                              derived independently below; nothing moves on its own.
 *   category shelves/chips  -> one A-Z grid (one card per catalogue game, one Play link
 *                              each) and eight mood buttons with derived counts (#mood=).
 *   Filters drawer, Surprise-> Pick for me and the How to play guides dialogs (focus kept
 *                              inside, Escape returns focus), Pick respects mood + device.
 *   collections sidebar     -> Play again (recent + Saved) and Clear this list; the same
 *                              keys, plus mbm_play_calm_v1 written only when Calm is pressed.
 *   hero motif              -> byte-bound covers (sha256 + bytes from discovery-moods.json).
 *   tagline contrast        -> brand lock-up and footer contrast, painted, at 100% and 200%.
 *   Classroom shelf         -> Teacher corner: the six classroom activities; the staff
 *                              calibration item is published but never on the pupil page.
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
const classActivities=data.games.filter(g=>g.group==='activities'),staffRows=data.games.filter(g=>g.group==='staff'),pupilRows=data.games.filter(g=>g.group!=='staff');
const routesOf=rows=>new Set(rows.map(g=>g.route));
const normalizeWord=v=>String(v).normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase();
const shown=g=>g.displayTitle||g.title;
// Ruling 21 Nov: the Updated ribbon and the card's spoken label carry no date or version text.
const updatedLabel=g=>g.updated?'Updated':'';
const htmlEsc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// PLAY-D2: one card per catalogue game (series are not collapsed; the sheet lists the editions).
const expectedCards=catalogue.length;
const EMBER='game-emberwild',emberwild=catalogue.find(g=>g.id===EMBER);assert(emberwild,'Emberwild is the fixture game');
// The committed discovery data the page is built from, joined to the catalogue by route.
const moodSpec=JSON.parse(fs.readFileSync('domain-split/play/discovery-moods.json'));
const key=r=>decodeURIComponent(r).replace(/index\.html$/,'').replace(/\/$/,'');
const specByRoute=new Map(Object.entries(moodSpec.games).map(([r,v])=>[key(r),v]));
const spec=g=>{const s=specByRoute.get(key(g.route));assert(s,'no discovery row for '+g.route);return s;};
const byRoute=new Map(catalogue.map(g=>[key(g.route),g]));
const idOfRoute=r=>{const g=byRoute.get(key(r));assert(g,'pack or pool route is not a catalogue game: '+r);return g.id;};
const keysOnly=g=>g.controls.length>0&&!g.controls.includes('touch');
const moodIds=moodSpec.moods.map(m=>m.id);
const moodMembers=id=>catalogue.filter(g=>spec(g).primary===id||spec(g).secondary===id);
const packs=moodSpec.packs.map(p=>({slug:p.slug,name:p.name,games:p.routes.map(idOfRoute)}));
const todayPool=moodSpec.today_pool.map(idOfRoute);
// PLAY-D5: the game of the week comes from hero-week.json, read here and not from the build.
const heroWeek=JSON.parse(fs.readFileSync(path.join(__dirname,'hero-week.json'),'utf8'));assert(/^[a-z0-9-]+$/.test(heroWeek.slug)&&typeof heroWeek.line==='string'&&heroWeek.line.length>0&&heroWeek.line.length<=90,'hero-week.json shape');const heroId=idOfRoute('/'+heroWeek.slug+'/');
// Start here (23 Nov): the committed easy first games, minus the game of the week.
const startWant=(moodSpec.start_here||[]).map(idOfRoute).filter(id=>id!==heroId);
const azSort=rows=>[...rows].sort((a,b)=>shown(a).localeCompare(shown(b),'en',{sensitivity:'base'}));
// Independent date maths for the Pick-a-game schedule (ISO 8601 week; local calendar day).
function isoWeekOf(y,m,d){const t=new Date(Date.UTC(y,m-1,d)),wd=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-wd);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/86400000+1)/7);}
assert.equal(isoWeekOf(2026,11,21),47,'ISO week anchor');assert.equal(isoWeekOf(2027,1,1),53,'ISO week anchor across the year end');assert.equal(isoWeekOf(2027,1,4),1,'ISO week anchor');
function expectedSchedule(iso){const[y,m,d]=iso.split('-').map(Number),week=isoWeekOf(y,m,d),pack=packs[week%packs.length],di=Math.floor(Date.UTC(y,m-1,d)/86400000),n=todayPool.length;
 let today=todayPool[((di%n)+n)%n];for(const s of [0,18,12,24,6,30]){const c=todayPool[(((di+s)%n)+n)%n];if(!pack.games.includes(c)){today=c;break;}}return{week,pack:pack.slug,packGames:pack.games,today};}
// More to play = this week's pack without the game of the week, topped up from the Today pool (every fifth
// entry from today's index), then Today's pick last. If Today's pick is the game of the week, the last top-up takes the Today slot.
function expectedPick(iso){const[y,m,d]=iso.split('-').map(Number),w=expectedSchedule(iso),di=Math.floor(Date.UTC(y,m-1,d)/86400000),n=todayPool.length,head=w.packGames.filter(id=>id!==heroId),last=w.today!==heroId?[w.today]:[],fill=[];
 for(let step=0;head.length+fill.length+last.length<4&&step<n;step++){const c=todayPool[(((di+step*5)%n)+n)%n];if(c!==heroId&&!head.includes(c)&&!fill.includes(c)&&!last.includes(c))fill.push(c);}const ids=[...head,...fill,...last];assert.equal(ids.length,4,'four More-to-play ids derivable for '+iso);assert(!ids.includes(heroId));return ids;}
const isoOf=t=>new Date(t).toISOString().slice(0,10);
// The grid must list every catalogue href exactly once — as a card's Play or as a
// collapsed edition's Play inside its lead card — and nothing that is not a catalogue game.
function coverage(hrefs,routes){const seen=new Map();for(const h of hrefs)seen.set(h,(seen.get(h)||0)+1);const twice=[...seen].filter(([,n])=>n>1).map(([h])=>h),missing=[...routes].filter(r=>!seen.has(r)),extra=[...seen.keys()].filter(h=>!routes.has(h));assert(!twice.length&&!missing.length&&!extra.length,'grid coverage: twice='+JSON.stringify(twice)+' missing='+JSON.stringify(missing)+' extra='+JSON.stringify(extra));return seen.size;}
function coverageControl(hrefs){// Planted defect: drop one game from a scratch copy of the data; the limb must bite.
 const dropped=new Set(routesOf(catalogue));dropped.delete(emberwild.route);let bit=false;try{coverage(hrefs,dropped);}catch(_){bit=true;}assert(bit,'coverage control did not bite when a game was dropped from the data');
 const doubled=[...hrefs,emberwild.route];let bit2=false;try{coverage(doubled,routesOf(catalogue));}catch(_){bit2=true;}assert(bit2,'coverage control did not bite when a card was duplicated');return{droppedGameRefused:true,duplicateCardRefused:true};}
async function test(name,fn){try{report.checks.push({name,pass:true,evidence:await fn()});}catch(e){report.checks.push({name,pass:false,error:e.stack});if(currentPage&&!currentPage.isClosed()){await currentPage.screenshot({path:path.join(out,name+'-failure.png')}).catch(()=>{});fs.writeFileSync(path.join(out,name+'-failure.txt'),await currentPage.locator('body').innerText().catch(()=>''));}}fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
async function overflow(page){const proof=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,culprits:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>document.documentElement.clientWidth+1&&e.getClientRects().length&&!e.closest('dialog:not([open])')).slice(0,8).map(e=>({tag:e.tagName,id:e.id,cls:e.className,right:e.getBoundingClientRect().right}))}));assert(proof.scroll<=proof.width+1,'Horizontal overflow '+JSON.stringify(proof));}
function visible(page){return page.locator('#game-grid [data-card]:visible');}
async function visibleGames(page){return page.evaluate(()=>[...document.querySelectorAll('#game-grid [data-card]')].filter(e=>!e.hidden).reduce((n,e)=>n+e.dataset.games.split(' ').length,0));}
async function gridHrefs(page){return page.evaluate(()=>[...document.querySelectorAll('#game-grid [data-card] a[data-play][href]')].map(a=>a.getAttribute('href')));}
async function noMedia(requests){assert(!requests.some(u=>/\.(mp4|webm)(\?|$)/.test(u)),'Video requested before selection');assert(!requests.some(u=>/supabase|google-analytics|goatcounter|ko-fi|kofi/i.test(u)),'Unexpected tracking or support widget');}
function firstParty(requests){const foreign=requests.filter(u=>!u.startsWith(base+'/')&&!u.startsWith('data:'));assert.equal(foreign.length,0,'Requests left the review origin: '+JSON.stringify(foreign.slice(0,5)));assert(!requests.some(u=>/madebymatt\.uk/.test(u)),'A load reached madebymatt.uk');return requests.length;}
async function targets(page,scope){// Every visible interactive control inside `scope` is at least 44x44.
 const small=await page.evaluate(sel=>{const root=sel?document.querySelector(sel):document;return[...root.querySelectorAll('a[href],button,input,select,summary')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return{t:e.tagName,id:e.id,cls:String(e.className).slice(0,30),text:(e.textContent||'').trim().slice(0,24),w:Math.round(r.width),h:Math.round(r.height)};}).filter(x=>x.w<43.5||x.h<43.5);},scope);assert.equal(small.length,0,'Targets under 44px in '+(scope||'page')+': '+JSON.stringify(small.slice(0,8)));}
async function addr(page){return page.evaluate(()=>location.href);}// the page's own address (replaceState lands here first)
async function ready(page){await page.waitForFunction(()=>document.documentElement.dataset.playReady==='1');}
async function focusedIn(page,sel){return page.evaluate(s=>!!document.activeElement&&!!document.activeElement.closest(s),sel);}
async function isFocused(locator){return locator.evaluate(e=>e===document.activeElement);}
async function coarseOf(page){return page.evaluate(()=>matchMedia('(hover: none) and (pointer: coarse)').matches);}
async function settledCapture(page,file){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 // "Zero overlaps": cards inside each card group, mood buttons, and the page sections in order.
 const geometry=await page.evaluate(()=>{const boxes=sel=>[...document.querySelectorAll(sel)].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect());
  const overlaps=rs=>{let n=0;for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){const a=rs[i],b=rs[j];if(a.right>b.left+1&&a.left<b.right-1&&a.bottom>b.top+1&&a.top<b.bottom-1)n++;}return n;};
  const groups={};for(const sel of ['#pick-grid > .card','#start-grid > .card','#mood-grid > .mood-btn','#mood-cards > .card','#recent-grid > .card','#saved-grid > .card','#game-grid > [data-card]'])groups[sel]={count:boxes(sel).length,overlaps:overlaps(boxes(sel))};
  const sections=['#hero-section','#trust-strip','#pick-section','#start-section','#mood-section','#again-section','#all-games','#teacher-section'].map(s=>document.querySelector(s)).filter(e=>e&&e.getClientRects().length).map(e=>({id:e.id,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}));
  return{groups,sections};});
 for(const [sel,g] of Object.entries(geometry.groups))assert.equal(g.overlaps,0,'Cards overlap inside '+sel);
 for(let i=1;i<geometry.sections.length;i++)assert(geometry.sections[i-1].bottom<=geometry.sections[i].top+1,'Adjacent sections overlap: '+geometry.sections[i].id);
 fs.writeFileSync(path.join(out,file+'-geometry.json'),JSON.stringify(geometry,null,2));
 await page.screenshot({path:path.join(out,file+'.png'),fullPage:false});
 return geometry.sections.length;
}
function lum(c){const[r,g,b]=c.match(/\d+(\.\d+)?/g).slice(0,3).map(v=>{v=v/255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b;}
async function ink(page,sel){// Contrast from the PAINTED colours and the first ancestor that actually paints.
 return page.locator(sel).first().evaluate((e,lumSrc)=>{const lum=new Function('return '+lumSrc)();
  let bg=getComputedStyle(e).backgroundColor,node=e;
  while(node&&(bg==='rgba(0, 0, 0, 0)'||bg==='transparent')){node=node.parentElement;if(!node)break;bg=getComputedStyle(node).backgroundColor}
  const cs=getComputedStyle(e),a=lum(cs.color),b=lum(bg),r=e.getBoundingClientRect();
  return {ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05),px:parseFloat(cs.fontSize),weight:cs.fontWeight,w:r.width,h:r.height,clipped:e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1};},lum.toString());}
let served=null;
(async()=>{const browser=await chromium.launch({headless:true,channel:process.env.PLAY_BROWSER_CHANNEL||'chrome',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});report.browser=browser.version();
await test('payloads-catalogue-and-initial-dependencies',async()=>{for(const p of build.payloads){assert.equal(p.published_sha256,baselineHashes.get(p.path),'Game payload changed from approved baseline: '+p.route);const r=await fetch(base+'/'+encodeURI(p.path));assert.equal(r.status,200,p.route);assert.equal(sha(Buffer.from(await r.arrayBuffer())),p.published_sha256,p.route);}assert.equal(build.counts.game_payloads,76);assert.equal(build.counts.missing_initial_load_refs,0);assert.equal(build.counts.external_initial_load_refs,0);assert.equal(data.games.length,76);assert.equal(catalogue.length,data.counts.games);assert.equal(activities.length,data.counts.activities+data.counts.staff);return {payloads:76,byteMatches:76,initialMissing:0,initialExternal:0,counts:data.counts};});
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
 // A gameplay clip is byte-bound like a screen: when the built payload is another approved revision the
 // builder shows no clip and reports the omission, so the report is expected to carry it and the card to hold no clip.
 const clipRoutes=new Map();for(const clip of JSON.parse(fs.readFileSync('domain-split/play/media/manifest.json')).clips.filter(c=>c.status==='accepted')){const k=key(clip.route);clipRoutes.set(k,(clipRoutes.get(k)||[]).concat(clip));}
 for(const [k,candidates] of clipRoutes){const g=data.games.find(g=>key(g.route)===k),payload=build.payloads.find(p=>key(p.route)===k);assert(g);
  if(candidates.some(c=>c.published_sha256===payload.published_sha256))continue;
  assert(!g.media?.video);assert(!g.media?.poster);expectedOmissions.push({route:g.route,kind:'clip',reason:'Different approved game revision'});
 }
 const order=rows=>rows.map(x=>JSON.stringify(x)).sort();assert.deepEqual(order(omitted),order(expectedOmissions),'Every omitted optional asset must be reported');
 if(process.env.PLAY_REQUIRE_COMPLETE_DISCOVERY==='1')assert.equal(omitted.length,0,'Release-source review requires complete image and selection coverage');
 assert(!data.games.some(g=>g.image&&g.image.endsWith('.svg')),'illustrated covers cannot stand in for game captures');
 return{reviewedRoutes,realScreens,byteBound:true,omittedDiscovery:omitted,completeDiscovery:omitted.length===0};
});
await test('static-page-one-dom-vocabulary-and-one-count',async()=>{const html=await (await fetch(base+'/')).text();for(const word of ['In-game screenshot','Cover artwork','Ver.'])assert.equal((html.match(new RegExp(word.replace('.','\\.'),'g'))||[]).length,0,'retired vocabulary present: '+word);for(const old of ['games and activities','catalogue games ·','large-number','Choose your next adventure','Recently updated'])assert(!html.includes(old),'old shelf copy present: '+old);
 served=JSON.parse(html.match(/<script id="play-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 const countStatements=html.match(/<p[^>]*id="result-count"[^>]*>([^<]*)<\/p>/g)||[];assert.equal(countStatements.length,1,'exactly one count statement');assert.equal(countStatements[0].replace(/<[^>]+>/g,''),catalogue.length+' games','count statement is derived from the catalogue');
 const cards=[...html.matchAll(/<article[^>]*data-card="([^"]+)"[^>]*data-games="([^"]+)"[^>]*data-mood="([^"]+)"/g)].map(m=>({id:m[1],games:m[2],mood:m[3]}));const cardIds=cards.map(c=>c.id);
 assert.equal(cardIds.length,new Set(cardIds).size,'duplicate data-card ids');assert.equal(cardIds.length,expectedCards,'one grid card per catalogue game');assert.deepEqual([...cardIds].sort(),catalogue.map(g=>g.id).sort(),'the grid cards are exactly the catalogue');
 assert.deepEqual([...html.matchAll(/data-release="([^"]+)"/g)].map(m=>m[1]).sort(),catalogue.filter(g=>g.updated).map(g=>g.id).sort(),'one served release marker per updated row, none twice');
 for(const m of html.matchAll(/<span class="upd-ribbon"[^>]*>([^<]*)<\/span>/g)){assert(!/\btitle=/.test(m[0]),'served ribbon carries no dated title');assert.equal(m[1],'Updated','served ribbon text is Updated only');}
 for(const c of cards){const g=catalogue.find(x=>x.id===c.id);assert.equal(c.games,c.id,'a card carries its own game only: '+c.id);assert.equal(c.mood,spec(g).primary,'card mood is the reviewed primary mood: '+c.id);}
 // The spotlight, shelves and lanes are retired; the manifest's own featured rules are unchanged.
 assert.equal(catalogue.filter(g=>g.spotlight).length,1,'the manifest flags exactly one spotlight row');assert(catalogue.some(g=>g.featured),'the manifest carries a featured flag');
 for(const retired of ['data-spot=','data-shelf=','id="spotlight"','id="filters-open"','data-feature="','class="lane'])assert(!html.includes(retired),'retired shelf element present: '+retired);
 const gridHtml=html.slice(html.indexOf('id="game-grid"'));for(const retired of ['data-info=','data-watch=','<video','lane-track','see-all'])assert(!gridHtml.slice(0,gridHtml.indexOf('</main>')).includes(retired),'cards carry Play only; found '+retired);
 // The staff calibration item: published, never on the pupil page or in its data.
 assert.equal(staffRows.length,1,'one staff row in the catalogue');for(const s of staffRows){for(const needle of [s.route,decodeURIComponent(s.route),s.id,s.title])assert(!html.includes(needle),'staff item reached the pupil page: '+needle);const r=await fetch(base+s.route);assert.equal(r.status,200,'the staff item stays published at its own route');}
 assert.deepEqual(served.games.map(g=>g.id).sort(),pupilRows.map(g=>g.id).sort(),'inline data = games + classroom activities, no staff row');
 // Moods: order, labels and counts derived from the committed data; the All button counts the catalogue.
 const buttons=[...html.matchAll(/<button type="button" class="mood-btn" data-mood="([^"]+)" aria-pressed="(true|false)"(?: aria-label="([^"]*)")?>([\s\S]*?)<\/button>/g)].map(m=>({id:m[1],pressed:m[2],aria:m[3],inner:m[4]}));
 assert.deepEqual(buttons.map(b=>b.id),['all',...moodIds],'mood buttons in the committed order');assert.equal(buttons[0].pressed,'true');assert.match(buttons[0].inner,new RegExp('>'+moodSpec.all_label.replace('{n}',catalogue.length)+'<'),'All button counts the catalogue');
 const moodCounts={};for(const m of moodSpec.moods){const b=buttons.find(x=>x.id===m.id),n=moodMembers(m.id).length;assert(n>0,'a mood with no games: '+m.id);moodCounts[m.id]=n;assert.equal(b.aria,htmlEsc(m.label)+', '+n+' games','mood aria-label derived: '+m.id);assert(b.inner.includes('class="mood-label">'+htmlEsc(m.label)+'<'),'mood label: '+m.id);assert.match(b.inner,new RegExp('class="mood-count" aria-hidden="true">'+n+'<'),'mood count derived: '+m.id);assert.equal(served.moods.find(x=>x.id===m.id).count,n,'inline mood count derived: '+m.id);}
 // Every catalogue row carries the reviewed discovery fields; hooks are short and end in a full stop.
 for(const g of catalogue){const x=served.games.find(r=>r.id===g.id).discovery,s=spec(g);assert(x,'no discovery fields for '+g.id);assert.equal(x.primary,s.primary);assert.equal(x.secondary||null,s.secondary||null);assert.equal(x.hook,s.hook);assert.equal(x.picture,s.picture);assert.equal(x.wholeClass,s.whole_class);assert.equal(x.twoPlayer,s.two_player);assert.equal(x.keysOnly,keysOnly(g),'keys-only follows the verified controls: '+g.id);assert(moodIds.includes(s.primary)&&(!s.secondary||moodIds.includes(s.secondary)),'invented mood on '+g.id);assert(s.hook.split(/\s+/).length<=8&&/\.$/.test(s.hook),'hook over eight words or unpunctuated: '+g.id);assert.equal(s.title,shown(g),'discovery title matches the catalogue: '+g.id);}
 for(const g of activities)assert(!served.games.find(r=>r.id===g.id)?.discovery,'activities carry no game discovery fields');
 // Packs and Today's pool: committed, catalogue-only, touch-ready and not whole-class.
 assert.deepEqual(served.packs.map(p=>({slug:p.slug,name:p.name,games:p.games})),packs,'served packs = committed packs');assert.deepEqual(served.todayPool,todayPool,'served pool = committed pool');
 const touchReady=id=>{const g=catalogue.find(x=>x.id===id);return g.controls.includes('touch')&&!spec(g).whole_class;};
 for(const p of packs){assert.equal(p.games.length,3,'a pack holds three games: '+p.slug);assert.equal(new Set(p.games).size,3);assert(p.games.every(touchReady),'a pack game is not touch-ready: '+p.slug);}
 assert(todayPool.length>=10&&new Set(todayPool).size===todayPool.length&&todayPool.every(touchReady),'Today pool: ten or more distinct touch-ready games');
 // Safe for schools strip (23 Nov): the committed words only, straight under the game of the week, one link to the lessons site, no Play link.
 const strip=(html.match(/<aside class="trust-strip" id="trust-strip"[\s\S]*?<\/aside>/)||[''])[0];assert(strip,'Safe for schools strip present');
 assert.equal(strip.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),'Safe for schools No login No adverts Saves stay on this device Plays in the browser Built by a teacher. Free lessons at madebymatt.uk','the strip says the committed words and nothing else');
 assert(!/data-play/.test(strip),'the strip launches no game');assert.deepEqual([...strip.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),['https://madebymatt.uk/'],'the strip holds one link, to the lessons site');
 assert(html.indexOf('id="hero-section"')<html.indexOf('id="trust-strip"')&&html.indexOf('id="trust-strip"')<html.indexOf('id="pick-section"'),'the strip sits between the game of the week and More to play');
 // Start here: the committed list minus the game of the week, four to six touch-ready games, server-rendered, no grid markers.
 const startIds=[...html.matchAll(/<article[^>]*data-start="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(startIds,startWant,'Start here = the committed list minus the game of the week');assert(startIds.length>=4&&startIds.length<=6,'Start here shows four to six games');
 for(const id of startIds){const g=catalogue.find(x=>x.id===id);assert(touchReady(id)&&!keysOnly(g),'a Start here game is not touch-ready: '+id);}
 assert(html.indexOf('id="pick-section"')<html.indexOf('id="start-section"')&&html.indexOf('id="start-section"')<html.indexOf('id="mood-section"'),'Start here sits between More to play and the moods');
 const startHtml=html.slice(html.indexOf('id="start-section"'),html.indexOf('id="mood-section"'));assert(!/data-card=|data-release=|data-favourite=|data-pick=/.test(startHtml),'Start here cards carry no grid markers, ribbons or hearts');
 // Covers: byte-bound like the retired hero motif, served from the one cover folder.
 const coverEvidence={};for(const [name,rec] of Object.entries(moodSpec.covers)){const src=fs.readFileSync(path.join('domain-split/play/covers',name));assert.equal(sha(src),rec.sha256,'cover source drift: '+name);assert.equal(src.length,rec.bytes);const r=await fetch(base+'/assets/play2/covers/'+name);assert.equal(r.status,200,name);const b=Buffer.from(await r.arrayBuffer());assert.equal(sha(b),rec.sha256,'served cover bytes differ: '+name);assert(!/<\s*(script|image|text|foreignObject|use|a)\b|href\s*=|@import|on[a-z]+\s*=/i.test(b.toString('utf8')),'cover carries scripted or linked content: '+name);coverEvidence[name]=rec.bytes;}
 const pictures=[...new Set(catalogue.map(g=>spec(g).picture))];for(const p of pictures){const r=await fetch(base+p);assert.equal(r.status,200,'card picture missing: '+p);}
 assert(Object.keys(moodSpec.covers).every(n=>catalogue.some(g=>spec(g).picture==='/assets/play2/covers/'+n)),'a recorded cover is used by no game');
 const retiredHero=await fetch(base+'/assets/play/hero-art.webp');assert.equal(retiredHero.status,404,'retired hero-art.webp is not served');
 for(const literal of ['>Game of the week<','>More to play<','What do you feel like?','placeholder="Search games','>Play again<','Every game, A to Z','Teacher corner','How to play guides','Privacy and saved progress','Report a problem','Made by Matt Play','No login','Your progress stays on this device','Optional usage statistics — off until you allow it.','Read what is counted.','>Allow<','>Keep off<','usage-client.js','>Editions<','>Your progress<','id="dialog-saves"','>Transfer saves<','>Favourite<','>Share<','href="/game-saves/"','Every game is listed below as a direct Play link'])assert(html.includes(literal),'copy missing: '+literal);
 assert(!/<(a|button)[\s>][^>]*>(?:(?!<\/(a|button)>).)*<(a|button)[\s>]/s.test(html.replace(/<script[\s\S]*?<\/script>/g,'')),'nested interactive elements');
 return{cards:cardIds.length,moods:moodCounts,packs:packs.length,todayPool:todayPool.length,covers:coverEvidence,pictures:pictures.length,staffOnPage:0,countStatement:countStatements[0].replace(/<[^>]+>/g,''),retiredVocabulary:0};});
for(const width of [320,390,768,1280,1440]){
 const ctx=await browser.newContext({viewport:{width,height:width<700?844:900},isMobile:width<700,hasTouch:width<700,reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(10000);currentPage=page;const requests=[];page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>report.errors.push({width,message:e.message}));
 const height=width<700?844:900;
 await test(width+'-layout-navigation-and-first-load',async()=>{await page.goto(base);await ready(page);await overflow(page);
  assert.equal(await page.locator('#pick-heading').innerText(),'More to play');assert.equal(await page.locator('h1').innerText(),shown(catalogue.find(g=>g.id===heroId)),'the one page heading is the game of the week');assert.equal(await page.locator('h1').count(),1,'one page heading');
  // PLAY-P1 part B retired hero-art.webp; D2 retires the inline motif too. Its byte binding moved to the covers.
  assert.equal(await page.locator('.intro-art').count(),0,'the masthead motif is retired');assert(!requests.some(u=>/hero-art/i.test(u)),'no request for retired hero-art asset');
  // The first picture is near the top of the first screen and every Pick-a-game card has a picture.
  const pick=await page.evaluate(()=>[...document.querySelectorAll('#pick-grid > .card')].map(c=>{const r=c.querySelector('.card-media').getBoundingClientRect(),b=c.getBoundingClientRect();return{id:c.dataset.pick,picTop:r.top,bottom:b.bottom,img:!!c.querySelector('.card-media img')};}));
  assert.equal(pick.length,4,'four Pick-a-game cards');assert(pick.every(p=>p.img),'every Pick-a-game card has a picture');const heroBox=await page.evaluate(()=>{const m=document.querySelector('#hero-media').getBoundingClientRect(),c=document.querySelector('#hero-section .hero-card').getBoundingClientRect(),p=document.querySelector('#hero-play').getBoundingClientRect();return{picTop:m.top,cardBottom:c.bottom,playBottom:p.bottom};});assert(heroBox.picTop<=Math.max(140,height*0.2),'the first picture (game of the week) starts in the top of the first screen: '+heroBox.picTop);assert(heroBox.cardBottom<=height+1&&heroBox.playBottom<=height+1,'the whole game of the week card and its Play button are on the first screen at '+width);
  if(width===390||width>=1280)assert(pick[0].picTop>=heroBox.cardBottom-1&&pick[0].picTop<height,'the first More-to-play picture starts on the first screen, below the game of the week, at '+width+': '+pick[0].picTop);
  // Safe for schools strip and Start here under the page font and two wide fallback fonts: the strip sits between
  // the game of the week and More to play, nothing in it is clipped or under 44px, it stays one row on wide screens,
  // and More to play still starts on the first screen.
  for(const font of [null,'DejaVu Sans','Verdana']){const tag=font?await page.addStyleTag({content:'*{font-family:"'+font+'",sans-serif !important}'}):null;await page.waitForTimeout(50);
   const t=await page.evaluate(()=>{scrollTo(0,0);const s=document.querySelector('#trust-strip'),r=s.getBoundingClientRect(),hero=document.querySelector('#hero-section .hero-card').getBoundingClientRect(),pick=document.querySelector('#pick-section').getBoundingClientRect(),pic=document.querySelector('#pick-grid > .card .card-media').getBoundingClientRect(),link=s.querySelector('a').getBoundingClientRect();
    const parts=[...s.querySelectorAll('.trust-title,.trust-items > span,.trust-link')];return{top:r.top,bottom:r.bottom,h:r.height,heroBottom:hero.bottom,pickTop:pick.top,picTop:pic.top,linkH:link.height,linkW:link.width,wide:s.scrollWidth>s.clientWidth+1||r.right>document.documentElement.clientWidth+1,clipped:parts.filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent.trim()),escaped:parts.filter(e=>{const b=e.getBoundingClientRect();return b.left<r.left-0.5||b.right>r.right+0.5||b.top<r.top-0.5||b.bottom>r.bottom+0.5;}).map(e=>e.textContent.trim()),
     start:[...document.querySelectorAll('#start-grid > .card')].map(c=>({tags:c.querySelector('.media-tags').getBoundingClientRect(),media:c.querySelector('.card-media').getBoundingClientRect()})).filter(x=>x.tags.right>x.media.right+0.5||x.tags.left<x.media.left-0.5).length};});
   if(tag)await tag.evaluate(x=>x.remove());const label=font||'page font';
   assert(t.top>=t.heroBottom-1&&t.bottom<=t.pickTop+1,'the Safe for schools strip sits between the game of the week and More to play ('+label+')');assert(!t.wide,'the strip overflows sideways ('+label+')');
   assert.deepEqual(t.clipped,[],'strip words are clipped ('+label+')');assert.deepEqual(t.escaped,[],'strip words escape the strip ('+label+')');assert(t.linkH>=43.5&&t.linkW>=43.5,'the lessons link meets the 44px target ('+label+')');
   if(width>=1280)assert(t.h<=64,'the strip stays one row at '+width+' ('+label+'): '+t.h);
   if(width===390||width>=1280)assert(t.picTop<height,'More to play still starts on the first screen under the strip at '+width+' ('+label+'): '+t.picTop);
   assert.equal(t.start,0,'a Start here mood chip leaves its picture ('+label+')');}
  assert.equal(await page.locator('#start-grid > .card').count(),startWant.length,'Start here shows the committed games');
  if(width===1280){
   const posters=await page.evaluate(async()=>{document.querySelector('#expand-btn').click();const imgs=[...document.querySelectorAll('#game-grid .game-card .card-media img, #pick-grid .card-media img')];for(const img of imgs){img.loading='eager';if(!img.complete)await img.decode().catch(()=>{});}const out={imgs:imgs.length,failed:document.querySelectorAll('#game-grid .card-media.failed, #pick-grid .card-media.failed').length,bad:imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src')),covers:imgs.filter(i=>/\/assets\/play2\/covers\//.test(i.getAttribute('src'))).filter(i=>i.naturalWidth!==640||i.naturalHeight!==360).map(i=>i.getAttribute('src'))};document.querySelector('#expand-btn').click();return out;});
   assert.equal(posters.failed,0,'every card shows its picture rather than the fallback');assert.equal(posters.imgs,expectedCards+4,'every grid and Pick-a-game card has a picture');assert.deepEqual(posters.bad,[],'every card picture decodes');assert.deepEqual(posters.covers,[],'every cover decodes at 640x360');
  }
  await page.evaluate(()=>scrollTo(0,0));
  const tokenResponse=await page.request.get(base+'/assets/mbm-tokens.css');assert.equal(tokenResponse.status(),200,'Composed Play tokens must resolve locally');
  assert.equal(sha(Buffer.from(await tokenResponse.body())),sha(fs.readFileSync('assets/mbm-tokens.css')),'Token bytes match the pinned Site source');
  assert.equal(await page.locator('link[rel=stylesheet][href="/assets/mbm-tokens.css"]').count(),1,'One origin-local token link');
  const header=page.locator('header[data-mbm-chrome="play"]');assert.equal(await header.getAttribute('data-theme'),'dark');
  assert.equal(await header.locator('.brand strong').innerText(),'Play');
  assert.equal(await page.getByText('Learn • Build • Explore').count(),0,'the education motto has left the Play surface');
  // The brand lock-up's contrast is measured against its own painted background, not assumed from the token.
  const brandInk=await ink(page,'header .brand-text');assert(brandInk.ratio>=4.5,'Play brand contrast '+brandInk.ratio.toFixed(2)+':1 is below AA for its '+brandInk.px+'px weight '+brandInk.weight);
  assert(await header.locator('.brand img').evaluate(e=>e.complete&&e.naturalWidth>0));
  const tokenStyle=await header.evaluate(e=>({ink:getComputedStyle(e).getPropertyValue('--text').trim(),token:getComputedStyle(e).getPropertyValue('--mbm-primary').trim()}));assert.equal(tokenStyle.ink,tokenStyle.token,'Header adopts dark token ink');
  await targets(page,'header');await page.locator('#search-jump').click();assert(await isFocused(page.locator('#query')),'Find moves focus to the search field');
  // The A-Z grid: every catalogue game once; twelve shown until Show all; nothing hidden from the DOM.
  const collapsed=Math.min(served.collapsed,expectedCards);assert.equal(await visible(page).count(),collapsed,'the grid opens collapsed');
  const expand=page.locator('#expand-btn');assert.equal(await expand.innerText(),'Show all '+catalogue.length);assert.equal(await expand.getAttribute('aria-expanded'),'false');
  await expand.click();assert.equal(await visible(page).count(),expectedCards,'Show all shows every card');assert.equal(await expand.getAttribute('aria-expanded'),'true');assert.equal(await expand.innerText(),'Show fewer');
  await expand.click();assert.equal(await visible(page).count(),collapsed,'Show fewer collapses again');
  const order=await page.locator('#game-grid [data-card]').evaluateAll(e=>e.map(x=>x.dataset.card)),coarse=await coarseOf(page);
  const az=azSort(catalogue).map(g=>g.id),wantOrder=coarse?[...az.filter(id=>!keysOnly(catalogue.find(g=>g.id===id))),...az.filter(id=>keysOnly(catalogue.find(g=>g.id===id)))]:az;assert.deepEqual(order,wantOrder,'A to Z, keyboard-only games last on a touch screen');
  const cardFacts=await page.locator('#game-grid [data-card]').evaluateAll(e=>e.map(c=>({id:c.dataset.card,title:c.querySelector('.card-title').textContent,hook:c.querySelector('.card-hook').textContent,label:c.querySelector('a[data-play]').getAttribute('aria-label'),links:c.querySelectorAll('a[href]').length})));
  for(const c of cardFacts){const g=catalogue.find(x=>x.id===c.id);assert.equal(c.title,shown(g));assert.equal(c.hook,spec(g).hook);assert.equal(c.label,'Play '+shown(g)+(g.updated?', '+updatedLabel(g).toLowerCase():''));assert.equal(c.links,1,'one link per card: '+c.id);}
  // J92 R6 / TX (e): Updated is derived; one ribbon per updated row, on its own card, clear of the mood chip.
  const ribbons=await page.locator('#game-grid [data-release]').evaluateAll(e=>e.map(x=>({id:x.dataset.release,card:x.closest('[data-card]').dataset.card,title:x.getAttribute('title'),text:x.textContent})));
  assert.deepEqual(ribbons.map(r=>r.id).sort(),catalogue.filter(g=>g.updated).map(g=>g.id).sort(),'one Updated ribbon per updated catalogue row');for(const r of ribbons){const g=catalogue.find(x=>x.id===r.id);assert.equal(r.card,r.id);assert.equal(r.title,null,'no date on the ribbon: '+r.id);assert.equal(r.text,updatedLabel(g));}
  for(const c of cardFacts){const g=catalogue.find(x=>x.id===c.id);if(g.updated)assert(!/\d/.test(c.label.slice(('Play '+shown(g)).length))&&!/\bv(ersion)?\s*\d/i.test(c.label.slice(('Play '+shown(g)).length)),'no date or version text in the updated label: '+c.id);}
  // The ribbon must stay clear of the chip under any reader font, not just the one this machine has:
  // measured with the page's own font and again with a wide fallback forced on every element
  // (the runner's DejaVu Sans made Hold the Mark and Neon Siege collide at 768 on 21 Nov).
  await expand.click();const ribbonFit=async()=>page.evaluate(()=>[...document.querySelectorAll('#game-grid [data-release]')].filter(x=>x.getClientRects().length).map(x=>{const media=x.closest('.card-media'),chip=media.querySelector('.mood-chip'),a=x.getBoundingClientRect(),b=chip.getBoundingClientRect(),m=media.getBoundingClientRect(),word=chip.querySelector(':scope > span');return{id:x.dataset.release,clash:a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1,outside:a.left<m.left-0.5||a.right>m.right+0.5||a.top<m.top-0.5||a.bottom>m.bottom+0.5,wordHidden:!word||getComputedStyle(word).display==='none'||word.getClientRects().length===0};}));
  const heroFit=async()=>page.evaluate(()=>{scrollTo(0,0);const sec=document.querySelector('#hero-section'),card=sec&&sec.querySelector('.hero-card'),media=sec&&sec.querySelector('#hero-media'),img=media&&media.querySelector('img'),lbl=sec&&sec.querySelector('#hero-label'),ttl=sec&&sec.querySelector('#hero-title'),line=sec&&sec.querySelector('#hero-line'),play=sec&&sec.querySelector('#hero-play');if(!sec||!card||!media||!img||!lbl||!ttl||!line||!play)return{missing:true};
   const cw=document.documentElement.clientWidth,ch=document.documentElement.clientHeight,cr=card.getBoundingClientRect(),mr=media.getBoundingClientRect(),ir=img.getBoundingClientRect(),pr=play.getBoundingClientRect();
   const parts=[media,lbl,ttl,line,play].map(e=>e.getBoundingClientRect()),over=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
   let partOverlap=false;for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(over(parts[i],parts[j]))partOverlap=true;
   const outside=parts.some(r=>r.left<cr.left-0.5||r.right>cr.right+0.5||r.top<cr.top-0.5||r.bottom>cr.bottom+0.5);
   const clipped=[lbl,ttl,line,play].some(e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+1);
   return{missing:false,firstInMain:document.querySelector('main')?.firstElementChild===sec,overflow:cr.right>cw+1||sec.scrollWidth>sec.clientWidth+1,aboveFold:cr.bottom<=ch+1,mediaRatio:mr.width/mr.height,mediaFill:Math.abs(ir.width-mr.width)<1&&Math.abs(ir.height-mr.height)<1,mediaFit:getComputedStyle(img).objectFit,playW:pr.width,playH:pr.height,partOverlap,outside,clipped,hasAlt:Boolean((img.getAttribute('alt')||'').trim())};});
  for(const font of [null,'DejaVu Sans','Verdana']){const tag=font?await page.addStyleTag({content:'*{font-family:"'+font+'",sans-serif !important}'}):null;await page.waitForTimeout(50);const fit=await ribbonFit();const hf=await heroFit();if(tag)await tag.evaluate(t=>t.remove());const label=font||'page font';
   assert.equal(fit.length,catalogue.filter(g=>g.updated).length,'every Updated ribbon measured ('+label+')');assert.deepEqual(fit.filter(f=>f.clash).map(f=>f.id),[],'an Updated ribbon overlaps its mood chip ('+label+')');assert.deepEqual(fit.filter(f=>f.outside).map(f=>f.id),[],'an Updated ribbon leaves its picture ('+label+')');assert.deepEqual(fit.filter(f=>f.wordHidden).map(f=>f.id),[],'a mood word is hidden to make room ('+label+')');
   assert(!hf.missing,'hero section present ('+label+')');assert(hf.firstInMain,'hero section is first in <main> ('+label+')');assert(!hf.overflow,'hero card overflows horizontally ('+label+')');assert(hf.aboveFold,'hero card fits above the fold ('+label+')');assert(Math.abs(hf.mediaRatio-16/9)<=0.02,'hero media keeps 16:9 aspect ('+label+')');assert(hf.mediaFill&&hf.mediaFit==='cover','hero media fills 16:9 box with cover ('+label+')');assert(hf.playW>=43.5&&hf.playH>=43.5,'hero PLAY button meets 44px target ('+label+')');assert(!hf.partOverlap,'hero elements overlap ('+label+')');assert(!hf.outside,'hero element escapes card ('+label+')');assert(!hf.clipped,'hero text is clipped ('+label+')');assert(hf.hasAlt,'hero image has alt text ('+label+')');}
  await expand.click();
  // Ruling 21 Nov: every card picture, whatever its own shape, is cropped into one even 16:9 frame.
  await page.mouse.move(0,0);await expand.click();const frames=await page.evaluate(()=>[...document.querySelectorAll('.card-media')].filter(m=>m.getClientRects().length).map(m=>{const a=m.getBoundingClientRect(),i=m.querySelector('img'),c=i.getBoundingClientRect();return{src:i.getAttribute('src'),ratio:a.width/a.height,fill:Math.abs(c.width-a.width)<1&&Math.abs(c.height-a.height)<1,fit:getComputedStyle(i).objectFit};}));await expand.click();
  assert(frames.length>=expectedCards,'every grid card has a picture frame');const uneven=frames.filter(f=>Math.abs(f.ratio-16/9)>0.02||!f.fill||f.fit!=='cover').map(f=>f.src);assert.deepEqual(uneven,[],'card pictures sit in a 16:9 frame with object-fit: cover');
  const hrefs=await gridHrefs(page);const covered=coverage(hrefs,routesOf(catalogue));const control=coverageControl(hrefs);
  assert.equal(await page.locator('#classroom [data-activity] a[data-play]').count(),classActivities.length,'every classroom activity in the Teacher corner');
  const all=await page.evaluate(()=>[...new Set([...document.querySelectorAll('a[data-play][href]')].map(a=>a.getAttribute('href')))]);assert.deepEqual(all.sort(),pupilRows.map(g=>g.route).sort(),'every pupil route reachable by href, and nothing else');
  for(const s of staffRows)assert.equal(await page.locator('a[href="'+s.route+'"]').count(),0,'the staff item is not linked from the pupil page');
  await noMedia(requests);const total=firstParty(requests);
  for(const retired of ['[data-shelf]','#spotlight','#filters-open','.lane','.collection-links'])assert.equal(await page.locator(retired).count(),0,'retired: '+retired);
  assert.equal(await page.locator('.az-list').count(),0,'the A to Z fallback stays inside noscript when JavaScript runs');
  await page.evaluate(()=>scrollTo(0,0));await settledCapture(page,width+'-home');await page.locator('#all-games-title').scrollIntoViewIfNeeded();await settledCapture(page,width+'-browse');
  await page.locator('.menu summary').click();assert.deepEqual((await page.getByRole('navigation',{name:'Main menu'}).locator('a').allInnerTexts()).map(t=>t.trim()),['Education site','Save Vault','How to play guides','Teacher corner']);await targets(page,'.menu-panel');await page.keyboard.press('Escape');assert.equal(await page.locator('.menu').getAttribute('open'),null);assert(await isFocused(page.locator('.menu summary')));
  return{viewport:{width,height},noOverflow:true,cards:expectedCards,collapsed,firstPictureTop:Math.round(pick[0].picTop),catalogueHrefsCoveredOnce:covered,coverageControl:control,classroomRows:classActivities.length,routesReachable:all.length,staffLinks:0,requests:total,thirdParty:0,initialMediaRequests:0,brandContrast:Number(brandInk.ratio.toFixed(2))};});

 // Spotlight -> Pick a game. This week's pack by ISO week, Today's pick by local date, both derived
 // independently here; nothing advances on its own; no video; ?pack= forces a named pack.
 await test(width+'-pick-a-game-pack-today-and-no-autoplay',async()=>{await page.goto(base);await ready(page);
  const todayIso=await page.evaluate(()=>{const n=new Date();return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');});
  const want=expectedSchedule(todayIso),pack=packs.find(p=>p.slug===want.pack);
  const shownIds=()=>page.locator('#pick-grid > .card').evaluateAll(e=>e.map(x=>x.dataset.pick));
  const wantIds=expectedPick(todayIso);assert.deepEqual(await shownIds(),wantIds,'the pack games without the game of the week, any top-up, then Today\'s pick');assert.equal(await page.locator('#pack-tag').innerText(),'This week: '+pack.name);
  assert.equal(await page.locator('#pick-grid > .card').nth(3).locator('.today-ribbon').innerText(),'Today');assert.equal(await page.locator('#pick-grid .today-ribbon').count(),1);
  await pause(2500);assert.deepEqual(await shownIds(),wantIds,'nothing advances on its own (reduced motion set)');
  for(const id of wantIds)assert.equal(await page.locator('#pick-grid [data-pick="'+id+'"] a[data-play]').getAttribute('href'),catalogue.find(g=>g.id===id).route,'Pick-a-game card destination');
  assert.equal(await page.locator('video').count(),0,'no video anywhere on the page');
  const y=expectedSchedule(isoOf(Date.UTC(...todayIso.split('-').map((v,i)=>i===1?Number(v)-1:Number(v)))-86400000));assert.equal(await page.locator('#yesterday-bar a[data-play]').getAttribute('href'),catalogue.find(g=>g.id===y.today).route,'Yesterday\'s pick links to yesterday\'s game');
  // The page's own schedule agrees with the independent one for a year and a day, across the year end.
  const days=[];for(let t=Date.UTC(2026,10,1);t<=Date.UTC(2027,10,1);t+=86400000)days.push(isoOf(t));
  const page_=await page.evaluate(ds=>ds.map(d=>window.__playSchedule(d)),days);let prev=null;const weeks=new Set();
  for(const s of page_){const w=expectedSchedule(s.date);assert.deepEqual({week:s.week,pack:s.pack,packGames:s.packGames,today:s.today},{week:w.week,pack:w.pack,packGames:w.packGames,today:w.today},'schedule drift on '+s.date);assert(!s.packGames.includes(s.today),'Today\'s pick repeats a pack game on '+s.date);assert.notEqual(s.today,prev,'the same Today\'s pick two days running on '+s.date);prev=s.today;weeks.add(s.pack);}
  assert.equal(weeks.size,packs.length,'every pack comes round within the year');
  const other=packs.find(p=>p.slug!==pack.slug);await page.goto(base+'?pack='+other.slug);await ready(page);{const og=other.games.filter(id=>id!==heroId);assert.deepEqual((await shownIds()).slice(0,og.length),og,'?pack= forces that pack');assert(!(await shownIds()).includes(heroId),'the game of the week is not repeated under ?pack=');}assert.equal(await page.locator('#pack-tag').innerText(),'This week: '+other.name);
  const layout=await page.evaluate(()=>{const cs=[...document.querySelectorAll('#pick-grid > .card')].map(c=>c.getBoundingClientRect());return{cols:new Set(cs.map(r=>Math.round(r.left))).size,widths:cs.map(r=>Math.round(r.width))};});
  if(width<700)assert.equal(layout.cols,2,'two Pick-a-game columns on a phone');else assert(layout.cols>=2,'Pick-a-game spreads across the page');
  await overflow(page);return{date:todayIso,week:want.week,pack:want.pack,today:want.today,yearChecked:days.length,packsInYear:weeks.size,noAutoplay:true,forcedPack:other.slug,layout};});
 // FIN1 D+E. The footer mark and both brand lock-ups, measured rather than
 // assumed, at every width under reduced motion and -- at the phone widths the
 // order names -- at 200% text as well. Contrast is read from the PAINTED colours
 // and the first ancestor that actually paints, for the same reason the header
 // check already is: the masthead redefines --text, so the token is not what the
 // eye gets. The ratios are returned into the report, so the evidence is a number
 // in the record and not a claim in a commit message.
 await test(width+'-footer-mark-and-brand-accessibility',async()=>{
  await page.goto(base);await ready(page);
  // The mark itself: one instance, decorative, actually decoded, and carrying its
  // own box in the markup. A footer that grows when a late JPEG arrives is a
  // layout shift whatever the picture looks like, so the width and height
  // attributes are asserted, not just the rendered size.
  const mark=page.locator('footer .footer-mark');
  assert.equal(await mark.count(),1,'exactly one footer mark');
  assert.equal(await mark.getAttribute('alt'),'','the footer mark is decorative: the link around it is named by the words beside it');
  await mark.scrollIntoViewIfNeeded();
  await mark.evaluate(e=>e.complete?null:new Promise(r=>{e.addEventListener('load',r,{once:true});e.addEventListener('error',r,{once:true});}));
  assert(await mark.evaluate(e=>e.complete&&e.naturalWidth>0),'the footer mark decoded');
  const markBox=await mark.evaluate(e=>{const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),attrW:e.getAttribute('width'),attrH:e.getAttribute('height'),src:e.getAttribute('src')};});
  assert(markBox.attrW&&markBox.attrH,'the footer mark declares its box in the markup, so nothing shifts when it decodes');
  assert(markBox.w>=24&&markBox.h>=24,'footer mark '+markBox.w+'x'+markBox.h+' is under the 24x24 WCAG 2.2 minimum');
  const headerMarkSrc=await page.locator('header .brand img').getAttribute('src');
  assert.equal(markBox.src,headerMarkSrc,'the footer carries the SAME approved mark bytes as the header, not a second asset');
  assert(await page.locator('header .brand img').evaluate(e=>e.getAttribute('width')&&e.getAttribute('height')),'the header mark declares its box too');
  const homeLink=page.locator('footer a.footer-brand');
  assert.equal(await homeLink.count(),1,'one footer home link');
  assert.equal((await homeLink.innerText()).trim(),'Made by Matt Play','the footer home link is named by its words, not by the image');
  assert.equal(await homeLink.getAttribute('href'),'/','the footer mark returns to the Play home');
  const linkBox=await homeLink.evaluate(e=>{const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),tap:parseFloat(getComputedStyle(e).minHeight)};});
  assert(linkBox.h>=44,'footer home link '+linkBox.w+'x'+linkBox.h+' is under this page 44px tap floor');
  const focusRing=await homeLink.evaluate(e=>{e.focus();const cs=getComputedStyle(e);return {focused:e===document.activeElement,width:cs.outlineWidth,style:cs.outlineStyle};});
  assert(focusRing.focused&&focusRing.style!=='none'&&parseFloat(focusRing.width)>=2,'the footer home link shows a focus ring: '+JSON.stringify(focusRing));
  await targets(page,'footer');
  const contrast={};
  for(const scale of (width<700?[100,200]:[100])){
   await page.evaluate(s=>{document.documentElement.style.fontSize=s+'%'},scale);
   await page.waitForTimeout(120);
   for(const [name,sel] of [['header','header .brand-text'],['footer','footer a.footer-brand span'],['footer-line','footer .footer-line']]){
    const m=await ink(page,sel);
    assert(m.ratio>=4.5,name+' contrast '+m.ratio.toFixed(2)+':1 is below AA at '+scale+'% text ('+m.px+'px weight '+m.weight+')');
    assert(m.w>0&&m.h>0&&(name==='footer-line'||!m.clipped),name+' is clipped or collapsed at '+scale+'% text: '+JSON.stringify(m));
    contrast[name+'@'+scale]=Number(m.ratio.toFixed(2));
   }
   const reflow=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
   assert(reflow.scroll<=reflow.client+1,'horizontal scrolling at '+scale+'% text: '+JSON.stringify(reflow));
  }
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  return {mark:markBox,link:linkBox,focusRing,contrast,reducedMotion:true};});
 // Chips and the Filters drawer -> live search and the eight mood buttons.
 await test(width+'-search-moods-empty-reset',async()=>{await page.goto(base+'?q=Emberwild');await ready(page);assert.equal(await page.locator('#query').inputValue(),'Emberwild');assert.equal(await visible(page).count(),1);assert.match(await visible(page).innerText(),/Emberwild/);assert.equal(await page.locator('#result-count').innerText(),'1 of '+catalogue.length+' games');assert(await page.locator('#expand-wrap').isHidden(),'Show all hides while searching');
  await page.locator('#query').fill('qzx nonexistent');assert.equal(await visible(page).count(),0);assert(await page.locator('#empty-state').isVisible());assert.equal(await page.locator('#result-count').innerText(),'0 of '+catalogue.length+' games');await page.locator('#empty-reset').click();assert.equal(await visible(page).count(),Math.min(served.collapsed,expectedCards));assert.equal(await page.locator('#result-count').innerText(),catalogue.length+' games');assert(await isFocused(page.locator('#all-games-title')),'Clear search moves focus to the results');assert.equal(new URL(await addr(page)).searchParams.get('q'),null,'search cleared from the address');
  assert.equal(await page.locator('main input[type=search]').count(),1,'one search field on the page');assert.equal(await page.locator('main select').count(),0,'no stacked selects on the page');
  await page.locator('#query').fill('Emberwild');assert.equal(new URL(await addr(page)).searchParams.get('q'),'Emberwild','search kept in ?q=');assert(await page.locator('#query-clear').isVisible());await page.locator('#query-clear').click();assert.equal(await page.locator('#query').inputValue(),'');assert(await isFocused(page.locator('#query')));
  await page.locator('#query').fill('Emberwild');await page.locator('#query').press('Escape');assert.equal(await page.locator('#query').inputValue(),'','Escape clears the search');
  // Search covers title, hook, mood labels, the reviewed search words, synonyms and 2 player.
  const vis=async()=>page.locator('#game-grid [data-card]:visible').evaluateAll(e=>e.map(x=>x.dataset.card));
  const hooked=catalogue.map(g=>({g,w:spec(g).hook.replace(/[^\p{L}\p{N}\s-]/gu,'').split(/\s+/).find(w=>w.length>6&&!normalizeWord(shown(g)).includes(normalizeWord(w)))})).find(x=>x.w);
  await page.locator('#query').fill(hooked.w);assert((await vis()).includes(hooked.g.id),'search matches the hook');
  const renamed=catalogue.map(g=>({g,w:g.displayTitle&&g.displayTitle!==g.title&&g.title.replace(/[^\p{L}\p{N}\s-]/gu,'').split(/\s+/).find(w=>w.length>3&&!normalizeWord(g.displayTitle).includes(normalizeWord(w)))})).find(x=>x.w);
  if(renamed){await page.locator('#query').fill(renamed.w);assert((await vis()).includes(renamed.g.id),'search still finds a game by its catalogue name: '+renamed.w);}
  const worded=catalogue.map(g=>({g,w:String(spec(g).words||'').split(/\s+/).find(w=>w.length>5&&!normalizeWord(shown(g)+' '+spec(g).hook).includes(normalizeWord(w)))})).find(x=>x.w);
  if(worded){await page.locator('#query').fill(worded.w);assert((await vis()).includes(worded.g.id),'search matches the reviewed search words');}
  const race=moodSpec.moods.find(m=>m.id==='race')||moodSpec.moods[0];await page.locator('#query').fill(race.label);const raceHits=await vis();assert(moodMembers(race.id).every(g=>raceHits.includes(g.id)),'search matches the mood label');
  const two=catalogue.filter(g=>spec(g).two_player);if(two.length){await page.locator('#query').fill('2 player');const h=await vis();assert(two.every(g=>h.includes(g.id)),'2 player finds every two-player game');}
  const syn=Object.entries(moodSpec.synonyms||{}).map(([w,list])=>({w,g:catalogue.find(g=>list.some(s=>(' '+normalizeWord(shown(g))+' ').includes(' '+normalizeWord(s))))})).find(x=>x.g&&!normalizeWord(shown(x.g)+' '+spec(x.g).hook+' '+(spec(x.g).words||'')).includes(normalizeWord(x.w)));
  if(syn){await page.locator('#query').fill(syn.w);assert((await vis()).includes(syn.g.id),'a synonym finds its game: '+syn.w);}
  await page.locator('#query').fill('');
  // The moods: each button shows its derived games, primary first, and is kept in #mood=.
  const coarse=await coarseOf(page),moodProof={};
  for(const m of moodSpec.moods){const b=page.locator('#mood-grid .mood-btn[data-mood="'+m.id+'"]');await b.click();assert.equal(await b.getAttribute('aria-pressed'),'true');assert.equal(new URL(await addr(page)).hash,'#mood='+m.id);assert(await page.locator('#mood-results').isVisible());
   const prim=azSort(catalogue.filter(g=>spec(g).primary===m.id)),sec=azSort(catalogue.filter(g=>spec(g).secondary===m.id)),dev=l=>coarse?[...l.filter(g=>!keysOnly(g)),...l.filter(g=>keysOnly(g))]:l;
   const ids=await page.locator('#mood-cards > .card').evaluateAll(e=>e.map(x=>x.dataset.pick));assert.deepEqual(ids,[...dev(prim),...dev(sec)].map(g=>g.id),'mood results: primary games A to Z, then secondary: '+m.id);
   assert.equal(await page.locator('#mood-results-title').innerText(),m.label+' ('+ids.length+')');moodProof[m.id]=ids.length;
   assert.equal(await page.locator('#mood-grid .mood-btn[aria-pressed="true"]').count(),1,'one mood pressed at a time');}
  const last=moodSpec.moods[moodSpec.moods.length-1];await page.locator('#mood-grid .mood-btn[data-mood="'+last.id+'"]').click();assert(await page.locator('#mood-results').isHidden(),'pressing the pressed mood clears it');assert.equal(new URL(await addr(page)).hash,'');
  await page.goto(base+'#mood='+race.id);await ready(page);assert(await page.locator('#mood-results').isVisible(),'#mood= opens that mood');assert.equal(await page.locator('#mood-grid .mood-btn[data-mood="'+race.id+'"]').getAttribute('aria-pressed'),'true');
  await page.locator('#mood-back-btn').click();assert(await page.locator('#mood-results').isHidden());assert(await isFocused(page.locator('#mood-grid .mood-btn[data-mood="all"]')),'All games returns focus to the All button');
  await page.locator('#mood-grid .mood-btn[data-mood="'+race.id+'"]').click();await page.goBack();assert(await page.locator('#mood-results').isHidden(),'Back leaves the mood');
  // Retired addresses still open the page whole: the old filters are ignored, never an error.
  for(const old of ['?genre=Sport','?list=favourites','?mood=Calm','?mood=Together&genre=Sport']){await page.goto(base+old);await ready(page);assert.equal(await page.locator('#result-count').innerText(),catalogue.length+' games','retired filter address opens the full page: '+old);assert.equal(await visible(page).count(),Math.min(served.collapsed,expectedCards));}
  return{search:{hook:hooked.w,catalogueName:renamed&&renamed.w,words:worded&&worded.w,mood:race.label,twoPlayer:two.length,synonym:syn&&syn.w},moods:moodProof,coarsePointer:coarse,retiredAddressesOpen:4};});
 await test(width+'-favourites-recent-persistence-save-safety',async()=>{await page.goto(base);await ready(page);await page.evaluate(()=>localStorage.setItem('apexkick.v1','PLAY-QA-SENTINEL'));await page.locator('#query').fill('Emberwild');const heart=page.locator('#game-grid [data-favourite="'+EMBER+'"]');assert(await heart.isVisible(),'the card heart shows with JavaScript');await heart.click();assert.equal(await heart.getAttribute('aria-pressed'),'true','Favourite toggled from the card');assert(!await page.locator('#game-dialog').isVisible(),'the card heart opens nothing');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_play_favourites_v1'))),[EMBER],'Favourite storage');assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).sort()),['apexkick.v1','mbm_play_favourites_v1'],'no new storage keys');
  assert(await page.locator('#again-section').isVisible(),'Play again shows once a game is saved');assert.equal(await page.locator('#saved-grid [data-pick="'+EMBER+'"]').count(),1,'Saved lists the favourite');assert(await page.locator('#recent-block').isHidden());assert(await page.locator('#clear-again-btn').isHidden(),'Clear this list only shows with a recent list');
  await page.reload();await ready(page);assert.equal(await heart.getAttribute('aria-pressed'),'true','favourite persists');assert.equal(await page.locator('#saved-grid [data-pick]').count(),1,'Saved renders from the favourites key');
  await page.locator('#saved-grid [data-favourite="'+EMBER+'"]').click();assert(await page.locator('#again-section').isHidden(),'removing the only favourite empties Play again');assert(await page.evaluate(()=>document.activeElement!==document.body&&document.activeElement.getClientRects().length>0),'removing a favourite leaves visible focus');
  await page.locator('#query').fill('Emberwild');const play=page.locator('#game-grid a[data-play="'+EMBER+'"]');await play.click();await page.waitForURL('**/emberwild/');await page.goBack();await page.waitForSelector('#query');await ready(page);assert.equal(await page.locator('#query').inputValue(),'Emberwild');assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_play_recently_opened_v1'))),[EMBER],'recent key unchanged');assert(await page.evaluate(()=>sessionStorage.getItem('mbm_play_browse_position_v1')!==null),'position key unchanged');
  assert.equal(await page.locator('#recent-grid [data-pick="'+EMBER+'"]').count(),1,'Play again renders from the recent key');
  const five=catalogue.slice(0,5).map(g=>g.id);await page.evaluate(ids=>localStorage.setItem('mbm_play_recently_opened_v1',JSON.stringify(ids)),five);await page.reload();await ready(page);assert.deepEqual(await page.locator('#recent-grid > .card').evaluateAll(e=>e.map(x=>x.dataset.pick)),five.slice(0,3),'Play again shows the three most recent games');
  await page.evaluate(id=>localStorage.setItem('mbm_play_recently_opened_v1',JSON.stringify([id])),classActivities[0].id);await page.reload();await ready(page);assert(await page.locator('#again-section').isHidden(),'activities are not part of Play again');
  await page.evaluate(id=>{localStorage.setItem('mbm_play_recently_opened_v1',JSON.stringify([id]));localStorage.setItem('mbm_play_favourites_v1',JSON.stringify([id]));},EMBER);await page.reload();await ready(page);
  // Ruling 21 Nov: Clear this list clears the recently opened list only; Saved stays until unsaved with its heart.
  await page.locator('#clear-again-btn').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_play_recently_opened_v1'))),[]);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_play_favourites_v1'))),[EMBER],'Clear this list keeps Saved');assert(await page.locator('#again-section').isVisible(),'Play again stays while a game is saved');assert(await page.locator('#recent-block').isHidden());assert.equal(await page.locator('#saved-grid [data-pick="'+EMBER+'"]').count(),1,'Saved still lists the favourite');assert(await page.locator('#clear-again-btn').isHidden(),'nothing left to clear');assert.match(await page.locator('#storage-status').innerText(),/^List cleared\. Game saves were not changed\./);assert(await isFocused(page.locator('#all-games-title')),'Clear this list moves focus to the games');
  await page.locator('#saved-grid [data-favourite="'+EMBER+'"]').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mbm_play_favourites_v1'))),[],'the heart unsaves');assert(await page.locator('#again-section').isHidden());
  assert.equal(await page.evaluate(()=>localStorage.getItem('apexkick.v1')),'PLAY-QA-SENTINEL');assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>!['apexkick.v1','mbm_splash_last'].includes(k)).sort()),['mbm_play_favourites_v1','mbm_play_recently_opened_v1'],'only the shelf keys (plus the sentinel and the game-owned splash key)');
  // Calm: the one new key, written only when pressed; on by default under reduced motion.
  const calm=page.locator('#calm-btn');assert.equal(await calm.getAttribute('aria-pressed'),'true','Calm starts on under reduced motion');assert(await page.evaluate(()=>document.documentElement.classList.contains('calm')));
  await calm.click();assert.equal(await calm.getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>localStorage.getItem('mbm_play_calm_v1')),'0');await page.reload();await ready(page);assert.equal(await calm.getAttribute('aria-pressed'),'false','Calm choice persists');
  await calm.click();assert.equal(await page.evaluate(()=>localStorage.getItem('mbm_play_calm_v1')),'1');assert(await page.evaluate(()=>document.documentElement.classList.contains('calm')));
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage).filter(k=>!['apexkick.v1','mbm_splash_last'].includes(k)).sort()),['mbm_play_calm_v1','mbm_play_favourites_v1','mbm_play_recently_opened_v1'],'Calm adds its one key and nothing else');
  await page.evaluate(()=>localStorage.removeItem('mbm_play_calm_v1'));
  return{persistence:true,recentFromOpen:true,recentList:3,resetPreservedGameSave:true,calmKey:'mbm_play_calm_v1',keys:['mbm_play_favourites_v1','mbm_play_recently_opened_v1','mbm_play_browse_position_v1','mbm_play_calm_v1']};});
 // Surprise me -> Pick for me (mood- and device-aware); plus the How to play guides and Teacher corner.
 await test(width+'-pick-for-me-guides-and-teacher-corner',async()=>{await page.goto(base);await ready(page);const coarse=await coarseOf(page);
  const poolFor=mood=>catalogue.filter(g=>!(coarse&&keysOnly(g))&&(mood==='mates'||!spec(g).whole_class)&&(mood==='all'||spec(g).primary===mood||spec(g).secondary===mood)).map(g=>g.id);
  const opener=page.locator('#pick-btn');assert(await opener.isVisible());await opener.click();const dlg=page.locator('#pick-dialog');assert(await dlg.isVisible());assert(await isFocused(page.locator('#pick-play')),'Pick for me opens on its Play button');
  const picked=[await dlg.getAttribute('data-picked')];const pool=poolFor('all');assert(pool.includes(picked[0]),'Pick for me chose outside the ready games');assert.equal(await page.locator('#pick-play').getAttribute('href'),catalogue.find(g=>g.id===picked[0]).route);assert.equal(await page.locator('#pick-context').innerText(),'From all ready games');
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert(await focusedIn(page,'#pick-dialog'),'Focus escaped Pick for me');}
  for(let i=0;i<8;i++){await page.locator('#pick-another').click();picked.push(await dlg.getAttribute('data-picked'));}
  assert(picked.every(id=>pool.includes(id)),'Another stays inside the ready games');for(let i=0;i+7<=picked.length;i++)assert.equal(new Set(picked.slice(i,i+7)).size,7,'Pick for me repeated a game within six picks: '+JSON.stringify(picked));
  await page.keyboard.press('Escape');assert(!await dlg.isVisible());assert(await isFocused(opener),'Pick for me opener regains focus');
  const moodPicks={};for(const mood of ['race','mates']){await page.goto(base+'#mood='+mood);await ready(page);const want=poolFor(mood);const got=[];await opener.click();for(let i=0;i<6;i++){got.push(await dlg.getAttribute('data-picked'));await page.locator('#pick-another').click();}assert(got.every(id=>want.includes(id)),'Pick for me left the active mood '+mood+': '+JSON.stringify(got));assert.equal(await page.locator('#pick-context').innerText(),'From '+moodSpec.moods.find(m=>m.id===mood).label);await page.keyboard.press('Escape');moodPicks[mood]=want.length;}
  // How to play guides: every game listed, each opening its own sheet; focus kept inside.
  await page.goto(base);await ready(page);await page.locator('.menu summary').click();await page.locator('#menu-guides').click();const guides=page.locator('#guides-dialog');assert(await guides.isVisible());assert(await isFocused(page.locator('#guides-search')),'guides open on their search field');
  const rows=await page.locator('#guides-list .guide-row').evaluateAll(e=>e.map(r=>({guide:r.querySelector('[data-guide]').dataset.guide,href:r.querySelector('a[data-play]').getAttribute('href')})));assert.deepEqual(rows.map(r=>r.guide),azSort(catalogue).map(g=>g.id),'a guide for every game, A to Z');for(const r of rows)assert.equal(r.href,catalogue.find(g=>g.id===r.guide).route);
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert(await focusedIn(page,'#guides-dialog'),'Focus escaped the guides');}
  await page.locator('#guides-search').fill('Ember');assert((await page.locator('#guides-list [data-guide]').evaluateAll(e=>e.map(x=>x.dataset.guide))).includes(EMBER),'guide search finds the game');
  await page.locator('#guides-list [data-guide="'+EMBER+'"]').click();assert(!await guides.isVisible());assert(await page.locator('#game-dialog').isVisible(),'Guide opens the game sheet');assert.equal(await page.locator('#dialog-title').innerText(),shown(emberwild));await page.keyboard.press('Escape');assert(await isFocused(page.locator('.menu summary')),'closing returns focus to where the guides were opened');
  await page.locator('.menu summary').click();await page.locator('#menu-guides').click();await page.keyboard.press('Escape');assert(!await guides.isVisible());assert(await isFocused(page.locator('.menu summary')));
  // Teacher corner: the classroom activities, each a direct link; the staff item absent.
  await page.locator('.menu summary').click();await page.locator('#menu-teacher').click();assert.equal(await page.locator('#classroom').getAttribute('open'),'','Teacher corner opens');assert(await isFocused(page.locator('#classroom summary')));
  const rowsA=await page.locator('#classroom [data-activity]').evaluateAll(e=>e.map(r=>({id:r.dataset.activity,href:r.querySelector('a[data-play]').getAttribute('href'),name:r.querySelector('.activity-name').textContent,visible:!!r.getClientRects().length})));
  assert.deepEqual(rowsA.map(r=>r.id).sort(),classActivities.map(g=>g.id).sort(),'Teacher corner = the classroom activities');for(const r of rowsA){const g=classActivities.find(x=>x.id===r.id);assert.equal(r.href,g.route);assert.equal(r.name,shown(g));assert(r.visible);}
  assert.equal(await page.locator('#classroom').getByText(staffRows[0].title).count(),0,'the staff item is not in the Teacher corner');
  await page.locator('#teacher-guides').click();assert(await guides.isVisible());await page.keyboard.press('Escape');assert(await isFocused(page.locator('#teacher-guides')));
  // The sheet's reviewed facts, as the retired Surprise journey checked them.
  const lumina=catalogue.find(g=>/Lumina/.test(g.title)&&/Reduced motion/.test(g.details?.accessibility||''));await page.goto(base+'?game='+lumina.id);await ready(page);assert.match(await page.locator('#dialog-accessibility').innerText(),/Reduced motion/);assert.match(await page.locator('#dialog-saves').innerText(),/auto-saves/);await page.screenshot({path:path.join(out,width+'-discovery-details.png')});await page.keyboard.press('Escape');
  const together=catalogue.find(g=>(g.moods||[]).includes('Together')&&/device|network/i.test(g.details?.players||''));if(together){await page.goto(base+'?game='+together.id);await ready(page);assert.match(await page.locator('#dialog-players').innerText(),/device|network/i);await page.keyboard.press('Escape');}
  const lighthouse=catalogue.find(g=>g.route.includes('/The_Last_Lighthouse_'));
  await page.goto(base+'?game='+lighthouse.id);await ready(page);
  const lighthouseImage=page.locator('#dialog-media img');await lighthouseImage.evaluate(img=>img.decode());
  assert.equal(await lighthouseImage.evaluate(img=>getComputedStyle(img).objectPosition),'50% 0%','Tall title capture keeps its heading visible');
  await page.screenshot({path:path.join(out,width+'-lighthouse-details.png')});await page.keyboard.press('Escape');
  return{pickReadyPool:pool.length,picks:picked.length,noRepeatWithinSix:true,moodPools:moodPicks,guides:rows.length,teacherCorner:rowsA.length,staffInTeacherCorner:0,coarsePointer:coarse};});
 await test(width+'-series-cards-expose-each-edition-once',async()=>{
  // D2 shows one card per game, so a series is no longer collapsed onto a lead card. In EVERY
  // view (grid, each mood, a search, Pick a game) a card must hold exactly one Play link, to its
  // own game; the series stays discoverable through the sheet's Editions row, one Play per edition.
  const routeOf=new Map(data.games.map(g=>[g.id,new URL(g.route,base).pathname]));
  const read=sel=>page.locator(sel).evaluateAll(ns=>ns.map(c=>({id:c.dataset.card||c.dataset.pick||c.dataset.start,hrefs:[...c.querySelectorAll('a[href]')].map(a=>new URL(a.href).pathname),plays:[...c.querySelectorAll('a[data-play]')].map(a=>a.dataset.play)})));
  const check=(cards,label)=>{assert(cards.length>0,label+': no cards');for(const c of cards){assert.equal(c.hrefs.length,1,label+': card '+c.id+' has '+c.hrefs.length+' links');assert.deepEqual(c.plays,[c.id],label+': card '+c.id+' launches another game');assert.equal(c.hrefs[0],routeOf.get(c.id),label+': card '+c.id+' destination');}};
  await page.goto(base);await ready(page);check(await read('#game-grid [data-card]'),'grid');check(await read('#pick-grid > .card'),'pick');check(await read('#start-grid > .card'),'start');
  for(const m of moodIds){await page.locator('#mood-grid .mood-btn[data-mood="'+m+'"]').click();check(await read('#mood-cards > .card'),'mood '+m);}
  await page.locator('#query').fill('Slipstream');check(await read('#game-grid [data-card]:visible'),'search');await page.locator('#query').fill('');
  const series=[...new Set(catalogue.filter(g=>g.editions).map(g=>g.series))];assert(series.length>0,'no multi-edition series to exercise');
  const editionsProof={};for(const name of series){const members=catalogue.filter(g=>g.series===name&&g.editions);for(const g of members){await page.goto(base+'?game='+g.id);await ready(page);assert(await page.locator('#dialog-editions').isVisible(),'Editions row for '+g.id);const links=await page.locator('#dialog-editions a[data-play]').evaluateAll(a=>a.map(x=>x.getAttribute('href')));const want=g.editions.map(id=>data.games.find(x=>x.id===id)).filter(x=>x&&x.group!=='staff').map(x=>x.route);assert.deepEqual(links,want,'every edition has its own Play link, once: '+g.id);assert.equal(await page.locator('#dialog-editions li[aria-current="true"]').count(),1,'the open edition is marked');await page.keyboard.press('Escape');}editionsProof[name]=members.length;}
  return{cards:expectedCards,moodsExercised:moodIds.length,seriesInSheet:editionsProof,duplicateHrefs:0};});
 await test(width+'-sheet-focus-deep-link-and-return',async()=>{await page.goto(base+'?q=Emberwild&game='+EMBER);await ready(page);const trigger=page.locator('#game-grid a[data-play="'+EMBER+'"]');assert(await page.locator('#game-dialog').isVisible(),'?game= opens the sheet');assert(await isFocused(page.locator('#dialog-close')),'sheet opens on its close control');assert.equal(new URL(await addr(page)).searchParams.get('game'),EMBER,'deep link kept');for(let i=0;i<16;i++){await page.keyboard.press('Tab');assert(await focusedIn(page,'#game-dialog'),'Focus escaped dialog');}
  assert.equal(await page.locator('#dialog-title').innerText(),shown(emberwild));assert.equal(await page.locator('#dialog-play').innerText(),'Play '+shown(emberwild)+' →');const chips=await page.locator('#dialog-support .chip').allTextContents();const expected=[['controls','touch','Touch'],['controls','keyboard','Keyboard'],['controls','gamepad','Gamepad'],['modes','single','1 player'],['modes','local','Local / same-network options'],['modes','classroom-teams','Shared-screen teams']].filter(([f,v])=>emberwild[f].includes(v)).map(x=>x[2]);assert.deepEqual(chips,expected.length?expected:['Not yet verified']);assert.equal(await page.locator('#dialog-watch').isVisible(),Boolean(emberwild.media.video),'Watch gameplay only with media');assert.match(await page.locator('#dialog-description').innerText(),new RegExp('^'+emberwild.description.slice(0,20).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.equal(await page.locator('#dialog-kind').innerText(),moodSpec.moods.find(m=>m.id===spec(emberwild).primary).label,'the sheet names the game\'s mood');
  await page.keyboard.press('Escape');assert(!await page.locator('#game-dialog').isVisible());assert(await isFocused(trigger),'closing returns focus to the card Play link');assert.equal(new URL(await addr(page)).searchParams.get('game'),null,'deep link cleared on close');
  // The footer report link: the committed address, in the footer, not in the sheet.
  const committedReport=fs.readFileSync('domain-split/play/index.html','utf8').match(/<footer[\s\S]*?href="(mailto:[^"]+)"/)[1];assert.match(committedReport,/^mailto:[^@\s"]+@[^@\s"]+\.[a-z]+$/,'the committed report address is a plain address');
  const footerReport=await page.locator('footer a[href^="mailto:"]').getAttribute('href');assert.equal(footerReport,committedReport,'the footer report link is the committed address');assert.equal(await page.locator('footer a[href^="mailto:"]').innerText(),'Report a problem');assert.equal(await page.locator('#game-dialog a[href^="mailto:"]').count(),0,'report link lives in the footer, not the sheet');
  await page.goto(base+'?q=Emberwild&game='+EMBER);await ready(page);await page.locator('#dialog-play').click();await page.waitForURL('**/emberwild/');await page.goBack();await page.waitForSelector('#query');await ready(page);assert.equal(await page.locator('#query').inputValue(),'Emberwild');assert(!await page.locator('#game-dialog').isVisible(),'Back reopened the sheet');assert.equal(new URL(await addr(page)).searchParams.get('game'),null);
  await page.goto(base+'?game='+EMBER);await ready(page);assert(await page.locator('#game-dialog').isVisible(),'?game= deep link opens the sheet');assert.equal(await page.locator('#dialog-title').innerText(),shown(emberwild));await page.keyboard.press('Escape');assert(await isFocused(page.locator('#game-grid a[data-play="'+EMBER+'"]')),'a deep link past the collapsed list still returns focus to its own card');
  const series=catalogue.find(g=>g.editions&&g.editions[0]===g.id);await page.goto(base+'?game='+series.id);await ready(page);assert(await page.locator('#dialog-editions').isVisible(),'Editions row for a series');assert.equal(await page.locator('#dialog-editions h3').innerText(),'Editions');assert.match(await page.locator('#game-dialog .progress').innerText(),/Your progress\s+Save support has not yet been verified for this game\. Favourites and recent launches do not store game progress\.\s+Transfer saves/);assert.equal(await page.locator('#game-dialog .progress a').getAttribute('href'),'/game-saves/');
  const other=series.editions.find(id=>id!==series.id&&catalogue.some(g=>g.id===id));if(other){await page.locator('#dialog-editions [data-edition="'+other+'"]').click();assert.equal(await page.locator('#dialog-title').innerText(),shown(catalogue.find(g=>g.id===other)),'an edition button opens that edition');assert.equal(new URL(await addr(page)).searchParams.get('game'),other);}
  const chapter=catalogue.find(g=>g.chapter);await page.keyboard.press('Escape');await page.goto(base+'?game='+chapter.id);await ready(page);assert.match(await page.locator('#dialog-description').innerText(),new RegExp(' New chapter: '+chapter.chapter.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\.$'));await page.keyboard.press('Escape');
  await page.goto(base+'?game='+staffRows[0].id);await ready(page);assert(!await page.locator('#game-dialog').isVisible(),'the staff item has no sheet on the pupil page');
  return{focusTrap:true,escapeFocusReturn:true,deepLink:true,deepLinkPastCollapse:true,backToResults:true,editions:series.series,chapter:chapter.chapter,reportInFooter:true,staffSheet:false};});
 await test(width+'-keyboard-warning-and-unverified',async()=>{await page.goto(base);await ready(page);const coarse=await coarseOf(page);const needs=catalogue.find(g=>keysOnly(g));const unverified=catalogue.find(g=>!g.controls.length);
  await page.locator('#query').fill(shown(needs));const chip=page.locator('#game-grid [data-card="'+needs.id+'"] [data-needs-keyboard]');assert.equal(await chip.count(),1,'card carries the warning element for verified non-touch controls');assert.equal(await chip.isVisible(),coarse,'warning shown only on a coarse pointer');assert.equal(await page.locator('#game-grid [data-card="'+unverified.id+'"] [data-needs-keyboard]').count(),0,'unverified card carries nothing');
  assert.equal(await page.locator('#game-grid [data-needs-keyboard]').count(),catalogue.filter(keysOnly).length,'every verified keyboard-only game, and only those, carries the warning');
  await page.goto(base+'?game='+needs.id);await ready(page);assert.equal(await page.locator('#dialog-keyboard').isVisible(),coarse);assert(await page.locator('#dialog-play').isVisible(),'Play never blocked');assert.equal(await page.locator('#dialog-play').getAttribute('href'),needs.route);await page.keyboard.press('Escape');
  await page.goto(base+'?game='+unverified.id);await ready(page);assert.deepEqual(await page.locator('#dialog-support .chip').allTextContents(),['Not yet verified']);assert(!await page.locator('#dialog-keyboard').isVisible());assert(await page.locator('#dialog-play').isVisible());await page.keyboard.press('Escape');
  if(coarse)for(const sel of ['#pick-grid > .card'])assert.equal(await page.locator(sel+'[data-keys-only]').count(),0,'no keyboard-only game in Pick a game on a touch screen');
  return{coarsePointer:coarse,needsKeyboard:needs.id,unverified:unverified.id};});
 if(width===390)await test('390-targets-44px-dialogs-and-sheet',async()=>{await page.goto(base);await ready(page);await targets(page,null);await page.locator('#expand-btn').click();await targets(page,'#game-grid');await targets(page,'#pick-section');await targets(page,'#trust-strip');await targets(page,'#start-section');await targets(page,'#mood-section');
  await page.locator('#mood-grid .mood-btn[data-mood="'+moodIds[0]+'"]').click();await targets(page,'#mood-results');
  await page.locator('#pick-btn').click();await targets(page,'#pick-dialog');await page.keyboard.press('Escape');
  await page.locator('.menu summary').click();await targets(page,'.menu-panel');await page.locator('#menu-guides').click();await targets(page,'#guides-dialog');await page.keyboard.press('Escape');
  await page.evaluate(()=>{document.querySelector('#classroom').open=true;});await targets(page,'#classroom');
  await page.evaluate(id=>{localStorage.setItem('mbm_play_recently_opened_v1',JSON.stringify([id]));localStorage.setItem('mbm_play_favourites_v1',JSON.stringify([id]));},EMBER);await page.reload();await ready(page);await targets(page,'#again-section');
  await page.goto(base+'?game='+EMBER);await ready(page);await targets(page,'#game-dialog');await page.keyboard.press('Escape');const series=catalogue.find(g=>g.editions&&g.editions[0]===g.id);await page.goto(base+'?game='+series.id);await ready(page);await targets(page,'#game-dialog');await page.keyboard.press('Escape');
  await page.evaluate(()=>{localStorage.removeItem('mbm_play_recently_opened_v1');localStorage.removeItem('mbm_play_favourites_v1');});
  return{page:true,fullGrid:true,moodResults:true,pickDialog:true,menu:true,guides:true,teacherCorner:true,playAgain:true,sheetOpen:true,sheetWithEditions:true};});
 await test(width+'-orientation-and-text-enlargement',async()=>{await page.goto(base);await ready(page);await page.setViewportSize({width:width<700?844:900,height:width});await overflow(page);await page.setViewportSize({width,height:900});await page.addStyleTag({content:':root{font-size:200%!important}'});assert((await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize)))>=32,'Text enlargement did not apply');await overflow(page);
  const fits=await page.evaluate(()=>{const over=e=>e.scrollWidth>e.clientWidth+1;return{header:!over(document.querySelector('.head-inner')),actions:[...document.querySelectorAll('.head-actions > *')].filter(e=>e.getClientRects().length).every(e=>e.getBoundingClientRect().right<=document.documentElement.clientWidth+1),moods:[...document.querySelectorAll('#mood-grid .mood-btn')].every(b=>b.getBoundingClientRect().right<=document.documentElement.clientWidth+1)};});
  assert(fits.header&&fits.actions,'Header controls must fit at 200% text size: '+JSON.stringify(fits));assert(fits.moods,'Mood buttons must fit at 200% text size');await page.screenshot({path:path.join(out,width+'-text-200.png')});return{landscapeNoOverflow:true,text200NoOverflow:true,headerFits:true,moodsFit:true};});
 await ctx.close();
}
await test('essential-links-with-javascript-disabled',async()=>{const ctx=await browser.newContext({javaScriptEnabled:false}),page=await ctx.newPage();await page.goto(base);const hrefs=await gridHrefs(page);const covered=coverage(hrefs,routesOf(catalogue));assert.equal(await visible(page).count(),expectedCards,'every grid card shows without JavaScript');assert.equal(await page.locator('#classroom [data-activity] a[data-play]').count(),classActivities.length);const azLinks=await page.locator('.az-list a[href]').evaluateAll(a=>a.map(x=>x.getAttribute('href')));assert.deepEqual([...azLinks].sort(),pupilRows.map(g=>g.route).sort(),'the noscript A to Z lists every game and classroom activity once, and not the staff item');const distinct=await page.evaluate(()=>new Set([...document.querySelectorAll('a[data-play][href]')].map(a=>a.getAttribute('href'))).size);assert.equal(distinct,pupilRows.length,'every pupil Play href present without JavaScript');for(const s of staffRows)assert.equal(await page.locator('a[href="'+s.route+'"]').count(),0);const anchors=await page.locator('a[data-play][href]').count();await page.locator('.menu summary').click();assert(await page.getByRole('navigation',{name:'Main menu'}).isVisible());assert.match(await page.locator('#all-games .notice').innerText(),/direct Play link/);
 assert(await page.locator('#trust-strip').isVisible(),'the Safe for schools strip shows without JavaScript');assert.deepEqual(await page.locator('#start-grid [data-start]').evaluateAll(c=>c.filter(x=>x.getClientRects().length).map(x=>x.dataset.start)),startWant,'Start here shows without JavaScript');
 for(const sel of ['#pick-section','#mood-section','#pick-btn','#calm-btn','#expand-wrap'])assert(!await page.locator(sel).isVisible(),'script-only control shows without JavaScript: '+sel);assert.equal(await page.locator('[data-favourite]:visible').count(),0,'inert hearts stay hidden without JavaScript');
 await page.locator('#classroom summary').click();assert(await page.locator('#classroom [data-activity]').first().isVisible(),'Teacher corner opens natively');await ctx.close();return{directHrefs:distinct,noscriptList:azLinks.length,gridCatalogueHrefsOnce:covered,classroomRows:classActivities.length,playAnchors:anchors,nativeMenu:true,inertControlsHidden:true};});
await test('unavailable-storage-missing-media-and-failure-fallback',async()=>{const ctx=await browser.newContext(),page=await ctx.newPage();await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}});Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('blocked','SecurityError');}});});await page.route(/\.(png|jpg|webp|svg)(\?.*)?$/,r=>r.abort());await page.goto(base);await ready(page);assert.match(await page.locator('#storage-status').innerText(),/unavailable/);await page.locator('#query').fill('Emberwild');await page.locator('#game-grid [data-favourite="'+EMBER+'"]').click();assert.equal(await page.locator('#game-grid [data-favourite="'+EMBER+'"]').getAttribute('aria-pressed'),'true','an in-page favourite works without storage');assert.equal(await page.locator('#saved-grid [data-pick="'+EMBER+'"]').count(),1);assert.match(await page.locator('#storage-status').innerText(),/unavailable/);await pause(300);
 const thumb=page.locator('#game-grid [data-card="'+EMBER+'"] .thumb');assert(await thumb.evaluate(e=>e.classList.contains('failed')&&e.querySelector('img').hidden),'a failed card image is hidden');assert(await thumb.locator('.thumb-title').isVisible(),'and the titled block shows');assert.match(await thumb.locator('.thumb-title').innerText(),new RegExp(shown(emberwild).slice(0,6)),'a failed card image falls back to the titled colour block');
 await page.locator('#calm-btn').click();assert.match(await page.locator('#storage-status').innerText(),/unavailable/);
 await page.goto(base+'?game='+EMBER);await ready(page);await pause(300);assert.match(await page.locator('#dialog-media').innerText(),/Image unavailable/);assert(await page.locator('#dialog-play').isVisible());await page.keyboard.press('Escape');assert(await page.locator('#game-grid a[data-play]').filter({visible:true}).first().isVisible());await page.locator('#pick-btn').click();assert(await page.locator('#pick-dialog').isVisible(),'Pick for me works without storage');await page.keyboard.press('Escape');await ctx.close();return{browsing:true,inMemoryFavourite:true,gameLinks:true,imageFallback:true,calmWithoutStorage:true};});
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
await page.screenshot({path:path.join(out,'route-'+g.id+'.jpg'),quality:65});}catch(e){report.routes.push({id:g.id,route:g.route,ready:false,error:e.message});}await ctx.close();}assert(report.routes.every(r=>r.ready),'Some initial game surfaces did not render');return{routes:76,rendered:report.routes.filter(r=>r.ready).length,runtimeErrors:report.routes.filter(r=>r.errors?.length).map(r=>({route:r.route,errors:r.errors}))};});
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
