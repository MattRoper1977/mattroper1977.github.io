#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),os=require('os');
const {stripExitRegion}=require('./mbm_exit_region.js');
const FILE=process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:path.join(__dirname,'..','biopunkhive','index.html');
const SELF=process.argv.includes('--self-test');
const source=fs.readFileSync(FILE,'utf8');
function extractCore(html){
  const m=html.match(/\/\* BH:CORE:BEGIN \*\/([\s\S]*?)\/\* BH:CORE:END \*\//);
  if(!m)throw new Error('Missing BH core markers');
  return vm.runInNewContext(m[1]+';BHCore',{Math,JSON,Number,Date,Map,Set,Array,Object,String,Boolean,Infinity,isFinite,parseInt,parseFloat});
}
function audit(html,quiet){
  const result=[],push=(name,ok,detail='')=>{result.push({name,ok:!!ok,detail:String(detail||'')});if(!quiet)console.log(`  ${ok?'PASS':'FAIL'}  ${name}${detail?'   '+detail:''}`)};
  let BH=null;try{BH=extractCore(html)}catch(e){push('core-extracts',false,e.message);return result}
  push('core-extracts',true);
  const bytes=Buffer.byteLength(html),hash=crypto.createHash('sha256').update(html).digest('hex');
  const sentinel=(html.match(/biopunkhive-build-2026-08-04/g)||[]).length;

  console.log && !quiet && console.log('\n== G1 · delivered file ==');
  push('single-html-under-250KiB',bytes<=250*1024,`${bytes} bytes`);
  push('sentinel-exactly-top-and-bottom',sentinel===2,`${sentinel} occurrences`);
  push('sentinel-first-line',html.startsWith('<!-- sentinel: biopunkhive-build-2026-08-04 -->'));
  push('sentinel-near-file-end',/<!-- sentinel: biopunkhive-build-2026-08-04 -->\s*<\/body>\s*<\/html>\s*$/.test(html));
  push('canonical-path',/<link rel="canonical" href="https:\/\/madebymatt\.uk\/biopunkhive\/">/.test(html));
  push('title-contract',/<title>Biopunk Hive — Made by Matt<\/title>/.test(html));
  push('no-script-src',!/<script\b[^>]*\bsrc\s*=/i.test(html));
  push('no-network-styles-or-fonts',!/<link\b[^>]*rel=["'](?:stylesheet|preload|modulepreload)["']/i.test(html)&&!/@import\s|url\(\s*["']?https?:/i.test(html));
  push('no-runtime-network-apis',!/(?:\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon\s*\(|import\s*\()/i.test(html));
  push('canvas-svg-webaudio-only',/<canvas id="gooCanvas"/.test(html)&&/<svg[^>]+viewBox="0 0 100 128"/.test(html)&&/(?:AudioContext|webkitAudioContext)/.test(html));

  !quiet&&console.log('\n== G2 · storage isolation ==');
  push('storage-prefix-exact',/var PREFIX='mbm_biopunkhive_';/.test(html));
  push('one-prefix-declaration',(html.match(/var PREFIX=/g)||[]).length===1,`${(html.match(/var PREFIX=/g)||[]).length}`);
  /* Storage discipline is a claim about THE GAME. The stamped inline exit
     region reads one platform key (mbm_audience_view) to decide whether a
     chosen-homepage control should render; it is not the game's save and it
     does not go through the game's prefixed helper because it is not the
     game's storage. Scope the scan to the game, or this gate reports the
     platform's control as a leak in the game's isolation. */
  const game=stripExitRegion(html);
  const writes=[...game.matchAll(/localStorage\.(?:setItem|removeItem)\(([^\n;]+)/g)].map(m=>m[1]);
  const reads=[...game.matchAll(/localStorage\.getItem\(([^\n;]+)/g)].map(m=>m[1]);
  push('all-storage-writes-through-helper',writes.length===2&&writes.every(x=>/this\.key\(k\)/.test(x)),writes.join(' | '));
  push('all-storage-reads-through-helper',reads.length===1&&reads.every(x=>/this\.key\(k\)/.test(x)),reads.join(' | '));
  push('one-storage-helper',(html.match(/var Store=\{/g)||[]).length===1);
  const ownSuffixes=[...html.matchAll(/Store\.(?:getRaw|setRaw|remove)\('([^']+)'/g)].map(m=>m[1]);
  push('only-save-suffix-used',new Set(ownSuffixes).size===1&&ownSuffixes.every(x=>x==='save'),[...new Set(ownSuffixes)].join(', '));
  push('no-legacy-or-sibling-keys',!/(biopunk_hive_save_v1|cybergrid_|apexkick\.|mbm_apexpool_|mbm_apexgolf_|voxel\.|powerUsed)/i.test(html));
  const fresh=BH.fresh(1700000000000),round=BH.validateSave(BH.serialize(fresh),1700000000000);
  push('save-load-roundtrip-byte-equivalent',round.ok&&BH.serialize(round.value)===BH.serialize(fresh));
  push('schema-v1-exact-catalog-size',fresh.v===1&&fresh.catalog.length===6&&fresh.achievements.length===0);

  !quiet&&console.log('\n== G3 · cryo stasis integrity ==');
  push('two-distinct-time-fields',/stasisAnchor/.test(html)&&/lastSeen/.test(html));
  push('autosave-heartbeat-only-lastSeen',/function saveGame\([^)]*\)\{state\.lastSeen=nowDate\(\)/.test(html)&&!/function saveGame\([^}]*stasisAnchor/.test(html));
  push('single-runtime-anchor-assignment',(html.match(/state\.stasisAnchor\s*=/g)||[]).length===1,`${(html.match(/state\.stasisAnchor\s*=/g)||[]).length}`);
  push('anchor-reset-callers-exact',/resetStasisAnchor\('siphon'\)/.test(html)&&/resetStasisAnchor\('claim'\)/.test(html)&&/resetStasisAnchor\('purge'\)/.test(html));
  push('anchor-not-in-autosave-interval',!/setInterval\([\s\S]{0,180}stasisAnchor/.test(html));
  let hb=BH.fresh(1000000);hb.state.stasisAnchor=1000;let b0=BH.condensateBanked(4000,hb.state.stasisAnchor,9999);hb=BH.heartbeat(hb,5000);hb=BH.heartbeat(hb,6000);hb=BH.heartbeat(hb,7000);let b1=BH.condensateBanked(7000,hb.state.stasisAnchor,9999);
  push('three-heartbeats-preserve-anchor',hb.state.stasisAnchor===1000,`${hb.state.stasisAnchor}`);
  push('banked-seconds-rise-through-heartbeats',b1>b0,`${b0} → ${b1}`);
  push('manual-siphon-minimum-60s',BH.C.STASIS_MIN===60&&/secs<C\.STASIS_MIN/.test(html)); // NOT LIVE: 60 is the game-design siphon minimum in seconds, not a shelf count.
  push('stasis-cap-8-to-24-hours',BH.stasisCapSeconds(0)===8*3600&&BH.stasisCapSeconds(4)===24*3600);
  push('stasis-efficiency-50-to-100-percent',BH.stasisEfficiency(0)===.5&&BH.stasisEfficiency(4)===1);

  !quiet&&console.log('\n== G4 · prestige idempotence ==');
  let pstate=BH.fresh(1).state;pstate.lifetime=9000;
  const award1=BH.pendingMutagens(pstate.lifetime,pstate.totalMutagensClaimed);pstate.mutagens+=award1;pstate.totalMutagensClaimed+=award1;
  const award2=BH.pendingMutagens(pstate.lifetime,pstate.totalMutagensClaimed);
  push('purge-1-derived-award',award1===3,`${award1}`);
  push('purge-2-without-lifetime-awards-zero',award2===0,`${award2}`);
  push('lifetime-not-reset-in-purge',!/function purge\([^)]*\)\{[^}]*state\.lifetime\s*=/.test(html));
  push('unique-prestige-button-id',(html.match(/id="prestigePurgeBtn"/g)||[]).length===1&&!/id="btn-purge"/.test(html));
  push('one-updateUI-controls-disabled-states',/function updateUI\([\s\S]*tranqBtn'\)\.disabled=state\.credits<40[\s\S]*deconBtn'\)\.disabled=state\.credits<30[\s\S]*prestigePurgeBtn'\)\.disabled=gain<=0[\s\S]*document\.querySelectorAll\('\[data-buy\]'\)/.test(html));

  !quiet&&console.log('\n== G5 · timestamps and dt ==');
  const remA=BH.remainingSeconds(5000,1000),remB=BH.remainingSeconds(5000,3000);
  push('two-second-stall-reduces-two-seconds',Math.abs((remA-remB)-2)<1e-12,`${remA} → ${remB}`);
  push('boost-deadline-is-performance-timestamp',/runtime\.boostEnd=nowPerf\(\)\+C\.BOOST_SECONDS\*1000/.test(html));
  push('qte-deadline-is-performance-timestamp',/deadline:start\+diff\.maxTime\*1000/.test(html));
  push('timers-read-through-remainingSeconds',/BHCore\.remainingSeconds\(runtime\.boostEnd,nowPerf\(\)\)/.test(html)&&/BHCore\.remainingSeconds\(runtime\.qte\.deadline,t\)/.test(html));
  push('no-fixed-decrement-timers',!/boost(?:Time|Remaining|Timer)\s*[-+]=|qte(?:Time|Remaining|Timer)\s*[-+]=/i.test(html));
  push('frame-dt-clamped-to-five-seconds',BH.C.DT_MAX===5&&/Math\.min\(C\.DT_MAX/.test(html));

  !quiet&&console.log('\n== G6 · derived balance readback ==');
  // Deterministic baseline: one click per second, no crit/boost/achievement/mutagen;
  // buy exactly one Proto-Slime immediately when affordable. All figures below
  // are computed from the shipped constants rather than copied from a brief.
  let seconds=0,credits=0,lifetime=0,risk=0,proto=0,firstBuy=null,firstBreach=null,firstMutagen=null;
  while(seconds<10000&&(!firstBuy||!firstBreach||!firstMutagen)){
    seconds++;
    if(proto){credits+=BH.CATALOG[0].income;lifetime+=BH.CATALOG[0].income;risk+=BH.C.RISK_CREEP;}
    const click=BH.C.BASE_CLICK*BH.cadenceMultiplier(1);credits+=click;lifetime+=click;risk+=BH.C.RISK_CLICK;
    if(!proto&&credits+1e-9>=BH.CATALOG[0].baseCost){credits-=BH.CATALOG[0].baseCost;proto=1;firstBuy=seconds;}
    if(!firstBreach&&risk>=100)firstBreach=seconds;
    if(!firstMutagen&&BH.pendingMutagens(lifetime,0)>0)firstMutagen=seconds;
  }
  push('derived-first-organism-seconds',firstBuy===9,`${firstBuy}s`);
  push('derived-first-breach-seconds',firstBreach===119,`${firstBreach}s`);
  push('derived-first-mutagen-seconds',firstMutagen===337,`${firstMutagen}s`);

  !quiet&&console.log('\n== G7/G8 · accessibility and reduced motion ==');
  push('noscript-present',/<noscript>[\s\S]*Biopunk Hive needs JavaScript/.test(html));
  push('canvas-guard-present',/id="canvasGuard"/.test(html)&&/Canvas support is unavailable/.test(html));
  push('polite-atomic-live-region',/id="liveRegion"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(html));
  push('focus-visible-ring',/:focus-visible\{outline:3px solid var\(--cyan-glow\)/.test(html));
  push('global-44px-target-floor',/button,input\[type=range\],textarea,a\.control\{min-height:44px\}/.test(html));
  push('qte-nodes-at-least-48px',/\.qte-node,\.seq-valve\{[^}]*width:50px;height:50px;min-width:50px;min-height:50px/.test(html)||/\.qte-node,\.seq-valve\{[^}]*width:48px;height:48px;min-width:48px;min-height:48px/.test(html));
  push('lockdown-announced',/announce\('Containment lockdown\./.test(html));
  push('crit-announced',/announce\('Critical slime harvest/.test(html));
  push('breach-announced',/announce\('Containment breach\./.test(html));
  push('achievement-announced',/announce\('Achievement unlocked/.test(html));
  push('reduced-motion-media-query',/@media\(prefers-reduced-motion:reduce\)/.test(html));
  push('reduced-motion-shake-js-guard',/if\(!reduced\)runtime\.shake/.test(html)&&/runtime\.shake>\.05&&!reduced/.test(html));
  push('reduced-motion-particles-js-guard',/function spawnParticles\([^)]*\)\{if\(reduced\)return/.test(html));
  push('reduced-motion-goo-filter-disabled',/@media\(prefers-reduced-motion:reduce\)[\s\S]*\.goo-filter\{filter:none\}/.test(html));
  push('motionless-status-copy-present',/>● CONTAINED</.test(html)&&/● LOCKDOWN/.test(html)&&/⚠ OVERLOADED/.test(html)&&/SIPHON NOW/.test(html));

  !quiet&&console.log('\n== G9/G12/G13 · safety contracts ==');
  push('no-alert-or-confirm',!/(?:window\.)?(?:alert|confirm)\s*\(/.test(html));
  push('qte-siren-stop-on-resolve',/function resolveQte\([\s\S]*audio\.stopSiren\(false\)/.test(html));
  push('master-mute-stops-all',/if\(state\.audioMuted\)audio\.stopAll\(\)/.test(html));
  push('page-hide-stops-audio',/visibilitychange[\s\S]*audio\.stopSiren\(true\)/.test(html)&&/pagehide[\s\S]*audio\.stopAll\(\)/.test(html));
  push('frequency-zone-chime-edge-triggered',/if\(inside&&!runtime\.qte\.inZone\)audio\.bank\('qte_zone'\)/.test(html));
  push('app-only-screen-shake',/\$\('app'\)\.style\.transform/.test(html)&&!/document\.body\.style\.transform|body\.style\.transform/.test(html));
  push('fixed-float-layer-for-pod',/id="floatLayer"/.test(html)&&/floatText\(rect,'SIPHON/.test(html));
  const fuzz=[
    'garbage',
    JSON.stringify({v:1,state:{credits:'NaN'},catalog:[],achievements:[]}),
    JSON.stringify({v:1,state:{credits:Infinity,lifetime:-1,toxUsed:'Infinity',stasisAnchor:Infinity,lastSeen:Infinity},catalog:[{id:'spec_proto',count:Infinity,cost:Infinity},{id:'evil',count:99,cost:1}],achievements:['evil']})
  ].map(x=>{try{return BH.validateSave(x,1700000000000)}catch(e){return null}});
  push('fuzzed-imports-never-throw',fuzz.every(Boolean));
  push('fuzzed-imports-finite-and-bounded',fuzz.every(v=>Number.isFinite(v.value.state.credits)&&v.value.state.credits>=0&&v.value.catalog.length===6));
  push('unknown-import-ids-ignored',fuzz[2].value.catalog.every(x=>x.id!=='evil')&&!fuzz[2].value.achievements.includes('evil'));
  push('all-numerics-coerced-with-number',/function num\([^)]*\)\{v=Number\(v\)/.test(html));
  push('save-schema-has-no-cyber-fields',!/(powerUsed|powerMax|grid|syndicate|cyber)/i.test(BH.serialize(fresh)));
  push('nine-achievements',BH.ACHIEVEMENTS.length===9,`${BH.ACHIEVEMENTS.length}`);
  push('mutagen-only-qte-difficulty',JSON.stringify(BH.qteDifficulty(0))===JSON.stringify({maxTime:5,nodes:4,sequence:4,tolerance:2.5})&&JSON.stringify(BH.qteDifficulty(20))===JSON.stringify({maxTime:1.8,nodes:10,sequence:7,tolerance:.5}));
  push('organism-and-cryo-growth-rates',BH.CATALOG.filter(x=>x.id.startsWith('spec_')).every(x=>x.growth===1.18)&&BH.CATALOG.filter(x=>x.id.startsWith('cryo_')).every(x=>x.growth===1.35));
  push('scrubber-description-is-cap-only',/Cap-only upgrade/.test(BH.CATALOG.find(x=>x.id==='spec_dome').desc));
  push('spore-scheduling-complete',/function scheduleSpore\(/.test(html)&&/function spawnSpore\(/.test(html)&&/function despawnSpore\(/.test(html));
  push('manual-save-and-reset-present',/id="saveBtn"/.test(html)&&/id="resetBtn"/.test(html)&&/function resetDialog\(/.test(html));

  if(!quiet){
    const pass=result.filter(x=>x.ok).length,fail=result.length-pass;
    console.log('\n'+'='.repeat(72));
    console.log(`${pass} passed, ${fail} failed · ${bytes} bytes · SHA-256 ${hash}`);
    console.log(`DERIVED balance: first organism ${firstBuy}s · first breach ${firstBreach}s · first mutagen ${firstMutagen}s`);
    console.log(`DERIVED prestige: purge 1 ${award1} · purge 2 ${award2}`);
    console.log('='.repeat(72));
  }
  return result;
}
if(SELF){
  const tampered=source
    .replace('mbm_biopunkhive_','mbm_biopunkBROKEN_')
    .replace('<!-- sentinel: biopunkhive-build-2026-08-04 -->','<!-- sentinel: tampered -->')
    .replace('</body>','<script>alert("tampered")<\/script></body>');
  const r=audit(tampered,true),fails=r.filter(x=>!x.ok).map(x=>x.name);
  const expected=['sentinel-exactly-top-and-bottom','sentinel-first-line','storage-prefix-exact','no-alert-or-confirm'];
  const detected=expected.every(x=>fails.includes(x));
  console.log(`TAMPER TEST ${detected?'PASS':'FAIL'} · ${fails.length} contract checks failed as expected`);
  if(!detected){console.log('Missing expected failures: '+expected.filter(x=>!fails.includes(x)).join(', '));process.exit(1)}
  process.exit(0);
}
const results=audit(source,false),failed=results.filter(x=>!x.ok);
process.exit(failed.length?1:0);
