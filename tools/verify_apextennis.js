#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const FILE=process.env.AT_GAME_FILE||path.join(ROOT,'apextennis','index.html');
const SENTINEL='apextennis-build-2026-08-04';
const html=fs.readFileSync(FILE,'utf8');
const bytes=Buffer.byteLength(html);
const sha=crypto.createHash('sha256').update(html).digest('hex');
const EXPECTED_V6_SHA256='8edc53112c95051feea4dd90a1dd7dc69aa9032c6fc44742ae1e7834a332778a';
const results=[];
function assert(x,m){if(!x)throw new Error(m)}
function gate(id,name,fn){try{const d=fn()||'';results.push({id,name,status:'PASS',detail:d});console.log(`PASS ${id} ${name}${d?' — '+d:''}`)}catch(e){results.push({id,name,status:'FAIL',detail:e.message});console.error(`FAIL ${id} ${name} — ${e.message}`)}}
function extractCore(source=html){const a=source.indexOf('/* AT:CORE:BEGIN */'),b=source.indexOf('/* AT:CORE:END */');assert(a>=0&&b>a,'core markers missing');const code=source.slice(a+'/* AT:CORE:BEGIN */'.length,b);return Function(code+'\nreturn AT;')()}
const AT=extractCore();
function maxPair(states){let m=0;for(let i=1;i<states.length;i++)m=Math.max(m,AT.maxDelta(states[0],states[i]));return m}
function fullLog(){return{serveWide:true,serveWideMargin:1,shotCountAfterServe:2,finalLandingHalfMatches:true,ownShots:[{zone:'front',kind:'drop',direction:'left'},{zone:'deep',kind:'lob',direction:'right'},{zone:'deep',kind:'drive',direction:'left'}],opponentInsideServiceAtLob:true,opponentCommitment:1,rallyShots:9,opponentStaminaMin:42,serveBodyDistance:15,returnZone:'front',tookNextBeforeSecondBounce:true,firstBallCrosscourt:true,directionChanges:3,finalIntoOpenSpace:true,openSpaceMargin:1,firstServeIn:true,serveMargin:1,approachShotIndex:1,volleyInsideService:true,baselineShotsBeforeApproach:0,sliceCount:3,centreRecoveries:3,dropCount:0,backhandTargets:4,backhandBreak:true,backhandBreakMargin:1,finishAway:true,forehandTargetsBeforeBackhand:0,playerWon:false}}
function upsert(manifest,entry){const m=JSON.parse(JSON.stringify(manifest));m.games=Array.isArray(m.games)?m.games:[];const ix=m.games.findIndex(g=>g.href===entry.href||g.title===entry.title);if(ix<0)m.games.push(entry);else{m.games=m.games.filter((g,i)=>i===ix||(g.href!==entry.href&&g.title!==entry.title));m.games[ix]=Object.assign({},m.games[ix],entry)}return m}
function sourceValidators(s){return{
 sentinel:(s.match(new RegExp(SENTINEL,'g'))||[]).length===2&&s.trimStart().startsWith('<!-- '+SENTINEL+' -->')&&s.trimEnd().endsWith('<!-- '+SENTINEL+' -->'),
 storage:/var PREFIX='mbm_apextennis_';/.test(s)&&/var V6_PROFILE_KEY='madebymatt_v6_profile',V6_GAME_ID='apex-tennis';/.test(s)&&!/mbm_apex(?:kick|pool|golf)_/.test(s),
 plan:/id="clauseList"/.test(s)&&/function planRating\(/.test(s),
 motion:(s.match(/@media\(prefers-reduced-motion:reduce\)/g)||[]).length>=2,
 external:!/<(?:script|link|img|audio|video|source)\b[^>]+(?:src|href)=["']https?:/i.test(s),
 forbidden:!/(apex_coins|loot\s*box|gacha|crate\s*reel|RANK_TIERS|rarity\s*table)/i.test(s)
}}

gate('G1','identity, sentinel and metadata',()=>{const lines=html.trimEnd().split('\n'),n=(html.match(new RegExp(SENTINEL,'g'))||[]).length;assert(lines[0].includes(SENTINEL),'sentinel not first line');assert(lines.at(-1).includes(SENTINEL),'sentinel not last line');assert(n===2,`sentinel count ${n}`);assert(/<title>Apex Tennis V6 — Ascension Edition · Made by Matt<\/title>/.test(html),'title mismatch');assert(sha===EXPECTED_V6_SHA256,`V6 payload hash ${sha}`);assert(/rel="canonical" href="https:\/\/madebymatt\.uk\/apextennis\/"/.test(html),'canonical mismatch');assert(/property="og:url" content="https:\/\/madebymatt\.uk\/apextennis\/"/.test(html),'og:url mismatch');return `${bytes} bytes; sha256 ${sha}; sentinel ${n}`});

gate('G2','fixed-step determinism',()=>{assert(AT.C.DT===1/120,'DT mismatch');const rates=[30,60,120,144],states=rates.map(hz=>{const w=AT.makeWorld({surface:'hard',ball:{x:13,y:AT.C.PLAYER_Y,z:31}});AT.launch(w,{speed:788,angle:.22,loft:326,spinX:.41,spinY:.63});return AT.drive(w,16,hz)}),d=maxPair(states);assert(d===0,`state delta ${d}`);assert(/while\(G\.acc>=AT\.C\.DT/.test(html),'browser accumulator missing');return `30/60/120/144 Hz; max state delta ${d}`});

gate('G3','10,000 rallies terminate without NaN',()=>{let max=0;for(let i=0;i<10000;i++){const w=AT.randomRally(0xA710000+i);assert(w.ball.terminal,`rally ${i} did not terminate`);for(const k of ['x','y','z','vx','vy','vz','spinX','spinY'])assert(Number.isFinite(w.ball[k]),`NaN ${k} at ${i}`);max=Math.max(max,w.time)}return `10,000/10,000 terminal; max simulated time ${max.toFixed(3)}s`});

gate('G4','one bounds authority drives calls, Hawkeye and line view',()=>{const old=AT.C.LINE_W,mark={x:267,y:0,r:0};AT.C.LINE_W=14;const a=[AT.inBounds(mark.x,mark.y,0,'singles'),AT.hawkeyeVerdict(mark,'singles').in,AT.boundaryView('singles').right];AT.C.LINE_W=-2;const b=[AT.inBounds(mark.x,mark.y,0,'singles'),AT.hawkeyeVerdict(mark,'singles').in,AT.boundaryView('singles').right];AT.C.LINE_W=old;assert(a[0]===true&&a[1]===true&&b[0]===false&&b[1]===false,'call and Hawkeye did not mutate together');assert(a[2]!==b[2],'drawn boundary did not derive from same source');return `single LINE_W mutation changed award, Hawkeye and drawn boundary (${a[2]}→${b[2]})`});

gate('G5','Plan Rating fixtures, fuzz and monotonicity',()=>{const base={serveWide:false,serveWideMargin:0,shotCountAfterServe:99,finalLandingHalfMatches:false},p='wide-first';const fixtures=[
 ['none',p,base,4],
 ['one',p,{...base,serveWide:true,serveWideMargin:1},29],
 ['two',p,{...base,serveWide:true,serveWideMargin:1,shotCountAfterServe:2},54],
 ['full',p,{serveWide:true,serveWideMargin:1,shotCountAfterServe:2,finalLandingHalfMatches:true},100],
 ['safe full','slice-reset',{sliceCount:3,centreRecoveries:3,rallyShots:7,dropCount:0},70],
 ['abandoned full',p,{serveWide:true,serveWideMargin:1,shotCountAfterServe:2,finalLandingHalfMatches:true,servedBody:true},38],
 ['lose executed',p,{serveWide:true,serveWideMargin:1,shotCountAfterServe:2,finalLandingHalfMatches:true,playerWon:false},100],
 ['win abandoned',p,{serveWide:true,serveWideMargin:1,shotCountAfterServe:2,finalLandingHalfMatches:true,servedBody:true,playerWon:true},38]
 ];fixtures.forEach(([n,plan,log,expected])=>assert(AT.planRating(plan,log)===expected,`${n}: ${AT.planRating(plan,log)} != ${expected}`));assert(fixtures[6][3]>fixtures[7][3],'losing-executed fixture does not outrank winning-abandoned');let rng=AT.mulberry32(0x510CA11);for(let i=0;i<20000;i++){const log={serveWide:rng()>.5,serveWideMargin:rng(),shotCountAfterServe:Math.floor(rng()*9),finalLandingHalfMatches:rng()>.5,servedBody:rng()<.08},v=AT.planRating(p,log);assert(Number.isInteger(v)&&v>=0&&v<=100,`fuzz ${i}: ${v}`)}let last=-1;for(let i=0;i<=100;i++){const v=AT.planRating(p,{serveWide:true,serveWideMargin:i/100,shotCountAfterServe:99,finalLandingHalfMatches:false});assert(v>=last,`non-monotone at ${i}`);last=v}return `8 fixture rows; 20,000 fuzz; losing-executed 100 > winning-abandoned 38`});

gate('G6','every plan has three visible clauses',()=>{assert(AT.PLANS.length>=8,`only ${AT.PLANS.length} plans`);AT.PLANS.forEach(p=>assert(p.clauses.length===3,`${p.id} has ${p.clauses.length} clauses`));assert(/renderClauses\(\)/.test(html)&&/id="clauseList"/.test(html),'live clause renderer missing');assert(/class=\\"clause|class="clause/.test(html),'clause state markup missing');return `${AT.PLANS.length} plans × exactly 3 clauses; live tick renderer present`});

gate('G7','storage isolation',()=>{assert(/var PREFIX='mbm_apextennis_';/.test(html),'legacy prefix declaration missing');assert(/var V6_PROFILE_KEY='madebymatt_v6_profile',V6_GAME_ID='apex-tennis';/.test(html),'V6 profile namespace mismatch');assert(!/mbm_apex(?:kick|pool|golf)_/.test(html),'sibling storage prefix present');const writes=[...html.matchAll(/localStorage\.(?:setItem|removeItem)\(([^\n;]+)/g)].map(m=>m[1]),legacy=writes.filter(x=>/this\.key\(k\)/.test(x)),profile=writes.filter(x=>/^V6_PROFILE_KEY\b/.test(x));assert(writes.length===4&&legacy.length===2&&profile.length===2,`owned write paths ${writes.join(' | ')}`);assert(!/localStorage\.setItem\(PREFIX\s*\+/.test(html),'legacy bytes are written directly');return `two legacy helper paths; two namespaced V6 profile paths; zero sibling key literals`});

gate('G8','share payload validation and save isolation',()=>{const valid=AT.encodeShare({venue:2,surface:'grass',ai:'angle',plan:'grind-deep'}),d=AT.decodeShare(valid);assert(d.ok&&d.data.venue===2&&d.writes===false,'valid share failed');['#','v2.aaa','v1.!!!','v1.'+'A'.repeat(401)].forEach(x=>assert(!AT.decodeShare(x).ok,`hostile payload accepted: ${x.slice(0,12)}`));const raw=Buffer.from(JSON.stringify({v:1,venue:99,surface:'lava',ai:'god',plan:'hack'})).toString('base64url');assert(!AT.decodeShare('v1.'+raw).ok,'out-of-range payload accepted');assert(/storageWritesOnShare:0/.test(html),'browser share-write contract missing');return `valid v1 round-trip; malformed/out-of-range/hostile rejected; writes=false`});

gate('G9','mobile and touch source contract',()=>{assert(/min-height:44px/.test(html),'44px target floor missing');assert(/canvas\.getBoundingClientRect\(\)/.test(html),'pointer rect scaling missing');assert(/\(ev\.clientX-r\.left\)\*\(G\.view\.w\/r\.width\)/.test(html),'pointer x scale missing');assert(/touch-action:none/.test(html),'canvas touch action missing');return `44px source floor; scaled Pointer Events`});

gate('G10','accessibility and reduced motion',()=>{assert((html.match(/@media\(prefers-reduced-motion:reduce\)/g)||[]).length>=2,'two reduced-motion blocks required');assert(/id="live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"/.test(html),'live region mismatch');assert(/:focus-visible/.test(html),'focus-visible ring missing');assert(/<noscript id="noScript">/.test(html),'noscript missing');assert(/id="noCanvas"/.test(html),'noCanvas missing');assert(/✓/.test(html)&&/×/.test(html),'state lacks non-colour symbols');return `2 reduced-motion blocks; live region; focus; no-JS and Canvas guards`});

gate('G11','zero external runtime requests in source',()=>{const tags=html.match(/<(?:script|img|audio|video|source)\b[^>]*>/gi)||[],remote=tags.filter(t=>/(?:src|href)=["']https?:/i.test(t));assert(remote.length===0,`remote runtime tags: ${remote.join(' ')}`);assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|new\s+Image\s*\(/.test(html),'network API present');return `external request count 0`});

gate('G12','size and bounded runtime',()=>{assert(bytes<=250*1024,`size ${bytes}`);assert(AT.C.MAX_SUBSTEPS<=24,'substep cap too high');assert(/voices>=4/.test(html),'audio concurrency cap missing');return `${bytes} bytes; ${AT.C.MAX_SUBSTEPS} max substeps; 4 audio voices`});

gate('G13','tennis rules fixture suite',()=>{let s=AT.blankScore();assert(AT.serveResult(s,'fault').event==='second-serve'&&s.serveNumber===2,'first fault');assert(AT.serveResult(s,'fault').event==='double-fault'&&s.points[1]===1,'double fault');s=AT.blankScore();assert(AT.serveResult(s,'let').event==='let'&&s.serveNumber===1,'let');s=AT.blankScore();[0,0,0,1,1,1].forEach(w=>AT.awardPoint(s,w));assert(AT.pointDisplay(s)==='DEUCE','deuce');AT.awardPoint(s,0);assert(AT.pointDisplay(s)==='AD–40','advantage');AT.awardPoint(s,1);assert(AT.pointDisplay(s)==='DEUCE','advantage back to deuce');AT.awardPoint(s,0);AT.awardPoint(s,0);assert(s.games[0]===1,'game');const clip=AT.inBounds(AT.courtBounds('singles').x+AT.C.BALL_R,0,AT.C.BALL_R,'singles');assert(clip,'line-clipping ball called OUT');return `fault, double fault, let, deuce, advantage, deuce return, game and line-IN passed`});

gate('G14','archetype counter-plans are distinct',()=>{const rows=AT.AIS.map(a=>AT.archetypeScript(a.id,a.weakPlan));assert(new Set(AT.AIS.map(a=>a.weakPlan)).size===AT.AIS.length,'counter plans collide');rows.forEach(r=>assert(r.playerWin&&r.score===91,`${r.archetype} not beaten by own counter`));return rows.map(r=>`${r.archetype}:${r.plan}`).join(', ')});

gate('G15','harness mutation families are non-vacuous',()=>{const mutations=[
 ['sentinel',html.replace('<!-- '+SENTINEL+' -->','<!-- removed -->'),'sentinel'],
 ['storage',html.replace('mbm_apextennis_','mbm_apexpool_'),'storage'],
 ['plan',html.replace('id="clauseList"','id="clausesGone"'),'plan'],
 ['motion',html.replace(/@media\(prefers-reduced-motion:reduce\)/g,'@media(screen)'),'motion'],
 ['external',html.replace('</head>','<script src="https://example.invalid/x.js"></script></head>'),'external'],
 ['forbidden',html.replace('</body>','<script>var apex_coins=1,crate_reel=true;</script></body>'),'forbidden']
 ];mutations.forEach(([n,s,key])=>assert(sourceValidators(s)[key]===false,`${n} mutation survived`));return `${mutations.length} mutation families rejected`});

gate('G16','shelf upsert is idempotent',()=>{const e={title:'Apex Tennis',href:'/apextennis/',hue:'#3B6FD4'},m={games:[{title:'Apex Kick',href:'/apexkick/'}]},a=upsert(m,e),b=upsert(a,e);assert(b.games.filter(g=>g.href==='/apextennis/').length===1,'duplicate after second edit');return `second transform leaves one Apex Tennis entry`});

gate('G17','surface and hue contract',()=>{assert(Object.keys(AT.SURFACES).length===3,'surface count');function rgb(h){return[h.slice(1,3),h.slice(3,5),h.slice(5,7)].map(x=>parseInt(x,16))}function dist(a,b){a=rgb(a);b=rgb(b);return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])}const hue='#3B6FD4',ds=['#2F8F6B','#F2A24A','#7C5CFC'].map(h=>dist(hue,h));assert(ds.every(d=>d>70),`hue too close: ${ds}`);assert((html.match(/--blue:#3B6FD4/g)||[]).length===1,'game accent mismatch');return `3 surfaces; hue distances ${ds.map(x=>x.toFixed(1)).join('/')}`});

gate('G18','no crate, coins, rarity or ladder',()=>{const bad=html.match(/apex_coins|loot\s*box|gacha|crate\s*reel|rarity\s*table|RANK_TIERS/ig)||[];assert(bad.length===0,`forbidden tokens: ${bad.join(', ')}`);return `0 forbidden economy/ladder tokens`});

const browserRequired=process.env.AT_REQUIRE_BROWSER==='1';
if(browserRequired){const r=spawnSync(process.execPath,[path.join(__dirname,'verify_apextennis_browser.js')],{cwd:ROOT,encoding:'utf8',stdio:'inherit',env:process.env});if(r.status!==0){console.error('FAIL BROWSER rendered contracts');process.exitCode=1}}
const failed=results.filter(r=>r.status==='FAIL');console.log(`\nApex Tennis: ${results.length-failed.length}/${results.length} source gates passed.`);if(failed.length)process.exitCode=1;else console.log(`ALL ${results.length} APEX TENNIS SOURCE GATES PASSED`);
