#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const FILE=process.argv[2]||path.join(__dirname,'..','apexpool','index.html');
const html=fs.readFileSync(FILE,'utf8');
let pass=0,fail=0;
function ok(name,cond,detail=''){if(cond){pass++;console.log('  PASS  '+name+(detail?'   '+detail:''));}else{fail++;console.log('  FAIL  '+name+(detail?'   '+detail:''));}}
function head(s){console.log('\n== '+s+' ==')}
function block(name){const re=new RegExp('AP:'+name+':BEGIN([\\s\\S]*?)\\/\\* AP:'+name+':END');const m=html.match(re);if(!m)throw new Error('Missing marked block '+name);return m[1].replace(/^[\s\S]*?\*\//,'');}
const AP=vm.runInNewContext(block('CORE')+';AP',{Math,JSON,Number,isFinite});
const eps=1e-8;

head('G2 — fixed timestep and frame-rate independence');
const finals=[];
for(const hz of [30,60,120,144]){const w=AP.testWorld(.4,.05,.74,.2);AP.drive(w,12,hz);finals.push({hz,balls:w.balls.map(b=>({id:b.id,x:b.x,y:b.y,z:b.z,vx:b.vx,vy:b.vy}))});}
function maxDelta(a,b){let m=0;for(let i=0;i<a.length;i++){for(const k of ['x','y','z','vx','vy'])m=Math.max(m,Math.abs(a[i][k]-b[i][k]));}return m;}
for(let i=1;i<finals.length;i++){const d=maxDelta(finals[0].balls,finals[i].balls);ok(`30-v-${finals[i].hz}-hz`,d<=eps,`max delta ${d}`);}
ok('physics-constants-are-per-second',AP.C.DT===1/240&&AP.C.ROLL_DECEL>1&&AP.C.SLIDE_DECEL>AP.C.ROLL_DECEL,`dt ${AP.C.DT}`);
ok('render-loop-uses-accumulator',/G\.acc\+=dt[\s\S]*while\(G\.acc>=AP\.C\.DT/.test(html));
ok('render-interpolates-separately',/AP\.lerp\(prev\.x,b\.x,alpha\)/.test(html));

head('G3 — genuine draw, stun and follow');
const spinResults={};
for(const [name,spin] of [['draw',-1],['stun',0],['follow',1]]){const w=AP.testWorld(spin,0,.72,0);AP.settle(w,60,12);const q=AP.cue(w);spinResults[name]={x:q.x,y:q.y};console.log(`  DATA  ${name}: (${q.x.toFixed(6)}, ${q.y.toFixed(6)})`);}
ok('draw-finishes-behind-stun',spinResults.draw.x<spinResults.stun.x-20,JSON.stringify(spinResults));
ok('follow-finishes-ahead-of-stun',spinResults.follow.x>spinResults.stun.x+20,JSON.stringify(spinResults));
ok('three-resting-positions-are-distinct',new Set(Object.values(spinResults).map(p=>p.x.toFixed(4))).size===3);
ok('sliding-transitions-to-rolling',(()=>{const w=AP.testWorld(.5,0,.7,0);let seenSlide=false,seenRoll=false;for(let i=0;i<500;i++){const q=AP.cue(w);seenSlide||=q.phase==='sliding';AP.stepWorld(w,AP.C.DT);seenRoll||=q.phase==='rolling';}return seenSlide&&seenRoll;})());
ok('longitudinal-spin-read-by-engine',/boost=q\.spinF\*\.72/.test(block('CORE'))&&/q\.spinReleased=true/.test(block('CORE')));
ok('sidespin-transfers-throw',/Contact throw/.test(block('CORE'))&&/o\.vx\+=tx\*throwV/.test(block('CORE')));
ok('jump-state-has-gravity-and-bounce',/b\.vz-=C\.G\*dt/.test(block('CORE'))&&/b\.vz=-b\.vz\*\.34/.test(block('CORE')));
ok('masse-side-force-is-integrated',/Massé is a genuine side-force/.test(block('CORE'))&&/curve=b\.spinS/.test(block('CORE')));

head('G4 — spin-aware prediction uses the shot engine');
function cleanWorld(angle){return AP.makeWorld({balls:[AP.ball(0,250,260,'cue'),AP.ball(1,250+Math.cos(angle)*270,260+Math.sin(angle)*270,'solid')]});}
function independentTrace(world,strike){const w=AP.copy(world);AP.strikeCue(w,strike.angle,strike.power,strike.spinY,strike.spinX,strike.loft||0);const cue=[],obj=[];let first=null,contact=-1;for(let i=0;i<Math.round(3.3/AP.C.DT);i++){AP.stepWorld(w,AP.C.DT);if((i+1)%4===0){const q=AP.cue(w);cue.push({x:q.x,y:q.y,z:q.z});if(first!==null){const o=w.balls.find(b=>b.id===first);if(o)obj.push({x:o.x,y:o.y,z:o.z});}}if(first===null&&w.firstContact!==null){first=w.firstContact;contact=cue.length-1;}if(i>80&&AP.allStopped(w))break;}return{cue,obj,first,contact,world:w};}
const combos=[];for(const spinY of [-1,-.5,0,.5,1])for(const spinX of [-.6,0,.6])for(const angle of [-.16,.12])combos.push({spinY,spinX,angle,power:spinY===0?.62:.78});
let worst=0,compared=0;
for(const c of combos){const w=cleanWorld(c.angle),pred=AP.trace(w,c,3.3),act=independentTrace(w,c);const n=Math.min(pred.cuePath.length,act.cue.length);for(let i=0;i<n;i++){worst=Math.max(worst,Math.hypot(pred.cuePath[i].x-act.cue[i].x,pred.cuePath[i].y-act.cue[i].y));compared++;}}
ok('prediction-combination-count',combos.length>=20,`${combos.length} spin/angle combinations`);
ok('prediction-path-agrees-with-simulation',worst<=eps,`${compared} points; worst error ${worst}`);
ok('prediction-calls-strikeCue',/function trace[\s\S]*strikeCue\(w,strike\.angle/.test(block('CORE')));
ok('rendered-line-comes-from-predicted-path',/function drawPrediction\(\)[\s\S]*pathStroke\(pr\.cue/.test(html));
ok('prediction-recomputes-on-spin-input',/spinY[^\n]*oninput[\s\S]*G\.predDirty=true/.test(html)&&/spinX[^\n]*oninput[\s\S]*G\.predDirty=true/.test(html));
function departure(spinY){const a=Math.atan2(30,270),r=independentTrace(cleanWorld(a),{angle:a,power:.78,spinY,spinX:0,loft:0}),i=r.contact;if(i<0||!r.cue[i+8])return NaN;return Math.atan2(r.cue[i+8].y-r.cue[i].y,r.cue[i+8].x-r.cue[i].x);}
const dep=[departure(-1),departure(0),departure(1)];ok('departure-line-changes-with-longitudinal-spin',dep.every(Number.isFinite)&&Math.max(...dep)-Math.min(...dep)>.2,dep.map(x=>x.toFixed(4)).join(', '));
ok('angle-arc-is-not-hardcoded-to-ninety',/a1=Math\.atan2\(pr\.cue\[pr\.contactAt\+4\]/.test(html)&&!/Math\.PI\s*\/\s*2[^\n]*tangent/i.test(html));

head('G5 — no hidden dice in called-leave modes');
const hazards=Object.values(AP.HAZARDS);ok('all-modes-declare-leave-status',hazards.length>=7&&hazards.every(h=>typeof h.leaveEnabled==='boolean'&&h.reason));
ok('every-enabled-hazard-exposes-forces',hazards.every(h=>!h.leaveEnabled||Array.isArray(h.visibleForces)));
ok('tilt-force-is-visible',AP.HAZARDS.tilt.visibleForces.includes('tilt arrows')&&/VISIBLE TILT/.test(html));
ok('rough-is-patterned-and-labelled',AP.HAZARDS.rough.visibleForces.includes('hatched rough zones')&&/ROUGH '\+\(i\+1\)/.test(html));
ok('vortex-field-is-visible',AP.HAZARDS.vortex.visibleForces.includes('vortex rings')&&/VISIBLE VORTEX/.test(html));
ok('hazards-are-deterministic',!/(Math\.random|mulberry32)[\s\S]{0,100}hazardAccel/.test(block('CORE')));

head('G6 — Leave Rating mathematics and announcements');
const diag=Math.hypot(AP.C.W,AP.C.H),fixtures=[
 [0,100],[1,99],[3,99],[7,97],[12,95],[20,92],[30,89],[45,84],[60,79],[80,73],[100,68],[130,59],[160,51],[200,40],[260,25],[400,0]
];
for(const [d,expected] of fixtures){const v=AP.leaveRating({x:0,y:0},{x:d,y:0},diag);ok(`fixture-${d}-units`,Math.abs(v-expected)<=3,`got ${v}, hand band ${expected}±3`);}
let last=101,mono=true;for(let d=0;d<=diag;d+=.25){const v=AP.leaveRating({x:0,y:0},{x:d,y:0},diag);if(v>last){mono=false;break;}last=v;}ok('monotonic-with-distance',mono);
const c={x:10,y:20},a={x:30,y:40},before=JSON.stringify([c,a]);const one=AP.leaveRating(c,a,diag),two=AP.leaveRating(c,a,diag);ok('pure-does-not-mutate',JSON.stringify([c,a])===before);ok('deterministic',one===two);
let fuzz=true,rng=AP.mulberry32(0xA9E800);for(let i=0;i<20000;i++){const v=AP.leaveRating({x:(rng()-.5)*1e6,y:(rng()-.5)*1e6},{x:(rng()-.5)*1e6,y:(rng()-.5)*1e6},rng()*5000+.0001);if(!Number.isFinite(v)||v<0||v>100){fuzz=false;break;}}ok('20k-fuzz-in-range',fuzz,'20,000 deterministic cases');
ok('invalid-input-never-NaN',[AP.leaveRating({x:NaN,y:0},{x:0,y:0},diag),AP.leaveRating({x:0,y:0},{x:0,y:0},0)].every(v=>Number.isFinite(v)&&v>=0&&v<=100));
let disjoint=true,covered=new Set();for(const b of AP.BANDS)for(let v=b.min;v<=b.max;v++){if(covered.has(v))disjoint=false;covered.add(v);}ok('bands-disjoint-and-cover-0-to-100',disjoint&&covered.size===101&&[...covered].every(v=>v>=0&&v<=100));
ok('named-bands',AP.BANDS.map(b=>b.name).join('|')==='Wild|Loose|Sharp|Dead-on');
const ann=AP.ratingAnnouncement(96,false,12.4);ok('exact-live-string',ann==='Leave Rating 96 out of 100. Dead-on. The pot was missed. Position is scored independently. Called leave distance 12 table units.',ann);
ok('polite-atomic-live-region',/id="live"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(html));
ok('pot-and-position-reported-independently',/Position is scored independently/.test(block('CORE'))&&/Leave Rating was reported independently/.test(html));
ok('calling-is-optional',/id="skipCall"/.test(html)&&/Leave Rating skipped/.test(html));

head('G7 — storage isolation and prefix contract');
ok('storage-prefix-exact',/var PREFIX='mbm_apexpool_';/.test(html));
const writeCalls=[...html.matchAll(/localStorage\.(?:setItem|removeItem)\(([^\n;]+)/g)].map(m=>m[1]);
const legacyWrites=writeCalls.filter(s=>/this\.key\(k\)/.test(s)),profileWrites=writeCalls.filter(s=>/^PROFILE_KEY\b/.test(s));
ok('all-writes-route-through-owned-keys',writeCalls.length===3&&legacyWrites.length===2&&profileWrites.length===1&&/var GAME_ID='apex-pool',VERSION='6\.0\.0',PROFILE_KEY='madebymatt_v6_profile';/.test(html),writeCalls.join(' | '));
ok('no-sibling-storage-literals',!/(?:apexkick\.|mbm_apexgolf_|voxel\.)/.test(html));
ok('progress-and-settings-are-separated',/Store\.get\('progress'/.test(html)&&/Store\.get\('settings'/.test(html));
ok('shop-never-changes-physics',/Coins unlock visual finishes only/.test(html)&&!/(SHOP|feltPalette)[\s\S]{0,180}(SLIDE_DECEL|ROLL_DECEL|BALL_REST)/.test(html));

head('8-ball rule engine');
ok('suit-assignment-solid',AP.assignSuit([3])==='solid');ok('suit-assignment-stripe',AP.assignSuit([12])==='stripe');ok('eight-does-not-assign-suit',AP.assignSuit([8])===null);
function ruleWorld({potted=[],first=1,rail=true,pocket=0}={}){const w=AP.makeWorld({balls:[AP.ball(0,200,260,'cue'),AP.ball(1,400,260,'solid'),AP.ball(8,700,260,'eight')]});w.potted=potted.slice();w.firstContact=first;w.railAfterContact=rail;w.events=potted.map(id=>({type:'pot',ball:id,pocket}));return w;}
ok('scratch-is-foul',AP.evaluateShot({suit:null,breakShot:false},ruleWorld({potted:[0],first:1,rail:true}),[0,1,8]).foulReason==='Scratch');
ok('wrong-first-contact-is-foul',AP.evaluateShot({suit:'solid'},ruleWorld({potted:[],first:8,rail:true}),[0,1,8]).foulReason==='Wrong first contact');
ok('no-rail-after-contact-is-foul',AP.evaluateShot({suit:'solid'},ruleWorld({potted:[],first:1,rail:false}),[0,1,8]).foulReason==='No rail after contact');
ok('early-eight-is-loss',AP.evaluateShot({suit:'solid',calledPocket:0},ruleWorld({potted:[8],first:8,rail:true,pocket:0}),[0,1,8]).loss);
ok('called-eight-correct-pocket-wins',AP.evaluateShot({suit:'solid',calledPocket:2},ruleWorld({potted:[8],first:8,rail:true,pocket:2}),[0,8]).win);
ok('called-eight-wrong-pocket-loses',AP.evaluateShot({suit:'solid',calledPocket:2},ruleWorld({potted:[8],first:8,rail:true,pocket:3}),[0,8]).loss);
ok('break-scratch-head-string',AP.evaluateShot({suit:null,breakShot:true},ruleWorld({potted:[0],first:1,rail:true}),[0,1,8]).behindHeadString);
const place=AP.makeWorld({balls:[AP.ball(0,200,260,'cue'),AP.ball(1,400,260,'solid')]});ok('ball-in-hand-rejects-overlap',!AP.placeLegal(place,400,260,false));ok('ball-in-hand-allows-clear-position',AP.placeLegal(place,250,170,false));ok('break-ball-in-hand-enforces-head-string',!AP.placeLegal(place,500,170,true));

head('AI opponent and safety play');
const rates=AP.simulateWinRates(5000),ordered=AP.PERSONALITIES.map(p=>rates[p.id]);console.log('  DATA  win rates: '+AP.PERSONALITIES.map(p=>`${p.id} ${(rates[p.id]*100).toFixed(1)}%`).join(' | '));
ok('seven-personalities',AP.PERSONALITIES.length===7);
ok('simulated-win-rate-spread',Math.max(...ordered)-Math.min(...ordered)>.5,`${(Math.min(...ordered)*100).toFixed(1)}% to ${(Math.max(...ordered)*100).toFixed(1)}%`);
ok('tiers-rise-in-simulation',ordered.every((v,i)=>i===0||v>ordered[i-1]));
const blocked=AP.makeWorld({balls:[AP.ball(0,180,260,'cue'),AP.ball(1,520,260,'solid'),AP.ball(9,350,260,'stripe'),AP.ball(10,450,220,'stripe'),AP.ball(11,450,300,'stripe')]});const safety=AP.aiPlan(blocked,'solid',false,'lock');ok('safety-fallback-exists',safety&&safety.type==='safety',JSON.stringify(safety));
ok('ai-scans-targets-and-six-pockets',/for\(var k=0;k<POCKETS\.length;k\+\+\)/.test(block('CORE'))&&AP.POCKETS.length===6);
ok('personality-fields-are-distinct',new Set(AP.PERSONALITIES.map(p=>[p.angleError,p.power,p.spinBias,p.safety,p.bank].join(','))).size===7);

head('Presentation, shell and packaging');
ok('single-file-under-250kb',Buffer.byteLength(html)<250*1024,`${Buffer.byteLength(html).toLocaleString()} bytes`);
ok('zero-external-script-dependencies',!/<script\s+[^>]*src=/i.test(html));
ok('zero-external-style-dependencies',!/<link\s+[^>]*rel="stylesheet"/i.test(html));
ok('no-network-calls',!/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(html));
const canvases=[...html.matchAll(/<canvas\b[^>]*>/g)].map(m=>m[0]);
ok('authoritative-plus-advisory-canvases',canvases.length===2&&canvases.some(x=>/id="table"/.test(x))&&canvases.some(x=>/id="v6Advisory"[^>]*aria-hidden="true"/.test(x))&&/#v6Advisory\{[^}]*pointer-events:none/.test(html),canvases.join(' | '));
ok('canvas-guard-present',/id="noCanvas"/.test(html)&&/if\(!ctx\)/.test(html));
ok('splash-has-unconditional-timer',/timer=setTimeout\(dismiss,1200\)/.test(html));
ok('splash-removes-listeners-and-node',/removeEventListener\(ev\[i\],dismiss,true\)/.test(html)&&/parentNode\.removeChild\(el\)/.test(html));
ok('noscript-kills-splash',/<noscript><style>#mbmSplash\{display:none!important\}/.test(html));
ok('reduced-motion-css-and-js',/@media \(prefers-reduced-motion:reduce\)/.test(html)&&/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/.test(html));
ok('slow-motion-ring-buffer',/G\.ring\.length>520/.test(html)&&/SLOW-MOTION REPLAY/.test(html));
ok('ten-trick-levels',[...html.matchAll(/id:\d+,name:/g)].length===10);
ok('eight-player-tournament',/\['You','Rae','Bo','Mina','Dex','Ivy','Noor','Ada'\]/.test(html));
ok('speed-pool-60-plus-10',/G\.speedLeft=60/.test(html)&&/G\.speedLeft\+=10/.test(html));
ok('micro-aim-screen-and-keyboard',/id="microSelect"/.test(html)&&/G\.aimAngle-=step/.test(html));
ok('leave-marker-keyboard-reachable',/\['i','j','k','l'\]/.test(html)&&/setCall\(pt\.x,pt\.y,true\)/.test(html));
ok('canonical-path-is-lowercase-root',/href="https:\/\/madebymatt\.uk\/apexpool\/"/.test(html));
ok('no-contaminated-lessons-path',!/Apex_Pool|ApexPool|Lessons\/Apex/.test(html));

console.log('\n'+'='.repeat(72));
console.log(fail===0?`ALL ${pass} APEX POOL CHECKS PASSED`:`${pass} passed, ${fail} FAILED`);
console.log('='.repeat(72));
process.exit(fail?1:0);
