(function(){
  "use strict";
  var G=window.__MBM_TITAN_V5__;if(!G||G.polishReady!==undefined)return;G.polishReady=false;
  var REC_KEY="mbm_titanforge_records_v1",DAILY_KEY="mbm_titanforge_daily_v1",CORE_KEY="mbm_titanforge_save_v1";
  var SAVE_KEYS=["mbm_titanforge_save_v1","mbm_titanforge_aaa_v1","mbm_titanforge_mobile_v2","mbm_titanforge_v3","mbm_titanforge_release_v4","mbm_titanforge_ascension_v1"];
  var refs={},built=false,sessionStart=Date.now(),cardTimer=0,cardQueue=[],cardBusy=false;
  function clamp(v,a,b){v=Number(v);return Number.isFinite(v)?Math.max(a,Math.min(b,v)):a;}
  function el(tag,cls,html){var n=document.createElement(tag);if(cls)n.className=cls;if(html!==undefined)n.innerHTML=html;return n;}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function readJSON(k){try{var r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch(e){return null;}}
  function writeJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){return false;}}
  function core(){return readJSON(CORE_KEY)||{};}
  function reduced(){return !!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)||!!document.querySelector(".game-shell.reduced-motion");}
  function announce(t){var v4=window.__MBM_TITAN_V4__;if(v4&&v4.announce)v4.announce(t);}
  function v3(){return window.__MBM_TITAN_V3__;}
  function today(){var d=new Date();return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();}
  function rankOf(s){return s>=5e4?"TITAN":s>=2e4?"COLOSSUS":s>=5e3?"FORGEBORN":s>=500?"CONTENDER":"ROOKIE";}

  /* ================= A2 achievements + A4 leaderboards (mbm_titanforge_records_v1) ================= */
  var ACH=[
    {id:"first_spark",name:"FIRST SPARK",desc:"Land your first lift.",icon:"✦"},
    {id:"first_perfect",name:"FIRST PERFECT",desc:"Land a PERFECT lift.",icon:"★"},
    {id:"combo_6",name:"SIX IN A ROW",desc:"Reach combo x6.",icon:"6"},
    {id:"combo_12",name:"TWELVE DEEP",desc:"Reach combo x12.",icon:"12"},
    {id:"clean_set",name:"CLEAN SET",desc:"Five GREAT-or-better reps in one set.",icon:"◆"},
    {id:"flawless_set",name:"FLAWLESS SET",desc:"Five PERFECT reps in one set.",icon:"◈"},
    {id:"form_6",name:"FULL FORM",desc:"Score 6/6 on a tri-phase rep.",icon:"6/6"},
    {id:"beat_kai",name:"BEAT KAI",desc:"Beat the ghost score once.",icon:"K"},
    {id:"kai_match",name:"KAI DOMINATED",desc:"Win a first-to-3 duel against Kai.",icon:"K3"},
    {id:"rook",name:"ROOK DEFEATED",desc:"Win the Yard Rookie trial.",icon:"R"},
    {id:"blaze",name:"BLAZE DEFEATED",desc:"Win the Forge Captain trial.",icon:"B"},
    {id:"atlas",name:"ATLAS-9 DEFEATED",desc:"Win the Citadel Champion trial.",icon:"A"},
    {id:"rank_contender",name:"CONTENDER",desc:"Reach 500 strength.",icon:"II"},
    {id:"rank_forgeborn",name:"FORGEBORN",desc:"Reach 5,000 strength.",icon:"III"},
    {id:"rank_colossus",name:"COLOSSUS",desc:"Reach 20,000 strength.",icon:"IV"},
    {id:"titan_form",name:"TITAN FORM",desc:"Unlock the fourth physique form.",icon:"T"},
    {id:"ascend_1",name:"ASCENSION I",desc:"Ascend once.",icon:"↑"},
    {id:"ascend_3",name:"ASCENSION III",desc:"Ascend three times.",icon:"↑3"},
    {id:"ascend_10",name:"ASCENSION X",desc:"Ascend ten times.",icon:"↑X"},
    {id:"duel_win",name:"FORGE RIVAL",desc:"Win a LAN duel.",icon:"⚔"},
    {id:"duel_1500",name:"POWER SURGE",desc:"Score 1,500 power in a POWER-OFF.",icon:"1.5K"},
    {id:"focus_heat",name:"FOCUS HEAT",desc:"Push focus to 60 %.",icon:"♨"},
    {id:"titan_surge",name:"TITAN SURGE",desc:"Fire a Titan Surge lockout.",icon:"⚡"},
    {id:"daily",name:"DAY'S WORK",desc:"Clear a daily challenge.",icon:"☀"}
  ];
  function freshRec(){return {schema:1,unlocked:{},power:[],ascend:[],updatedAt:Date.now()};}
  function loadRec(){var b=freshRec(),r=readJSON(REC_KEY);if(!r||typeof r!=="object")return b;if(r.unlocked&&typeof r.unlocked==="object")ACH.forEach(function(a){var t=r.unlocked[a.id];if(Number.isFinite(+t)&&+t>0)b.unlocked[a.id]=clamp(t,1,8.64e15);});
    if(Array.isArray(r.power))b.power=r.power.filter(function(x){return x&&Number.isFinite(+x.p);}).map(function(x){return {p:clamp(x.p,0,1e9),d:clamp(x.d,0,8.64e15),who:String(x.who||"").replace(/[^A-Za-z0-9 _-]/g,"").slice(0,12)};}).sort(function(a,b){return b.p-a.p;}).slice(0,10);
    if(Array.isArray(r.ascend))b.ascend=r.ascend.filter(function(x){return x&&Number.isFinite(+x.s);}).map(function(x){return {s:clamp(x.s,0,1e9),d:clamp(x.d,0,8.64e15)};}).sort(function(a,b){return a.s-b.s;}).slice(0,10);return b;}
  var rec=loadRec();function persistRec(){rec.updatedAt=Date.now();writeJSON(REC_KEY,rec);}
  function unlock(id){if(rec.unlocked[id])return false;var a=ACH.filter(function(x){return x.id===id;})[0];if(!a)return false;rec.unlocked[id]=Date.now();persistRec();cardQueue.push(a);pumpCards();announce("ACHIEVEMENT · "+a.name+" · "+a.desc);renderRecords();return true;}
  function pumpCards(){if(cardBusy||!cardQueue.length||!refs.card)return;var a=cardQueue.shift();cardBusy=true;refs.card.querySelector("i").textContent=a.icon;refs.card.querySelector("strong").textContent=a.name;refs.card.querySelector("span").textContent=a.desc;refs.card.classList.remove("mbm-v5-show");void refs.card.offsetWidth;refs.card.classList.add("mbm-v5-show");clearTimeout(cardTimer);cardTimer=setTimeout(function(){refs.card.classList.remove("mbm-v5-show");cardBusy=false;pumpCards();},reduced()?1500:1700);}
  function addPower(p,who){rec.power.push({p:clamp(p,0,1e9),d:Date.now(),who:String(who||"").replace(/[^A-Za-z0-9 _-]/g,"").slice(0,12)});rec.power.sort(function(a,b){return b.p-a.p;});rec.power=rec.power.slice(0,10);persistRec();if(p>=1500)unlock("duel_1500");renderRecords();}
  function addAscendTime(sec){rec.ascend.push({s:clamp(sec,0,1e9),d:Date.now()});rec.ascend.sort(function(a,b){return a.s-b.s;});rec.ascend=rec.ascend.slice(0,10);persistRec();renderRecords();}
  var ascendedThisSession=false,lastDuelWins=-1,lastDuelBest=-1,lastKaiWins=-1,trialSeen={};
  function onLift(e){var d=e.detail||{},grade=String(d.grade||"SOLID").toUpperCase(),combo=Number(d.combo)||0;unlock("first_spark");if(grade==="PERFECT")unlock("first_perfect");if(combo>=6)unlock("combo_6");if(combo>=12)unlock("combo_12");
    var c=core(),strength=(Number(c.strength)||0)+(Number(d.strength)||0),rank=rankOf(strength);if(rank!=="ROOKIE")unlock("rank_contender");if(rank==="FORGEBORN"||rank==="COLOSSUS"||rank==="TITAN")unlock("rank_forgeborn");if(rank==="COLOSSUS"||rank==="TITAN")unlock("rank_colossus");
    var E=window.__MBM_TITAN_EVOLUTION_TEST__;if(E&&E.stageFor(Number(d.rep)||0)>=3)unlock("titan_form");
    var v4=window.__MBM_TITAN_V4__,st=v4&&v4.getState?v4.getState():{};if(st.focus>=60)unlock("focus_heat");
    setTimeout(pollStates,350);}
  function onForm(e){var d=e.detail||{};if(clamp(d.total,0,6)>=6)unlock("form_6");if(d.beat)unlock("beat_kai");}
  function onAscend(e){var d=e.detail||{},n=clamp(d.ascensions,0,1e6);if(n>=1)unlock("ascend_1");if(n>=3)unlock("ascend_3");if(n>=10)unlock("ascend_10");if(!ascendedThisSession){ascendedThisSession=true;addAscendTime(Math.round((Date.now()-sessionStart)/100)/10);}}
  function pollStates(){var s=v3()&&v3().getState?v3().getState():{};if(s.cleanSets>0)unlock("clean_set");if(s.flawlessSets>0)unlock("flawless_set");
    var v2=window.__MBM_TITAN_MOBILE_V2__,v2s=v2&&v2.getState?v2.getState():{};var kw=v2s.duel?v2s.duel.wins:0;if(kw>0)unlock("kai_match");
    var duel=G.duel&&G.duel.record?G.duel.record():null;if(duel){if(duel.wins>0)unlock("duel_win");if(duel.wins!==lastDuelWins&&lastDuelWins>=0&&duel.wins>lastDuelWins){addPower(duel.bestPower,duel.lastOpponent);}lastDuelWins=duel.wins;if(duel.bestPower>=1500)unlock("duel_1500");}
    var v4=window.__MBM_TITAN_V4__,st=v4&&v4.getState?v4.getState():{};if(st.surgeArmed)G.polishSurgeArmed=true;else if(G.polishSurgeArmed){G.polishSurgeArmed=false;unlock("titan_surge");}
    var res=document.querySelector(".trial-result.won");if(res){var t=res.textContent||"";if(/Rook/i.test(t))unlock("rook");if(/Blaze/i.test(t))unlock("blaze");if(/Atlas/i.test(t))unlock("atlas");}}
  function renderRecords(){if(!refs.achList)return;refs.achList.innerHTML="";var n=0;ACH.forEach(function(a){var on=!!rec.unlocked[a.id];if(on)n++;var row=el("div","mbm-v5-ach-row"+(on?" on":""));row.innerHTML='<i aria-hidden="true">'+esc(a.icon)+'</i><div><strong></strong><small></small></div><em></em>';row.querySelector("strong").textContent=a.name;row.querySelector("small").textContent=a.desc;row.querySelector("em").textContent=on?new Date(rec.unlocked[a.id]).toLocaleDateString("en-GB"):"LOCKED";row.setAttribute("aria-label",a.name+(on?", unlocked":", locked")+": "+a.desc);refs.achList.appendChild(row);});refs.achCount.textContent=n+"/"+ACH.length+" UNLOCKED";
    refs.powerBoard.innerHTML=rec.power.length?"":'<div class="mbm-v5-empty">No POWER-OFF yet — duel a rival from TRIALS.</div>';rec.power.forEach(function(x,i){var d=el("div","");d.innerHTML='<span>'+(i+1)+'</span><b></b><span></span>';d.querySelector("b").textContent=x.p+" POWER"+(x.who?" vs "+x.who:"");d.querySelector("span:last-child").textContent=new Date(x.d).toLocaleDateString("en-GB");refs.powerBoard.appendChild(d);});
    refs.ascendBoard.innerHTML=rec.ascend.length?"":'<div class="mbm-v5-empty">No ascension timed yet — the clock runs from page load to your first Ascend of the session.</div>';rec.ascend.forEach(function(x,i){var d=el("div","");d.innerHTML='<span>'+(i+1)+'</span><b></b><span></span>';d.querySelector("b").textContent=x.s+" s";d.querySelector("span:last-child").textContent=new Date(x.d).toLocaleDateString("en-GB");refs.ascendBoard.appendChild(d);});}
  function buildRecordsTab(){var dlg=document.querySelector(".mbm-v4-dialog:not(.mbm-v5-duel-dialog) .mbm-v4-dna-panel");if(!dlg||dlg.querySelector(".mbm-v5-toptabs"))return !!dlg;
    var head=dlg.querySelector(".mbm-v4-dna-head");if(head)head.style.paddingLeft="max(14px,calc(58px + env(safe-area-inset-left)))";
    var tabs=el("nav","mbm-v5-toptabs",'<button type="button" role="tab" aria-selected="true">DIVINE DNA</button><button type="button" role="tab" aria-selected="false">RECORDS</button>');tabs.setAttribute("aria-label","DNA or records");head.insertAdjacentElement("afterend",tabs);
    var sec=el("section","mbm-v5-records",'<h3>ACHIEVEMENTS · <span class="mbm-v5-ach-count"></span></h3><div class="mbm-v5-ach-list"></div><h3>TOP 10 POWER-OFF</h3><div class="mbm-v5-board mbm-v5-power"></div><h3>TOP 10 FASTEST FIRST ASCENSION (SESSION-TIMED)</h3><div class="mbm-v5-board mbm-v5-ascend"></div>');sec.setAttribute("aria-label","Records: achievements and leaderboards");dlg.appendChild(sec);
    refs.achList=sec.querySelector(".mbm-v5-ach-list");refs.achCount=sec.querySelector(".mbm-v5-ach-count");refs.powerBoard=sec.querySelector(".mbm-v5-power");refs.ascendBoard=sec.querySelector(".mbm-v5-ascend");
    var btns=tabs.querySelectorAll("button");btns[0].addEventListener("click",function(){dlg.classList.remove("mbm-v5-show-records");btns[0].setAttribute("aria-selected","true");btns[1].setAttribute("aria-selected","false");});btns[1].addEventListener("click",function(){dlg.classList.add("mbm-v5-show-records");btns[1].setAttribute("aria-selected","true");btns[0].setAttribute("aria-selected","false");renderRecords();});
    renderRecords();return true;}

  /* ================= A3 daily challenge (seeded by local date) ================= */
  var MODS=[{id:"brace600",label:"BRACE ONLY 600 MS"},{id:"perfects",label:"PERFECTS ONLY"},{id:"tri",label:"3-PHASE ONLY"},{id:"bust",label:"COMBO OR BUST"}];
  function mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;var t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
  function plan(seed){var r=mulberry(seed>>>0),target=400+Math.floor(r()*6)*100,a=Math.floor(r()*MODS.length),b=(a+1+Math.floor(r()*(MODS.length-1)))%MODS.length,names=["ORE HAULER","PISTON","GRIT","CINDER","ANVIL","STRIKER","KILN","RIVET"],rival=names[Math.floor(r()*names.length)];return {seed:seed,target:target,mods:[MODS[a],MODS[b]],rival:rival,duration:45000};}
  function loadDaily(){var r=readJSON(DAILY_KEY)||{};return {schema:1,date:clamp(r.date,0,99999999),attempted:!!r.attempted,cleared:!!r.cleared,power:clamp(r.power,0,1e9),pendingGem:!!r.pendingGem};}
  var daily=loadDaily();function persistDaily(){writeJSON(DAILY_KEY,daily);}
  if(daily.pendingGem)window.__MBM_TITAN_GEM_GRANT__=1;
  window.addEventListener("mbm:titan-lift",function(){setTimeout(function(){if(daily.pendingGem&&!(window.__MBM_TITAN_GEM_GRANT__>0)){daily.pendingGem=false;persistDaily();announce("DAILY GEM BANKED · +1 GEM");}},80);});
  var attempt=null;
  function dailyToday(){var t=today();if(daily.date!==t){daily={schema:1,date:t,attempted:false,cleared:false,power:0,pendingGem:daily.pendingGem};persistDaily();}return plan(t);}
  function modeBtn(){return document.querySelector(".mbm-mode-btn");}
  function startDaily(){var p=dailyToday();if(daily.attempted||attempt)return false;daily.attempted=true;persistDaily();
    var at=Date.now()+1500,a=attempt={plan:p,at:at,end:at+p.duration,power:0,lifts:0,done:false,wasAdvanced:!!(modeBtn()&&modeBtn().getAttribute("aria-pressed")==="true")};
    var ids=p.mods.map(function(m){return m.id;});if(ids.indexOf("brace600")>=0)window.__MBM_TITAN_BRACE_MS__=600;if(ids.indexOf("tri")>=0&&modeBtn()&&modeBtn().getAttribute("aria-pressed")!=="true")modeBtn().click();
    a.onLift=function(e){if(a.done)return;var now=Date.now();if(now<a.at||now>a.end)return;var d=e.detail||{},grade=String(d.grade||"SOLID").toUpperCase();if(ids.indexOf("perfects")>=0&&grade!=="PERFECT")return paintDaily();if(ids.indexOf("bust")>=0&&grade==="SOLID"){a.power=0;announce("COMBO BUST · POWER RESET");return paintDaily();}a.power+=grade==="PERFECT"?100:grade==="GREAT"?60:30;a.lifts++;paintDaily();};
    window.addEventListener("mbm:titan-lift",a.onLift);a.tick=setInterval(paintDaily,200);a.timer=setTimeout(finishDaily,p.duration+1500);
    refs.dhud.hidden=false;refs.dhud.querySelector(".mbm-v5-hud-them-name").textContent=p.rival;refs.dhud.querySelector(".mbm-v5-hud-them").textContent=String(p.target);refs.dhud.querySelector(".mbm-v5-them i b").style.width="100%";
    try{window.scrollTo({top:0,behavior:reduced()?"auto":"smooth"});}catch(e){}announce("DAILY CHALLENGE · "+p.mods.map(function(m){return m.label;}).join(" · ")+" · TARGET "+p.target);return true;}
  function paintDaily(){var a=attempt;if(!a||!refs.dhud)return;var now=Date.now(),left=a.end-now;refs.dhud.querySelector(".mbm-v5-hud-clock").textContent=now<a.at?"GET READY · "+Math.ceil((a.at-now)/1000):left>0?(left/1000).toFixed(1)+"s":"TIME";refs.dhud.querySelector(".mbm-v5-hud-label").textContent=a.plan.mods.map(function(m){return m.label;}).join(" · ");refs.dhud.querySelector(".mbm-v5-hud-me").textContent=String(a.power);refs.dhud.querySelector(".mbm-v5-me i b").style.width=Math.min(100,a.power/a.plan.target*100)+"%";}
  function finishDaily(){var a=attempt;if(!a||a.done)return;a.done=true;window.removeEventListener("mbm:titan-lift",a.onLift);clearInterval(a.tick);clearTimeout(a.timer);window.__MBM_TITAN_BRACE_MS__=0;if(modeBtn()&&(modeBtn().getAttribute("aria-pressed")==="true")!==a.wasAdvanced)modeBtn().click();refs.dhud.hidden=true;
    var cleared=a.power>=a.plan.target;daily.cleared=cleared;daily.power=Math.max(daily.power,a.power);if(cleared){daily.pendingGem=true;window.__MBM_TITAN_GEM_GRANT__=1;unlock("daily");}persistDaily();attempt=null;
    announce(cleared?"DAILY CLEARED · "+a.power+" OF "+a.plan.target+" · +1 GEM ON YOUR NEXT LIFT":"DAILY MISSED · "+a.power+" OF "+a.plan.target+" · TRY AGAIN TOMORROW");renderDailyCard();}
  function renderDailyCard(){var card=document.querySelector(".mbm-v5-daily-card");if(!card)return;var p=dailyToday();card.querySelector("small").textContent="DAILY · "+String(p.seed).replace(/(\d{4})(\d{2})(\d{2})/,"$3/$2/$1");card.querySelector("b").textContent=p.rival+" · TARGET "+p.target;card.querySelector("em").textContent=p.mods.map(function(m){return m.label;}).join(" · ")+" · 45 S";var b=card.querySelector("button");b.disabled=daily.attempted||!!attempt;b.textContent=daily.cleared?"CLEARED":daily.attempted?"DONE TODAY":"START";}
  function injectDaily(){var h2=Array.prototype.find.call(document.querySelectorAll('[role="dialog"] h2'),function(h){return /FORGE TRIALS/i.test(h.textContent);});if(!h2)return;var dlg=h2.closest('[role="dialog"]'),list=dlg&&dlg.querySelector(".rival-list");if(!list||list.querySelector(".mbm-v5-daily-card"))return;
    var card=el("article","mbm-v5-daily-card",'<div class="rival-avatar" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg></div><span><small></small><b></b><em></em></span>');var b=el("button","mbm-v5-btn mbm-v5-primary","START");b.type="button";b.setAttribute("aria-label","Start today's daily challenge; one attempt per day");b.addEventListener("click",function(){var close=dlg.querySelector("button.absolute");if(close)close.click();setTimeout(startDaily,150);});card.appendChild(b);list.appendChild(card);renderDailyCard();}

  /* ================= A5 save code ================= */
  function fnv(str){var h=0x811c9dc5;for(var i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193)>>>0;}return ("0000000"+h.toString(16)).slice(-8);}
  function b64url(bytes){var s="";for(var i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
  function unb64url(str){str=String(str).replace(/-/g,"+").replace(/_/g,"/");while(str.length%4)str+="=";var s=atob(str),out=new Uint8Array(s.length);for(var i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;}
  function deflate(bytes){if(!window.CompressionStream)return Promise.resolve(null);try{var cs=new CompressionStream("deflate-raw"),w=cs.writable.getWriter();w.write(bytes);w.close();return new Response(cs.readable).arrayBuffer().then(function(b){return new Uint8Array(b);}).catch(function(){return null;});}catch(e){return Promise.resolve(null);}}
  function inflate(bytes){var ds=new DecompressionStream("deflate-raw"),w=ds.writable.getWriter();w.write(bytes);w.close();return new Response(ds.readable).arrayBuffer().then(function(b){return new Uint8Array(b);});}
  function exportCode(){var d={};SAVE_KEYS.forEach(function(k){var v=localStorage.getItem(k);if(v!==null)d[k]=v;});var raw=new TextEncoder().encode(JSON.stringify({v:1,t:Date.now(),d:d}));return deflate(raw).then(function(z){var payload=(z&&z.length<raw.length)?"Z"+b64url(z):"R"+b64url(raw);return "TFS1."+payload+"."+fnv(payload);});}
  var VALID={"mbm_titanforge_save_v1":function(o){return ["strength","coins","gems","reps"].every(function(k){return Number.isFinite(+o[k]);})&&Array.isArray(o.purchased);},"mbm_titanforge_aaa_v1":function(o){return o.muscles&&typeof o.muscles==="object";},"mbm_titanforge_mobile_v2":function(o){return o.duel&&typeof o.duel==="object";},"mbm_titanforge_v3":function(o){return Array.isArray(o.owned);},"mbm_titanforge_release_v4":function(o){return o.mastery&&typeof o.mastery==="object";},"mbm_titanforge_ascension_v1":function(o){return o.levels&&typeof o.levels==="object";}};
  function importCode(code){code=String(code||"").trim();var m=code.match(/^TFS1\.([ZR][A-Za-z0-9_-]+)\.([0-9a-f]{8})$/);if(!m)return Promise.reject(new Error("NOT_A_SAVE_CODE"));if(fnv(m[1])!==m[2])return Promise.reject(new Error("CHECKSUM_MISMATCH"));var bytes=unb64url(m[1].slice(1));
    return (m[1][0]==="Z"?inflate(bytes):Promise.resolve(bytes)).then(function(b){var obj=JSON.parse(new TextDecoder().decode(b));if(!obj||obj.v!==1||!obj.d||typeof obj.d!=="object")throw new Error("BAD_SHAPE");var keys=Object.keys(obj.d);if(!keys.length)throw new Error("EMPTY");keys.forEach(function(k){if(SAVE_KEYS.indexOf(k)<0)throw new Error("UNKNOWN_KEY "+k);var parsed=JSON.parse(obj.d[k]);if(!parsed||typeof parsed!=="object"||!VALID[k](parsed))throw new Error("SCHEMA "+k);});
      keys.forEach(function(k){localStorage.setItem(k,obj.d[k]);});lockSaves(keys);return keys.length;});}

  /* ================= A6 coach overlay ================= */
  var STEPS=[
    {t:"TAP DRIVE IN GOLD",p:"The needle sweeps the bar. Tap LIFT the moment it sits in the gold band.",svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#ffd85c" stroke-width="2" stroke-linecap="round"><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="13" y="9" width="5" height="6" fill="#ffd85c" stroke="none"/><path d="M7 5v14"/></svg>'},
    {t:"HOLD BRACE",p:"Keep the dot centred with quick taps. Stay inside the core for a PERFECT brace.",svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#6ee7ff" stroke-width="2" stroke-linecap="round"><rect x="3" y="10" width="18" height="4" rx="1"/><circle cx="12" cy="12" r="3" fill="#6ee7ff" stroke="none"/><path d="M9 4l3 3 3-3M9 20l3-3 3 3"/></svg>'},
    {t:"RELEASE CONTROL",p:"Tap once more as the bar lowers through the second gold band. Three clean taps = up to ×1.9 gains.",svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#ff9a45" stroke-width="2" stroke-linecap="round"><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="12" y="9" width="6" height="6" fill="#ff9a45" stroke="none"/><path d="M12 3v4M10 5l2 2 2-2"/></svg>'},
    {t:"YOUR BODY EVOLVES",p:"Clean reps grow the athlete through four forms. Ascend for Divine DNA, duel Kai, challenge a rival on your Wi-Fi.",svg:'<svg viewBox="0 0 24 24" fill="none" stroke="#75f3c4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3c0 5 10 7 10 12s-10 7-10 6"/><path d="M17 3c0 5-10 7-10 12s10 7 10 6"/><path d="M8.5 7.5h7M8.5 16.5h7"/></svg>'}
  ];
  function buildCoach(){var s=v3()&&v3().getState?v3().getState():null;if(!s||s.coachSeen||s.hintSeen)return;
    var wrap=el("div","mbm-v5-coach");wrap.setAttribute("role","dialog");wrap.setAttribute("aria-modal","true");wrap.setAttribute("aria-labelledby","mbm-v5-coach-title");var idx=0;
    wrap.innerHTML='<div class="mbm-v5-coach-card"><div class="mbm-v5-coach-head"><span>FORGE COACH · <b class="mbm-v5-coach-step">1/4</b></span><button class="mbm-v5-btn mbm-v5-coach-skip" type="button" aria-label="Skip the coach">SKIP</button></div><div class="mbm-v5-coach-body"><div class="mbm-v5-coach-icon" aria-hidden="true"></div><div><strong id="mbm-v5-coach-title"></strong><p></p></div></div><div class="mbm-v5-coach-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="mbm-v5-row"><button class="mbm-v5-btn mbm-v5-coach-back" type="button">BACK</button><button class="mbm-v5-btn mbm-v5-primary mbm-v5-coach-next" type="button">NEXT</button></div></div>';
    document.body.appendChild(wrap);refs.coach=wrap;var next=wrap.querySelector(".mbm-v5-coach-next"),back=wrap.querySelector(".mbm-v5-coach-back"),skip=wrap.querySelector(".mbm-v5-coach-skip");
    function paint(){var st=STEPS[idx];wrap.querySelector(".mbm-v5-coach-icon").innerHTML=st.svg;wrap.querySelector("strong").textContent=st.t;wrap.querySelector("p").textContent=st.p;wrap.querySelector(".mbm-v5-coach-step").textContent=(idx+1)+"/4";Array.prototype.forEach.call(wrap.querySelectorAll(".mbm-v5-coach-dots i"),function(d,i){d.classList.toggle("on",i<=idx);});next.textContent=idx===STEPS.length-1?"START LIFTING":"NEXT";back.disabled=idx===0;}
    function finish(){if(v3()&&v3().setFlag)v3().setFlag("coachSeen",true);wrap.remove();refs.coach=null;var lift=document.querySelector(".lift-button");if(lift)lift.focus();}
    next.addEventListener("click",function(){if(idx<STEPS.length-1){idx++;paint();}else finish();});back.addEventListener("click",function(){if(idx>0){idx--;paint();}});skip.addEventListener("click",finish);
    wrap.addEventListener("keydown",function(e){if(e.key==="Escape"){e.preventDefault();finish();}});paint();next.focus();}

  /* ================= A7 reset + A5 UI + A1 setting — injected into the core settings dialog ================= */
  function injectSettings(){var h2=Array.prototype.find.call(document.querySelectorAll('[role="dialog"] h2'),function(h){return /GAME SETTINGS/i.test(h.textContent);});if(!h2)return;var dlg=h2.closest('[role="dialog"]');if(!dlg||dlg.querySelector(".mbm-v5-settings"))return;var help=dlg.querySelector(".keyboard-help");
    var sec=el("section","mbm-v5-settings",'<h4>RELEASE V5</h4>'
      +'<div class="mbm-v5-row"><label>Procedural music<small>Starts after your first tap; follows combo and focus. Needs Game sound on.</small></label><button class="mbm-v5-btn mbm-v5-music-setting" type="button" aria-pressed="false" aria-label="Toggle procedural music">OFF</button></div>'
      +'<div class="mbm-v5-row"><label>Game beeps<small>Lift, reward and level tones live under Game sound above. FX SOUND in OPTIONS only covers the lift feedback layer.</small></label><span></span></div>'
      +'<label>Save code<small>Export all six Titan Forge saves as one code, or paste one to import. Import checks the checksum and every schema first and touches nothing on failure.</small></label><textarea class="mbm-v5-savecode" aria-label="Save code"></textarea><div class="mbm-v5-row"><button class="mbm-v5-btn mbm-v5-export" type="button">EXPORT CODE</button><button class="mbm-v5-btn mbm-v5-primary mbm-v5-import" type="button">IMPORT CODE</button></div><div class="mbm-v5-note mbm-v5-save-note"></div>'
      +'<div class="mbm-v5-row"><label>Reset all progress<small>Tap twice within 4 seconds. Clears every mbm_titanforge_* key and reloads.</small></label><button class="mbm-v5-btn mbm-v5-danger mbm-v5-reset" type="button" data-armed="false" aria-label="Reset all progress; tap twice within four seconds">RESET ALL PROGRESS</button></div>');
    if(help)help.insertAdjacentElement("beforebegin",sec);else dlg.appendChild(sec);
    var mbtn=sec.querySelector(".mbm-v5-music-setting");mbtn.addEventListener("click",function(){if(G.music)G.music.setEnabled(!G.music.isEnabled());});if(G.music)G.music.bindSetting(mbtn);
    var ta=sec.querySelector(".mbm-v5-savecode"),note=sec.querySelector(".mbm-v5-save-note");
    sec.querySelector(".mbm-v5-export").addEventListener("click",function(){exportCode().then(function(code){ta.value=code;note.textContent="CODE READY · "+code.length+" CHARS · COPY IT SOMEWHERE SAFE";ta.select();});});
    sec.querySelector(".mbm-v5-import").addEventListener("click",function(){importCode(ta.value).then(function(n){note.textContent="IMPORTED "+n+" SAVES · RELOADING";setTimeout(function(){location.reload();},600);}).catch(function(e){note.textContent="REFUSED · "+(e&&e.message||e)+" · NOTHING CHANGED";});});
    var rb=sec.querySelector(".mbm-v5-reset"),armedAt=0;rb.addEventListener("click",function(){var now=Date.now();if(now-armedAt>4000){armedAt=now;rb.setAttribute("data-armed","true");rb.textContent="TAP AGAIN TO CONFIRM";setTimeout(function(){if(Date.now()-armedAt>=3990){rb.setAttribute("data-armed","false");rb.textContent="RESET ALL PROGRESS";}},4100);return;}G.polish.resetAll();});}
  /* The core (and the AAA layer) write their saves again on pagehide. After a reset or an import every
     write to the affected keys is ignored until the reload lands, so the new values survive. */
  var lockedKeys=null;function lockSaves(keys){if(lockedKeys)keys.forEach(function(k){lockedKeys[k]=true;});else{lockedKeys={};keys.forEach(function(k){lockedKeys[k]=true;});var orig=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===window.localStorage&&lockedKeys&&lockedKeys[k])return;return orig.call(this,k,v);};}}
  function resetAll(){var keys=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf("mbm_titanforge_")===0)keys.push(k);}keys.forEach(function(k){localStorage.removeItem(k);});lockSaves(keys.concat(SAVE_KEYS,[REC_KEY,DAILY_KEY,"mbm_titanforge_duel_v1"]));try{sessionStorage.setItem("mbm_titanforge_reset_done",String(keys.length));}catch(e){}setTimeout(function(){location.reload();},30);return keys;}

  /* ================= A8 sound honesty + A9 one announcer ================= */
  function soundHonesty(){var b=document.querySelector(".mbm-audio-btn");if(!b||b.getAttribute("data-mbm-v5"))return !!b;b.setAttribute("data-mbm-v5","1");b.setAttribute("aria-label","FX sound: lift and reward feedback tones. Game beeps: Settings > Game sound");var foot=document.querySelector(".mbm-phase-foot");if(foot&&!foot.querySelector(".mbm-v5-sound-note")){var n=el("small","mbm-v5-sound-note","Game beeps: Settings > Game sound");foot.appendChild(n);}return true;}
  function oneAnnouncer(){[".mbm-aaa-board .mbm-visually-hidden",".mbm-v2-reward",".mbm-v3-toast",".notice",".mbm-reward-pop",".mbm-cycle-result"].forEach(function(sel){Array.prototype.forEach.call(document.querySelectorAll(sel),function(n){if(n.classList.contains("mbm-v4-live"))return;n.removeAttribute("aria-live");n.removeAttribute("role");n.setAttribute("aria-hidden","true");});});}
  function liftLine(e){var d=e.detail||{},grade=String(d.grade||"SOLID").toUpperCase(),live=document.querySelector(".mbm-v4-live");if(!live)return;var line=grade+" REP · +"+(Number(d.strength)||0)+" STRENGTH · +"+(Number(d.coins)||0)+" COINS"+(d.combo>1?" · COMBO x"+d.combo:"")+(d.levelUp?" · LEVEL "+d.newLevel:"");window.__MBM_TITAN_ANNOUNCE_HOLD__={text:line,until:Date.now()+1500};live.textContent=line;}

  function build(){if(built)return true;if(!G.ready||!window.__MBM_TITAN_V4__||!window.__MBM_TITAN_V4__.ready||!document.querySelector(".arena")||!v3()||!v3().getState)return false;
    var arena=document.querySelector(".arena");var card=el("div","mbm-v5-ach",'<i aria-hidden="true"></i><div><small>ACHIEVEMENT</small><strong></strong><span></span></div>');card.setAttribute("aria-hidden","true");arena.appendChild(card);refs.card=card;
    var dhud=el("div","mbm-v5-duelhud mbm-v5-dailyhud",'<div class="mbm-v5-clock"><b class="mbm-v5-hud-clock">—</b><span class="mbm-v5-hud-label">DAILY</span></div><div class="mbm-v5-bar mbm-v5-me"><span class="mbm-v5-hud-me-name">POWER</span><i><b></b></i><em class="mbm-v5-hud-me">0</em></div><div class="mbm-v5-bar mbm-v5-them"><span class="mbm-v5-hud-them-name">TARGET</span><i><b></b></i><em class="mbm-v5-hud-them">0</em></div>');dhud.hidden=true;dhud.setAttribute("aria-hidden","true");arena.appendChild(dhud);refs.dhud=dhud;
    window.addEventListener("mbm:titan-lift",onLift);window.addEventListener("mbm:titan-lift",liftLine);window.addEventListener("mbm:titan-form-result",onForm);window.addEventListener("mbm:titan-ascend",onAscend);
    buildRecordsTab();soundHonesty();oneAnnouncer();dailyToday();
    if(window.MutationObserver){new MutationObserver(function(){setTimeout(function(){injectDaily();injectSettings();oneAnnouncer();},0);}).observe(document.body,{childList:true});new MutationObserver(function(){if(arena.querySelector(".trial-result"))pollStates();}).observe(arena,{childList:true});}
    setInterval(pollStates,1000);pollStates();buildCoach();
    try{var done=sessionStorage.getItem("mbm_titanforge_reset_done");if(done){sessionStorage.removeItem("mbm_titanforge_reset_done");announce("PROGRESS RESET · "+done+" SAVES CLEARED");}}catch(e){}
    built=true;G.polishReady=true;return true;}
  var tries=0,timer=setInterval(function(){if(build()||++tries>260)clearInterval(timer);},60);
  G.records={list:function(){return ACH.map(function(a){return {id:a.id,name:a.name,unlocked:!!rec.unlocked[a.id]};});},unlock:unlock,addPower:addPower,addAscendTime:addAscendTime,get:function(){return JSON.parse(JSON.stringify(rec));},saveKey:REC_KEY,count:ACH.length};
  G.daily={plan:plan,today:dailyToday,start:startDaily,finish:finishDaily,state:function(){return JSON.parse(JSON.stringify(daily));},attempt:function(){return attempt?{power:attempt.power,lifts:attempt.lifts,target:attempt.plan.target,mods:attempt.plan.mods.map(function(m){return m.id;})}:null;},saveKey:DAILY_KEY};
  G.save={exportCode:exportCode,importCode:importCode,keys:SAVE_KEYS.slice()};
  G.polish={resetAll:resetAll,coachVisible:function(){return !!refs.coach;},announcerCount:function(){return Array.prototype.filter.call(document.querySelectorAll("[aria-live]"),function(n){return n.getAttribute("aria-hidden")!=="true";}).length;}};
})();
